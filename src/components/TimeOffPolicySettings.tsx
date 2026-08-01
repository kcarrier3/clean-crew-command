import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Palmtree, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Policy {
  id: string;
  department: string;
  max_off_per_day: number;
  auto_approve: boolean;
}

interface Tier {
  id: string;
  years_of_service: number;
  weeks: number;
}

interface Holiday {
  id: string;
  name: string;
  rule: string;
  active: boolean;
  paid_only_if_weekday: boolean;
}

const DEPT_LABEL: Record<string, string> = {
  janitorial: 'Janitorial',
  project: 'Project / Construction',
  management: 'Management',
  other: 'Other (supply, admin)',
};

const TimeOffPolicySettings = () => {
  const { toast } = useToast();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [managerWeeks, setManagerWeeks] = useState('2');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [p, t, h, s] = await Promise.all([
      supabase.from('time_off_policies').select('*').order('department'),
      supabase.from('pto_tiers').select('*').order('years_of_service'),
      supabase.from('paid_holidays').select('*').order('created_at'),
      supabase.from('app_settings').select('value').eq('key', 'pto_manager_weeks').maybeSingle(),
    ]);
    setPolicies((p.data as Policy[]) || []);
    setTiers((t.data as Tier[]) || []);
    setHolidays((h.data as Holiday[]) || []);
    if (s.data?.value) setManagerWeeks(String(s.data.value));
  };

  useEffect(() => {
    load();
  }, []);

  const saveAll = async () => {
    setSaving(true);
    try {
      for (const p of policies) {
        const { error } = await supabase
          .from('time_off_policies')
          .update({ max_off_per_day: p.max_off_per_day, auto_approve: p.auto_approve })
          .eq('id', p.id);
        if (error) throw error;
      }
      for (const t of tiers) {
        const { error } = await supabase.from('pto_tiers').update({ weeks: t.weeks }).eq('id', t.id);
        if (error) throw error;
      }
      for (const h of holidays) {
        const { error } = await supabase
          .from('paid_holidays')
          .update({ active: h.active, paid_only_if_weekday: h.paid_only_if_weekday })
          .eq('id', h.id);
        if (error) throw error;
      }
      const { error: sErr } = await supabase
        .from('app_settings')
        .upsert({ key: 'pto_manager_weeks', value: managerWeeks }, { onConflict: 'key' });
      if (sErr) throw sErr;
      toast({ title: 'Saved', description: 'Time off and PTO settings updated.' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Failed to save settings.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarDays className="h-4 w-4" /> Time off coverage limits
          </CardTitle>
          <CardDescription>
            How many people from each department may be off on the same day. Requests within the limit are approved
            automatically; anything over stays pending for a manager override.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {policies.map((p) => (
            <div key={p.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex-1">
                <Label className="text-sm font-medium">{DEPT_LABEL[p.department] || p.department}</Label>
                <div className="mt-2 flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    className="w-24"
                    value={p.max_off_per_day}
                    onChange={(e) =>
                      setPolicies((prev) =>
                        prev.map((x) => (x.id === p.id ? { ...x, max_off_per_day: Number(e.target.value) } : x))
                      )
                    }
                  />
                  <span className="text-sm text-muted-foreground">people off per day</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={p.auto_approve}
                  onCheckedChange={(v) =>
                    setPolicies((prev) => prev.map((x) => (x.id === p.id ? { ...x, auto_approve: v } : x)))
                  }
                />
                <span className="text-sm">Auto-approve within limit</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Palmtree className="h-4 w-4" /> PTO accrual
          </CardTitle>
          <CardDescription>
            Vacation resets on each employee's hire anniversary. A week of vacation pays their average weekly hours
            worked over the previous 52 weeks. Time off cannot be used before the first anniversary.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {tiers.map((t) => (
            <div key={t.id} className="flex items-center gap-3">
              <span className="w-32 text-sm">After {t.years_of_service} year{t.years_of_service === 1 ? '' : 's'}</span>
              <Input
                type="number"
                step="0.5"
                min={0}
                className="w-24"
                value={t.weeks}
                onChange={(e) =>
                  setTiers((prev) => prev.map((x) => (x.id === t.id ? { ...x, weeks: Number(e.target.value) } : x)))
                }
              />
              <span className="text-sm text-muted-foreground">weeks</span>
            </div>
          ))}
          <div className="flex items-center gap-3 border-t pt-4">
            <span className="w-32 text-sm">Managers</span>
            <Input
              type="number"
              step="0.5"
              min={0}
              className="w-24"
              value={managerWeeks}
              onChange={(e) => setManagerWeeks(e.target.value)}
            />
            <span className="text-sm text-muted-foreground">weeks (regardless of tenure)</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Paid holidays</CardTitle>
          <CardDescription>Paid only when the holiday falls Monday through Friday.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {holidays.map((h) => (
            <div key={h.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">{h.name}</p>
                <Badge variant="outline" className="mt-1 text-xs">{h.rule.replace(/-/g, ' ')}</Badge>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={h.paid_only_if_weekday}
                    onCheckedChange={(v) =>
                      setHolidays((prev) => prev.map((x) => (x.id === h.id ? { ...x, paid_only_if_weekday: v } : x)))
                    }
                  />
                  <span className="text-sm">Only if Mon–Fri</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={h.active}
                    onCheckedChange={(v) =>
                      setHolidays((prev) => prev.map((x) => (x.id === h.id ? { ...x, active: v } : x)))
                    }
                  />
                  <span className="text-sm">Paid</span>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Button onClick={saveAll} disabled={saving}>
        <Save className="mr-2 h-4 w-4" /> {saving ? 'Saving…' : 'Save settings'}
      </Button>
    </div>
  );
};

export default TimeOffPolicySettings;