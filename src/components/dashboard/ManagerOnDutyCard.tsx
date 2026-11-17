import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Phone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Mod {
  manager_id: string; full_name: string; job_title: string | null; phone: string | null;
  job_site_name: string | null; shift_date: string | null; start_time: string | null; is_current: boolean;
}

const fmtTime = (t: string | null) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

export default function ManagerOnDutyCard() {
  const [mods, setMods] = useState<Mod[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (supabase.rpc as any)('get_my_manager_on_duty').then(({ data }: { data: Mod[] | null }) => {
      setMods(data ?? []);
      setLoading(false);
    });
  }, []);

  const first = mods[0];
  const context = first?.shift_date
    ? first.is_current
      ? `For your current shift${first.job_site_name ? ` at ${first.job_site_name}` : ''}`
      : `For your next shift: ${new Date(first.shift_date + 'T00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} ${fmtTime(first.start_time)}${first.job_site_name ? ` at ${first.job_site_name}` : ''}`
    : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />Manager on Duty</CardTitle>
        {context && <p className="text-sm text-muted-foreground">{context}</p>}
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : mods.length === 0 ? (
          <p className="text-sm text-muted-foreground">No manager on duty is scheduled for your shift yet.</p>
        ) : (
          mods.map((m) => (
            <div key={m.manager_id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0">
                <p className="font-medium truncate">{m.full_name || 'Manager'}</p>
                {m.job_title && <p className="text-sm text-muted-foreground">{m.job_title}</p>}
              </div>
              {m.phone && (
                <Button asChild size="sm" variant="outline">
                  <a href={`tel:${m.phone}`}><Phone className="h-4 w-4 mr-1" />{m.phone}</a>
                </Button>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
