import { useEffect, useState } from 'react';
import { LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useModuleSettings } from '@/hooks/useModuleSettings';
import { APP_MODULES } from '@/lib/modules';

export default function ModuleSettings() {
  const { toast } = useToast();
  const { hasRole } = useAuth();
  const { disabledModules, setDisabledModules, loading } = useModuleSettings();
  const [local, setLocal] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const isAdmin = hasRole('admin');

  useEffect(() => {
    setLocal(disabledModules);
  }, [disabledModules]);

  const toggle = (key: string, enabled: boolean) => {
    setLocal((prev) => (enabled ? prev.filter((k) => k !== key) : [...new Set([...prev, key])]));
  };

  const save = async () => {
    setSaving(true);
    const { error } = await setDisabledModules(local);
    setSaving(false);
    toast(
      error
        ? { title: 'Error', description: 'Failed to save module settings.', variant: 'destructive' }
        : { title: 'Saved', description: 'Module availability updated for everyone.' },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <LayoutGrid className="h-4 w-4" /> Modules
        </CardTitle>
        <CardDescription>
          Turn modules off company-wide. Disabled modules are hidden from navigation for everyone and their pages
          redirect back to the dashboard. The Dashboard and Settings are always available.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="divide-y">
          {APP_MODULES.map((m) => {
            const enabled = !local.includes(m.key);
            return (
              <div key={m.key} className="flex items-start justify-between gap-4 py-3">
                <div className="min-w-0">
                  <div className="font-medium">{m.label}</div>
                  <p className="text-sm text-muted-foreground">{m.description}</p>
                </div>
                <Switch
                  checked={enabled}
                  disabled={!isAdmin || loading}
                  onCheckedChange={(v) => toggle(m.key, v)}
                  aria-label={`${m.label} enabled`}
                />
              </div>
            );
          })}
        </div>
        {!isAdmin && (
          <p className="text-sm text-muted-foreground">Only admins can change module availability.</p>
        )}
        <Button onClick={save} disabled={!isAdmin || saving || loading}>
          {saving ? 'Saving…' : 'Save modules'}
        </Button>
      </CardContent>
    </Card>
  );
}
