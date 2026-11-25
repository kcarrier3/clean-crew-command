import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { JOB_TITLES } from '@/lib/jobTitles';
import { CourtSettings, DEFAULT_COURT_SETTINGS, parseCourtSettings } from '@/lib/inYourCourt';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function TitlePicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {JOB_TITLES.map((t) => (
        <label key={t} className="flex items-center gap-2 text-sm">
          <Checkbox checked={value.includes(t)} onCheckedChange={(c) => onChange(c ? [...value, t] : value.filter((x) => x !== t))} />
          {t}
        </label>
      ))}
    </div>
  );
}

export default function InYourCourtSettings() {
  const { toast } = useToast();
  const [s, setS] = useState<CourtSettings>(DEFAULT_COURT_SETTINGS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'in_your_court').maybeSingle()
      .then(({ data }) => setS(parseCourtSettings(data?.value)));
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('app_settings')
      .upsert({ key: 'in_your_court', value: JSON.stringify(s) }, { onConflict: 'key' });
    setSaving(false);
    toast(error ? { title: 'Could not save', description: error.message, variant: 'destructive' } : { title: 'Saved' });
  };

  const num = (v: string) => Math.max(0, parseInt(v || '0', 10) || 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Payroll review</CardTitle>
            <Switch checked={s.payroll.enabled} onCheckedChange={(v) => setS({ ...s, payroll: { ...s.payroll, enabled: v } })} />
          </div>
          <CardDescription>Shows up each week once the pay week closes (12:00 am on the start day). Clears when payroll is exported or marked reviewed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1 max-w-xs">
            <Label>Pay week starts on</Label>
            <Select value={String(s.payroll.week_start_day)} onValueChange={(v) => setS({ ...s, payroll: { ...s.payroll, week_start_day: Number(v) } })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{DAYS.map((d, i) => <SelectItem key={d} value={String(i)}>{d}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Goes to</Label><TitlePicker value={s.payroll.titles} onChange={(t) => setS({ ...s, payroll: { ...s.payroll, titles: t } })} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Past-due billing follow-up</CardTitle>
            <Switch checked={s.billing.enabled} onCheckedChange={(v) => setS({ ...s, billing: { ...s.billing, enabled: v } })} />
          </div>
          <CardDescription>Unpaid invoices show up once they're this many days past due.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <div className="space-y-1"><Label>Janitorial (days)</Label>
              <Input type="number" min={0} value={s.billing.recurring_days} onChange={(e) => setS({ ...s, billing: { ...s.billing, recurring_days: num(e.target.value) } })} /></div>
            <div className="space-y-1"><Label>Construction (days)</Label>
              <Input type="number" min={0} value={s.billing.project_days} onChange={(e) => setS({ ...s, billing: { ...s.billing, project_days: num(e.target.value) } })} /></div>
          </div>
          <div className="space-y-2"><Label>Goes to</Label><TitlePicker value={s.billing.titles} onChange={(t) => setS({ ...s, billing: { ...s.billing, titles: t } })} /></div>
        </CardContent>
      </Card>

      <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
    </div>
  );
}
