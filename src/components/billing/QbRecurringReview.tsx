import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from './billingApi';
import { CrmLinkPicker } from './CrmLinkPicker';
import { activateSchedules, confirmQbPrefill } from './recurringApi';
import { parseQbLines } from '@/lib/billing/recurringPlan';
import { money } from '@/lib/billing/types';

interface Prefill {
  id: string;
  qb_customer: string;
  latest_subtotal: number | null;
  usual_day_of_month: number | null;
  terms: string | null;
  bill_email: string | null;
  memo: string | null;
  latest_date: string | null;
  latest_email_status: string | null;
  lines: string | null;
  job_site_id: string | null;
  job_site_name: string | null;
  job_site_match: string | null;
  status: string;
  confirmed_schedule_ids: string[];
}

/** Review QuickBooks suggestions. Confirm creates an inactive schedule. Nothing activates itself. */
export const QbRecurringReview = ({ onChanged }: { onChanged?: () => void }) => {
  const { toast } = useToast();
  const [rows, setRows] = useState<Prefill[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [showConfirmed, setShowConfirmed] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, { jobSiteId: string; companyId: string | null; label: string; email: string }>>({});
  const [janitorialId, setJanitorialId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data }, { data: items }] = await Promise.all([
      // Only customers set up as recurring transactions in QuickBooks; irregular billing is never suggested.
      db.from('qb_recurring_prefill').select('*')
        .eq('pattern', 'qb_recurring_template')
        .neq('status', 'dismissed')
        .order('qb_customer'),
      db.from('billing_items').select('id, name').eq('active', true),
    ]);
    setRows(data ?? []);
    const jan = (items ?? []).find((i: { name: string }) => i.name.toLowerCase() === 'janitorial services');
    setJanitorialId(jan?.id ?? null);
    const next: typeof drafts = {};
    (data ?? []).forEach((r: Prefill) => {
      const siteId = (r.job_site_id || '').split(';').map(s => s.trim()).filter(s => /^[0-9a-f-]{36}$/i.test(s))[0] || '';
      next[r.id] = { jobSiteId: siteId, companyId: null, label: r.qb_customer, email: r.bill_email || '' };
    });
    setDrafts(next);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const confirm = async (r: Prefill) => {
    const d = drafts[r.id];
    if (!d?.jobSiteId) {
      toast({ title: 'Pick a job site', description: r.qb_customer, variant: 'destructive' });
      return;
    }
    setBusy(r.id);
    try {
      const parsed = parseQbLines(r.lines || '');
      const multi = (r.job_site_id || '').includes(';') || parsed.some(l => l.location);
      await confirmQbPrefill(r.id, {
        jobSiteId: d.jobSiteId,
        companyId: d.companyId,
        label: d.label || r.qb_customer,
        billingEmail: d.email || null,
        terms: r.terms,
        billingDay: r.usual_day_of_month || 1,
        memo: r.memo,
        consolidated: multi,
        qbLastSentOn: r.latest_date,
        qbLastEmailStatus: r.latest_email_status,
        lines: (parsed.length ? parsed : [{ description: 'Janitorial Services', quantity: 1, rate: Number(r.latest_subtotal || 0), location: null }]).map(l => ({
          billing_item_id: janitorialId,
          description: l.location ? `${l.description} (${l.location})` : l.description,
          quantity: l.quantity,
          rate: l.rate,
          taxable: true,
        })),
      });
      toast({ title: 'Inactive schedule created', description: 'Activate it after you review the match.' });
      await load();
      onChanged?.();
    } catch (e: any) {
      toast({ title: 'Could not confirm', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const activateSelected = async () => {
    const ids = rows.filter(r => selected[r.id]).flatMap(r => r.confirmed_schedule_ids ?? []);
    if (!ids.length) {
      toast({ title: 'Confirm rows before activating', variant: 'destructive' });
      return;
    }
    setBusy('bulk');
    try {
      await activateSchedules(ids);
      toast({ title: `${ids.length} schedule(s) activated` });
      setSelected({});
      onChanged?.();
    } catch (e: any) {
      toast({ title: 'Could not activate', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading QuickBooks suggestions…</p>;
  if (!rows.length) return null;
  const pending = rows.filter(r => r.status !== 'confirmed');
  const confirmedCount = rows.length - pending.length;
  // Confirmed suggestions already appear as schedules below; hide them unless asked so nothing shows twice.
  const shown = showConfirmed ? rows : pending;

  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0 gap-2">
        <CardTitle className="text-base">QuickBooks suggestions</CardTitle>
        {showConfirmed && (
          <Button size="sm" variant="outline" onClick={activateSelected} disabled={busy === 'bulk'}>
            {busy === 'bulk' && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Activate selected
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          {pending.length} waiting for review. Confirm creates an inactive schedule in the list below. Nothing turns on until you activate it.
        </p>
        {confirmedCount > 0 && (
          <Button size="sm" variant="link" className="h-auto p-0 text-xs" onClick={() => setShowConfirmed(v => !v)}>
            {showConfirmed ? 'Hide' : 'Show'} {confirmedCount} already set up
          </Button>
        )}
        {shown.map(r => {
          const d = drafts[r.id];
          return (
            <div key={r.id} className="rounded-md border p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Checkbox checked={!!selected[r.id]} onCheckedChange={v => setSelected(s => ({ ...s, [r.id]: !!v }))} aria-label={`Select ${r.qb_customer}`} />
                <p className="font-medium text-sm">{r.qb_customer}</p>
                <Badge variant="secondary">{r.status}</Badge>
                <span className="text-sm tabular-nums">{money(r.latest_subtotal)}</span>
                <span className="text-xs text-muted-foreground">Day {r.usual_day_of_month || '—'} · {r.terms || '—'}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Suggested site: {r.job_site_name || 'none'} ({r.job_site_match || 'unmatched'}) · {r.bill_email || 'no email'}
              </p>
              <p className="text-xs">{r.lines}</p>
              {r.status !== 'confirmed' && d && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input placeholder="Job site id" value={d.jobSiteId} onChange={e => setDrafts(s => ({ ...s, [r.id]: { ...d, jobSiteId: e.target.value } }))} />
                  <Input placeholder="Billing email" value={d.email} onChange={e => setDrafts(s => ({ ...s, [r.id]: { ...d, email: e.target.value } }))} />
                  <Input placeholder="Schedule label" value={d.label} onChange={e => setDrafts(s => ({ ...s, [r.id]: { ...d, label: e.target.value } }))} />
                  <CrmLinkPicker kind="company" value={d.companyId} onChange={id => setDrafts(s => ({ ...s, [r.id]: { ...d, companyId: id } }))} placeholder="Bill-to company" />
                  <Button size="sm" onClick={() => confirm(r)} disabled={busy === r.id}>
                    {busy === r.id && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Confirm inactive
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default QbRecurringReview;
