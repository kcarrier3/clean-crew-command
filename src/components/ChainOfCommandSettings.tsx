import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { JOB_TITLES } from '@/lib/jobTitles';

const NONE = '__none__';

export default function ChainOfCommandSettings() {
  const { toast } = useToast();
  const [map, setMap] = useState<Record<string, string>>({});
  const [orig, setOrig] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data, error } = await (supabase as any).from('job_title_reporting').select('job_title, reports_to_title');
    if (error) { toast({ title: 'Failed to load chain of command', description: error.message, variant: 'destructive' }); return; }
    const m: Record<string, string> = {};
    (data || []).forEach((r: any) => { m[r.job_title] = r.reports_to_title; });
    setMap(m); setOrig(m);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    const upserts = JOB_TITLES.filter(t => map[t] && map[t] !== orig[t]).map(t => ({ job_title: t, reports_to_title: map[t], updated_at: new Date().toISOString() }));
    const removed = JOB_TITLES.filter(t => !map[t] && orig[t]);
    const db = supabase as any;
    const r1 = upserts.length ? await db.from('job_title_reporting').upsert(upserts) : { error: null };
    const r2 = removed.length ? await db.from('job_title_reporting').delete().in('job_title', removed) : { error: null };
    setSaving(false);
    const err = r1.error || r2.error;
    if (err) { toast({ title: 'Save failed', description: err.message, variant: 'destructive' }); return; }
    toast({ title: 'Chain of command saved' });
    load();
  };

  return (
    <div className="space-y-3">
      {JOB_TITLES.map(t => (
        <div key={t} className="flex flex-col sm:flex-row sm:items-center gap-2">
          <span className="sm:w-48 text-sm font-medium">{t}</span>
          <span className="hidden sm:inline text-muted-foreground text-sm">reports to</span>
          <Select value={map[t] || NONE} onValueChange={v => setMap(p => { const n = { ...p }; if (v === NONE) delete n[t]; else n[t] = v; return n; })}>
            <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>No one</SelectItem>
              {JOB_TITLES.filter(x => x !== t).map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">If a title has several people, all of them are shown. Project Workers see the lead scheduled on their job that day first.</p>
      <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
    </div>
  );
}
