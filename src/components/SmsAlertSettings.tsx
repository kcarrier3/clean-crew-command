import { useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const KEYS = ['sms_missed_punch_enabled', 'missed_punch_grace_minutes', 'company_timezone'] as const;

const STATUS_LABEL: Record<string, string> = {
  sent: 'Sent', failed: 'Failed', pending: 'Waiting', sending: 'Sending',
  not_configured: 'Texting not set up', not_opted_in: 'Manager not opted in',
  invalid_phone: 'Bad phone number', manager_inactive: 'Manager inactive',
};

export default function SmsAlertSettings() {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(false);
  const [grace, setGrace] = useState('10');
  const [tz, setTz] = useState('America/New_York');
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [log, setLog] = useState<any[]>([]);
  const [preview, setPreview] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await (supabase as any).from('app_settings').select('key, value').in('key', KEYS as any);
    const m = Object.fromEntries((data ?? []).map((r: any) => [r.key, r.value]));
    setEnabled(m.sms_missed_punch_enabled === 'true');
    setGrace(m.missed_punch_grace_minutes ?? '10');
    setTz(m.company_timezone ?? 'America/New_York');
    const { data: rows } = await (supabase as any).from('sms_alert_log')
      .select('id, shift_date, scheduled_start, status, error_message, sent_at, to_phone, message')
      .order('created_at', { ascending: false }).limit(15);
    setLog(rows ?? []);
    const { data: st } = await supabase.functions.invoke('check-missed-punches', { body: { action: 'status' } });
    setConfigured(st?.smsConfigured ?? false);
  };
  useEffect(() => { load(); }, []);

  const save = async (next = enabled) => {
    const g = Math.min(Math.max(parseInt(grace, 10) || 10, 1), 120);
    try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); } catch {
      toast({ title: 'Unknown timezone', description: 'Use a name like America/New_York.', variant: 'destructive' });
      return;
    }
    const { error } = await (supabase as any).from('app_settings').upsert([
      { key: 'sms_missed_punch_enabled', value: String(next) },
      { key: 'missed_punch_grace_minutes', value: String(g) },
      { key: 'company_timezone', value: tz },
    ], { onConflict: 'key' });
    toast(error ? { title: 'Could not save', description: error.message, variant: 'destructive' } : { title: 'Saved' });
    if (!error) { setEnabled(next); setGrace(String(g)); }
  };

  const runPreview = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('check-missed-punches', { body: { dryRun: true } });
    setBusy(false);
    if (error) { toast({ title: 'Preview failed', variant: 'destructive' }); return; }
    setPreview(data?.alerts ?? []);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2"><BellRing className="h-4 w-4" /> Missed punch-in texts</CardTitle>
        <CardDescription>
          Texts the employee's assigned manager when a scheduled employee hasn't punched in. Temporary — turn off once push alerts are live.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-medium">Send missed punch-in texts</div>
            <div className="text-sm text-muted-foreground">
              Texting service: {configured === null ? 'checking…' : configured ? <Badge variant="secondary">Connected</Badge> : <Badge variant="outline">Not set up yet — nothing will be texted</Badge>}
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={(v) => save(v)} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="grace">Grace period (minutes)</Label>
            <Input id="grace" type="number" min={1} max={120} value={grace} onChange={(e) => setGrace(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tz">Timezone</Label>
            <Input id="tz" value={tz} onChange={(e) => setTz(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => save()}>Save</Button>
          <Button variant="outline" onClick={runPreview} disabled={busy}>{busy ? 'Checking…' : 'Preview who would be texted now'}</Button>
        </div>
        {preview && (
          <div className="text-sm space-y-1 border rounded-md p-3">
            <div className="font-medium">Preview (nothing sent)</div>
            {preview.length === 0 ? <div className="text-muted-foreground">No one is currently missing a punch.</div> :
              preview.map((p, i) => <div key={i}>{p.message} <span className="text-muted-foreground">— {STATUS_LABEL[p.status] ?? p.status}</span></div>)}
          </div>
        )}
        <div className="space-y-1">
          <div className="font-medium text-sm">Recent alerts</div>
          {log.length === 0 ? <div className="text-sm text-muted-foreground">None yet.</div> : log.map((r) => (
            <div key={r.id} className="text-sm flex flex-wrap gap-2 border-b py-1">
              <Badge variant={r.status === 'sent' ? 'secondary' : 'outline'}>{STATUS_LABEL[r.status] ?? r.status}</Badge>
              <span>{r.message}</span>
              {r.error_message && <span className="text-destructive">{r.error_message}</span>}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
