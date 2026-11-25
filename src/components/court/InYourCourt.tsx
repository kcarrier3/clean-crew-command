import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Inbox, FileSpreadsheet, Receipt, Check, IdCard, GraduationCap, Wrench } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { parseCourtSettings, lastClosedPayPeriod, needsFollowUp, daysPastDue, needsI9Verification, workOrderCourtKey } from '@/lib/inYourCourt';

interface CourtItem { key: string; kind: 'payroll' | 'billing' | 'i9' | 'training' | 'wo'; title: string; detail: string; openTab: string; clearLabel: string }

const fmt = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export default function InYourCourt() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<CourtItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const title = profile?.job_title || '';
    const [{ data: setting }, { data: clears }] = await Promise.all([
      supabase.from('app_settings').select('value').eq('key', 'in_your_court').maybeSingle(),
      supabase.from('court_item_clears').select('item_key').eq('user_id', user.id),
    ]);
    const s = parseCourtSettings(setting?.value);
    const cleared = new Set((clears || []).map((c) => c.item_key));
    const now = new Date();
    const out: CourtItem[] = [];

    if (s.payroll.enabled && s.payroll.titles.includes(title)) {
      const p = lastClosedPayPeriod(now, s.payroll.week_start_day);
      const key = `payroll:${p.start}`;
      const { data: batch } = await supabase.from('payroll_export_batches').select('id').eq('period_start', p.start).limit(1);
      if (!cleared.has(key) && !(batch && batch.length)) {
        out.push({ key, kind: 'payroll', title: 'Review payroll', detail: `Pay week ${fmt(p.start)} – ${fmt(p.end)} has closed`, openTab: 'scheduling', clearLabel: 'Mark reviewed' });
      }
    }

    if (s.billing.enabled && s.billing.titles.includes(title)) {
      const { data: inv } = await supabase
        .from('billing_invoices')
        .select('id, invoice_number, due_date, balance_due, status, job_sites(name, is_recurring_monthly)')
        .in('status', ['sent', 'past_due'])
        .gt('balance_due', 0);
      for (const i of (inv || []) as any[]) {
        const recurring = !!i.job_sites?.is_recurring_monthly;
        const key = `billing:${i.id}`;
        if (cleared.has(key) || !needsFollowUp(i.due_date, recurring, s.billing, now)) continue;
        out.push({
          key, kind: 'billing',
          title: `Follow up: ${i.job_sites?.name || 'Customer'}`,
          detail: `Invoice ${i.invoice_number || ''} · $${Number(i.balance_due).toFixed(2)} · ${daysPastDue(i.due_date, now)} days past due (${recurring ? 'janitorial' : 'construction'})`,
          openTab: 'billing', clearLabel: 'Followed up',
        });
      }
    }
    if (s.i9.enabled && s.i9.titles.includes(title)) {
      const { data: subs } = await supabase
        .from('employee_document_submissions')
        .select('id, employee_id, status, reviewed_at, submitted_at, onboarding_documents!inner(document_type)')
        .eq('onboarding_documents.document_type', 'i9')
        .eq('status', 'completed')
        .is('reviewed_at', null);
      const list = ((subs || []) as any[]).filter(needsI9Verification);
      const ids = [...new Set(list.map((x) => x.employee_id))];
      const { data: people } = ids.length ? await supabase.from('profiles').select('id, full_name').in('id', ids) : { data: [] as any[] };
      const names = new Map((people || []).map((p: any) => [p.id, p.full_name]));
      for (const x of list) {
        const key = `i9:${x.id}`;
        if (cleared.has(key)) continue;
        out.push({ key, kind: 'i9', title: `Verify I-9: ${names.get(x.employee_id) || 'Employee'}`,
          detail: "Check that the uploaded IDs match the employee's name, then approve the I-9",
          openTab: 'documents', clearLabel: 'Verified' });
      }
    }
    const ymdLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (s.training.enabled && s.training.titles.includes(title)) {
      const tmr = new Date(now); tmr.setDate(now.getDate() + 1);
      const { data: ts } = await (supabase.from('training_sessions') as any)
        .select('id, worker_id, session_date, start_time, job_sites(name)')
        .eq('manager_id', user.id).not('published_at', 'is', null)
        .gte('session_date', ymdLocal(now)).lte('session_date', ymdLocal(tmr)).order('session_date');
      const ids = [...new Set(((ts || []) as any[]).map((t) => t.worker_id))];
      const { data: ppl } = ids.length ? await supabase.from('profiles').select('id, full_name').in('id', ids) : { data: [] as any[] };
      const nm = new Map((ppl || []).map((p: any) => [p.id, p.full_name]));
      for (const t of (ts || []) as any[]) {
        const key = `training:${t.id}`;
        if (cleared.has(key)) continue;
        out.push({ key, kind: 'training', title: `Training: ${nm.get(t.worker_id) || 'New hire'}`,
          detail: `${fmt(t.session_date)}${t.start_time ? ' · ' + String(t.start_time).slice(0, 5) : ''} at ${t.job_sites?.name || 'account'}`,
          openTab: 'trainingplanner', clearLabel: 'Ready' });
      }
    }
    if (s.work_orders.enabled && s.work_orders.titles.includes(title)) {
      const { data: wos } = await supabase.from('work_orders')
        .select('id, title, due_date, priority, job_sites(name)').in('status', ['open', 'in_progress']).order('due_date', { ascending: true });
      const today = ymdLocal(now);
      for (const w of (wos || []) as any[]) {
        const key = workOrderCourtKey(w.id, now);
        if (cleared.has(key)) continue;
        const late = w.due_date && w.due_date < today;
        out.push({ key, kind: 'wo', title: `Work order: ${w.title}`,
          detail: `${w.job_sites?.name || 'Account'}${w.due_date ? ` · due ${fmt(w.due_date)}${late ? ' (overdue)' : ''}` : ''} · ${w.priority} — check in with staff`,
          openTab: 'quality', clearLabel: 'Checked in' });
      }
    }
    setItems(out);
    setLoaded(true);
  }, [user, profile?.job_title]);

  useEffect(() => { load(); }, [load]);

  const clear = async (key: string) => {
    if (!user) return;
    if (key.startsWith('i9:')) {
      await supabase.from('employee_document_submissions').update({ reviewed_at: new Date().toISOString(), reviewed_by: user.id }).eq('id', key.slice(3));
    }
    const { error } = await supabase.from('court_item_clears').insert({ user_id: user.id, item_key: key });
    if (!error) setItems((xs) => xs.filter((x) => x.key !== key));
  };

  if (!loaded) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Inbox className="h-5 w-5 text-primary" /> In your court
          {items.length > 0 && <Badge>{items.length}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 && <p className="text-sm text-muted-foreground">Nothing waiting on you right now.</p>}
        {items.map((it) => (
          <div key={it.key} className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-md border p-3">
            <div className="flex items-start gap-2 flex-1 min-w-0">
              {it.kind === 'training' ? <GraduationCap className="h-4 w-4 mt-0.5 text-primary" /> : it.kind === 'wo' ? <Wrench className="h-4 w-4 mt-0.5 text-primary" /> : it.kind === 'i9' ? <IdCard className="h-4 w-4 mt-0.5 text-primary" /> : it.kind === 'payroll' ? <FileSpreadsheet className="h-4 w-4 mt-0.5 text-primary" /> : <Receipt className="h-4 w-4 mt-0.5 text-primary" />}
              <div className="min-w-0">
                <div className="font-medium text-sm">{it.title}</div>
                <div className="text-xs text-muted-foreground">{it.detail}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => navigate(`/?tab=${it.openTab}`)}>Open</Button>
              <Button size="sm" onClick={() => clear(it.key)}><Check className="h-4 w-4 mr-1" />{it.clearLabel}</Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
