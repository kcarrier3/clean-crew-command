import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Mail, PauseCircle, PlayCircle, Receipt, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { money } from '@/lib/billing/types';
import { invoicePdfBlob } from '@/lib/billing/invoicePdf';
import { addDays, approvableEvents, lastWeekStart, readyTotal } from '@/lib/billing/supplyWeek';

interface WeekEventRow {
  id: string; label: string; description: string | null; amount: number;
  status: 'ready' | 'hold'; hold_reason: string | null; completed_at: string;
}
interface WeekGroupRow {
  job_site_id: string; account_name: string; billing_email: string | null;
  skip_reason: string | null; tax_note: string | null; events: WeekEventRow[];
}
interface SendOutcome { account: string; ok: boolean; detail: string }

const call = async <T,>(body: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.functions.invoke('approve-supply-billing', { body });
  if (error) {
    let detail = error.message;
    if (error instanceof FunctionsHttpError) {
      const text = await error.context.text();
      try { detail = JSON.parse(text).error ?? text; } catch { detail = text; }
    }
    throw new Error(detail);
  }
  return data as T;
};

const blobToBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

const dayLabel = (d: string) => format(new Date(`${d}T12:00:00`), 'MMM d, yyyy');

const SupplyBillingWeekly = () => {
  const { toast } = useToast();
  const [weekStart, setWeekStart] = useState(lastWeekStart());
  const [groups, setGroups] = useState<WeekGroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [approving, setApproving] = useState(false);
  const [progress, setProgress] = useState('');
  const [results, setResults] = useState<SendOutcome[] | null>(null);
  const [holdTarget, setHoldTarget] = useState<WeekEventRow | null>(null);
  const [holdReason, setHoldReason] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await call<{ groups: WeekGroupRow[] }>({ action: 'preview', weekStart });
      setGroups(res.groups ?? []);
    } catch (e) {
      toast({ title: 'Could not load supply billing', description: (e as Error).message, variant: 'destructive' });
      setGroups([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setResults(null); load(); }, [weekStart]);

  const toBill = useMemo(() => approvableEvents(groups), [groups]);
  const billTotal = toBill.reduce((s, e) => s + Number(e.amount || 0), 0);
  const billAccounts = groups.filter(g => !g.skip_reason && g.events.some(e => e.status === 'ready')).length;
  const skippedAccounts = groups.filter(g => g.skip_reason && g.events.some(e => e.status === 'ready'));

  const act = async (body: Record<string, unknown>, done: string) => {
    try {
      await call({ ...body });
      toast({ title: done });
      load();
    } catch (e) {
      toast({ title: 'Could not update item', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const approve = async () => {
    setConfirmOpen(false);
    setApproving(true);
    const outcomes: SendOutcome[] = [];
    try {
      setProgress('Creating invoices…');
      const res = await call<{
        // deno-style untyped rows from the backend
        created: { invoice: any; items: any[]; account_name: string }[];
        skipped: { account_name: string; reason: string }[];
      }>({ action: 'approve', weekStart, eventIds: toBill.map(e => e.id) });

      for (const s of res.skipped ?? []) outcomes.push({ account: s.account_name, ok: false, detail: `Skipped: ${s.reason}` });

      let i = 0;
      for (const c of res.created ?? []) {
        i += 1;
        setProgress(`Sending ${i} of ${res.created.length}…`);
        const inv = c.invoice;
        try {
          const blob = await invoicePdfBlob({
            invoice: {
              invoice_number: inv.invoice_number, status: inv.status, issue_date: inv.invoice_date,
              due_date: inv.due_date, po_number: inv.po_number, terms: inv.payment_terms, notes: inv.notes,
              subtotal: Number(inv.subtotal), tax_rate: Number(inv.tax_rate), tax: Number(inv.tax),
              taxable_amount: Number(inv.taxable_amount || 0), credits_applied: Number(inv.credits_applied || 0),
              tax_exempt: !!inv.tax_exempt, tax_exemption_reason: inv.tax_exemption_reason,
              total: Number(inv.total), amount_paid: Number(inv.amount_paid), balance_due: Number(inv.balance_due),
              bill_to_address: inv.bill_to_address, bill_to_city: inv.bill_to_city,
              bill_to_state: inv.bill_to_state, bill_to_zip: inv.bill_to_zip,
              ship_to_name: inv.ship_to_name, ship_to_address: inv.ship_to_address,
              ship_to_city: inv.ship_to_city, ship_to_state: inv.ship_to_state, ship_to_zip: inv.ship_to_zip,
              tax_jurisdiction: inv.tax_jurisdiction,
            },
            items: c.items.map(it => ({
              description: it.description, quantity: Number(it.quantity),
              unit_price: Number(it.unit_price), line_total: Number(it.line_total),
            })),
            clientCompany: inv.customer_name,
            clientName: inv.billing_contact_name,
            clientEmail: inv.billing_email,
            projectName: c.account_name,
          });
          const sent = await call<{ ok: boolean; duplicate?: boolean; error?: string; to?: string[] }>({
            action: 'send', invoiceId: inv.id, pdfBase64: await blobToBase64(blob),
          });
          outcomes.push(sent.ok
            ? { account: c.account_name, ok: true, detail: `${inv.invoice_number} · ${money(inv.total)} → ${(sent.to ?? [inv.billing_email]).join(', ')}` }
            : { account: c.account_name, ok: false, detail: `${inv.invoice_number} created but not sent: ${sent.error ?? 'unknown error'}` });
        } catch (e) {
          outcomes.push({ account: c.account_name, ok: false, detail: `${inv.invoice_number} created but not sent: ${(e as Error).message}` });
        }
      }
    } catch (e) {
      toast({ title: 'Approve failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setResults(outcomes);
      setApproving(false);
      setProgress('');
      load();
    }
  };

  const sentCount = results?.filter(r => r.ok).length ?? 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between space-y-0">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><Receipt className="h-4 w-4" /> Weekly supply billing</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Review the week's drop-offs, then Approve. Each account gets one invoice emailed to its billing address.
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" aria-label="Previous week" onClick={() => setWeekStart(w => addDays(w, -7))} disabled={approving}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium px-2 whitespace-nowrap">{dayLabel(weekStart)} – {dayLabel(addDays(weekStart, 6))}</span>
            <Button variant="outline" size="icon" aria-label="Next week" onClick={() => setWeekStart(w => addDays(w, 7))}
                    disabled={approving || addDays(weekStart, 7) > lastWeekStart()}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <span className="font-semibold tabular-nums">{money(billTotal)}</span>
            <span className="text-muted-foreground"> before tax · {toBill.length} drop-off{toBill.length === 1 ? '' : 's'} · {billAccounts} account{billAccounts === 1 ? '' : 's'}</span>
            {skippedAccounts.length > 0 && (
              <span className="text-destructive"> · {skippedAccounts.length} will be skipped</span>
            )}
          </div>
          <Button onClick={() => setConfirmOpen(true)} disabled={loading || approving || !toBill.length}>
            <CheckCircle2 className="h-4 w-4 mr-1" /> {approving ? progress || 'Working…' : 'Approve'}
          </Button>
        </CardContent>
      </Card>

      {results && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {sentCount} invoice{sentCount === 1 ? '' : 's'} sent{results.length - sentCount ? `, ${results.length - sentCount} need attention` : ''}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {results.length === 0 && <p className="text-muted-foreground">Nothing was billed.</p>}
            {results.map((r, i) => (
              <p key={i} className={r.ok ? '' : 'text-destructive'}>
                {r.ok ? '✓' : '!'} <span className="font-medium">{r.account}</span> — {r.detail}
              </p>
            ))}
            {results.some(r => !r.ok) && (
              <p className="text-xs text-muted-foreground pt-1">Items that weren't sent stay with the office billing team to finish.</p>
            )}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !groups.length ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          No supply drop-offs waiting to be billed for this week.
        </div>
      ) : groups.map(g => (
        <Card key={g.job_site_id} className={g.skip_reason ? 'border-destructive/40' : ''}>
          <CardHeader className="pb-2 gap-2 sm:flex-row sm:items-start sm:justify-between space-y-0">
            <div className="min-w-0">
              <CardTitle className="text-base">{g.account_name}</CardTitle>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <Mail className="h-3 w-3" /> {g.billing_email || 'No billing email'}
                {g.tax_note && <span> · {g.tax_note}</span>}
              </p>
              {g.skip_reason && (
                <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                  <AlertTriangle className="h-3 w-3" /> {g.skip_reason}. This account will be skipped.
                </p>
              )}
            </div>
            <p className="text-lg font-semibold tabular-nums">{money(readyTotal(g))}</p>
          </CardHeader>
          <CardContent className="divide-y">
            {g.events.map(e => (
              <div key={e.id} className="py-2 flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">
                    {format(new Date(e.completed_at), 'EEE MMM d')}
                    {e.status === 'hold' && <Badge variant="secondary" className="ml-2">On hold</Badge>}
                  </p>
                  {e.description && <p className="text-xs text-muted-foreground whitespace-pre-line">{e.description}</p>}
                  {e.status === 'hold' && e.hold_reason && <p className="text-xs text-muted-foreground">Hold: {e.hold_reason}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="tabular-nums mr-1">{money(e.amount)}</span>
                  {e.status === 'hold' ? (
                    <Button size="sm" variant="outline" disabled={approving}
                            onClick={() => act({ action: 'release', eventId: e.id }, 'Released')}>
                      <PlayCircle className="h-3.5 w-3.5 mr-1" /> Release
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" disabled={approving}
                            onClick={() => { setHoldTarget(e); setHoldReason(''); }}>
                      <PauseCircle className="h-3.5 w-3.5 mr-1" /> Hold
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" aria-label="Remove, not billable" disabled={approving}
                          onClick={() => act({ action: 'remove', eventId: e.id }, 'Removed — will not be billed')}>
                    <XCircle className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve and send?</DialogTitle>
            <DialogDescription>
              {billAccounts} invoice{billAccounts === 1 ? '' : 's'} totaling {money(billTotal)} before tax will be created and emailed to each account's billing address.
              {skippedAccounts.length > 0 && ` ${skippedAccounts.length} account${skippedAccounts.length === 1 ? '' : 's'} with a warning will be skipped.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={approve}>Approve and send</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!holdTarget} onOpenChange={o => !o && setHoldTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Hold this drop-off</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">It won't be billed until you release it.</p>
          <div className="space-y-2">
            <Label htmlFor="sbw_hold">Reason (required)</Label>
            <Textarea id="sbw_hold" rows={3} value={holdReason} onChange={e => setHoldReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHoldTarget(null)}>Cancel</Button>
            <Button disabled={!holdReason.trim()} onClick={() => {
              const t = holdTarget; setHoldTarget(null);
              if (t) act({ action: 'hold', eventId: t.id, reason: holdReason.trim() }, 'Put on hold');
            }}>Place hold</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SupplyBillingWeekly;
