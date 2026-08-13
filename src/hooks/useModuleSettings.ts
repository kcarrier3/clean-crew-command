import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MODULE_SETTINGS_KEY } from '@/lib/modules';

const parse = (value: string | null | undefined): string[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
};

/**
 * Company-wide module visibility. Admins store a JSON array of disabled module
 * keys in app_settings; every signed-in user can read it.
 */
export const useModuleSettings = () => {
  const queryClient = useQueryClient();

  const { data: disabled = [], isLoading } = useQuery({
    queryKey: ['module-settings'],
    queryFn: async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', MODULE_SETTINGS_KEY)
        .maybeSingle();
      return parse(data?.value);
    },
    staleTime: 60_000,
  });

  const isModuleEnabled = (key: string) => !disabled.includes(key);

  const setDisabledModules = async (keys: string[]) => {
    const { error } = await supabase
      .from('app_settings')
      .upsert(
        { key: MODULE_SETTINGS_KEY, value: JSON.stringify(keys), description: 'Company-wide disabled modules' },
        { onConflict: 'key' },
      );
    if (!error) await queryClient.invalidateQueries({ queryKey: ['module-settings'] });
    return { error };
  };

  return { disabledModules: disabled, isModuleEnabled, setDisabledModules, loading: isLoading };
};
