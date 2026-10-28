import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Check, Ban } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { money } from '@/lib/billing/types';
import { IssueCreditDialog } from './IssueCreditDialog';
import { db } from './billingApi';
import {
  CREDIT_REASONS, CREDIT_STATUS_LABEL, creditReasonLabel,
  applyCustomerCredit, approveCustomerCredit, canApproveCredits,
  fetchCreditApplications, fetchCredits, reverseCreditApplication, voidCustomerCredit,
  type CreditApplication, type CustomerCredit,
} from './creditsApi';

const statusClass: Record<string, string> = {
  pending_approval: 'bg-amber-100 text-amber-900',
  available: 'bg-blue-100 text-blue-800',
  fully_applied: 'bg-green-100 text-green-800',
  voided: 'bg-muted text-muted-foreground line-through',
};

export const CreditsTab = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [rows, setRows] = useState<CustomerCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');
  const [reason, setReason] = useState('all');
  const [q, setQ] = useState('');
  const [canApprove, setCanApprove] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [apps, setApps] = useState<CreditApplication[]>([]);
  const [applyFor, setApplyFor] = useState<CustomerCredit | null>(null);
  const [invoices, setInvoices] = useState<{
    id: string; invoice_number: string; status: string; balance_due: number;
    crm_company_id: string | null; job_site_id: string | null;
  }[]>([]);
  const [applyInvoice, setApplyInvoice] = useState('');
  const [applyAmount, setApplyAmount] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      setRows(await fetchCredits({ status, reason }));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Could not load credits';
      toast({ title: 'Could not load credits', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [status, reason]);
  useEffect(() => {
    if (!user?.id) return;
    canApproveCredits(user.id).then(setCanApprove).catch(() => setCanApprove(false));
  }, [user?.id]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(r =>
      (r.company?.name ?? '').toLowerCase().includes(needle)
      || (r.site?.name ?? '').toLowerCase().includes(needle)
      || (r.referred?.name ?? '').toLowerCase().includes(needle)
      || (r.notes ?? '').toLowerCase().includes(needle)
    );
  }, [rows, q]);

  const pending = visible.filter(r => r.status === 'pending_approval');
  const availableBalance = rows
    .filter(r => r.status === 'available')
    .reduce((s, r) => s + Number(r.remaining_amount || 0), 0);

  const run = async (title: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      toast({ title });
      await load();
      if (openId) setApps(await fetchCreditApplications(openId));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Credit update failed';
      toast({ title: 'Credit update failed', description: message, variant: 'destructive' });
    }
  };

  const toggleHistory = async (id: string) => {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    try { setApps(await fetchCreditApplications(id)); }
    catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Could not load history';
      toast({ title: 'Could not load history', description: message, variant: 'destructive' });
    }
  };

  const openApply = async (credit: CustomerCredit) => {
    setApplyFor(credit);
    setApplyInvoice('');
    setApplyAmount(String(credit.remaining_amount));
    const { data } = await db.from('billing_invoices')
      .select('id, invoice_number, status, customer_name, crm_company_id, job_site_id, balance_due')
      .in('status', ['draft', 'ready'])
      .order('invoice_date', { ascending: true });
    const list = ((data ?? []) as typeof invoices).filter(inv =>
      (credit.crm_company_id && inv.crm_company_id === credit.crm_company_id)
      || (credit.job_site_id && inv.job_site_id === credit.job_site_id)
    );
    setInvoices(list);
    if (list[0]) setApplyInvoice(list[0].id);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Available balance</p>
          <p className="text-2xl font-semibold tabular-nums">{money(availableBalance)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Pending approval</p>
          <p className="text-2xl font-semibold tabular-nums">{rows.filter(r => r.status === 'pending_approval').length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Credits</p>
          <p className="text-2xl font-semibold tabular-nums">{rows.length}</p>
        </CardContent></Card>
      </div>

      {canApprove && pending.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Waiting for approval</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">Credits over $250 issued by someone other than the Owner or an admin stay here until approved.</p>
            {pending.map(c => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
                <span>
                  {c.company?.name || c.site?.name || 'Credit'} · {money(c.amount)} · {creditReasonLabel(c.reason)}
                  {c.referred?.name ? ` · Referred ${c.referred.name}` : ''}
                </span>
                <Button size="sm" onClick={() => run('Credit approved', () => approveCustomerCredit(c.id))}>
                  <Check className="h-4 w-4 mr-1" /> Approve
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3 gap-3 sm:flex-row sm:items-center sm:justify-between space-y-0">
          <CardTitle className="text-base">Customer credits</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setIssueOpen(true)}><Plus className="h-4 w-4 mr-1" /> Issue credit</Button>
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search customer" className="w-44" />
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {Object.entries(CREDIT_STATUS_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All reasons</SelectItem>
                {CREDIT_REASONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? <p className="text-sm text-muted-foreground">Loading…</p>
            : !visible.length ? <p className="text-sm text-muted-foreground">No credits match.</p>
            : visible.map(c => (
              <div key={c.id} className="rounded-lg border p-3 text-sm space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{c.company?.name || c.site?.name || 'Unassigned'}</span>
                      <Badge className={statusClass[c.status] ?? ''}>{CREDIT_STATUS_LABEL[c.status] ?? c.status}</Badge>
                      <Badge variant="outline">{creditReasonLabel(c.reason)}</Badge>
                      {c.reduces_taxable_amount && <Badge variant="outline">Reduces tax</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Issued {c.issued_at?.slice(0, 10)}
                      {c.site?.name ? ` · ${c.site.name}` : ''}
                      {c.referred?.name ? ` · Referred ${c.referred.name}` : ''}
                      {c.expires_on ? ` · Expires ${c.expires_on}` : ''}
                      {c.notes ? ` · ${c.notes}` : ''}
                      {c.void_reason ? ` · Void: ${c.void_reason}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold tabular-nums">{money(c.amount)}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">Remaining {money(c.remaining_amount)}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => toggleHistory(c.id)}>
                    {openId === c.id ? 'Hide history' : 'History'}
                  </Button>
                  {canApprove && c.status === 'pending_approval' && (
                    <Button size="sm" onClick={() => run('Credit approved', () => approveCustomerCredit(c.id))}>Approve</Button>
                  )}
                  {c.status === 'available' && Number(c.remaining_amount) > 0 && (
                    <Button size="sm" variant="outline" onClick={() => openApply(c)}>Apply</Button>
                  )}
                  {c.status !== 'voided' && (
                    <Button size="sm" variant="ghost" onClick={() => {
                      const why = window.prompt('Reason for voiding this credit (optional)');
                      if (why === null) return;
                      run('Credit voided', () => voidCustomerCredit(c.id, why || null));
                    }}>
                      <Ban className="h-4 w-4 mr-1" /> Void
                    </Button>
                  )}
                </div>
                {openId === c.id && (
                  <div className="rounded-md bg-muted/40 p-2 space-y-1 text-xs">
                    {!apps.length && <p className="text-muted-foreground">Not applied to an invoice yet.</p>}
                    {apps.map(a => (
                      <div key={a.id} className="flex flex-wrap items-center justify-between gap-2">
                        <span>
                          {money(a.amount)} on {a.invoice?.invoice_number ?? 'invoice'}
                          {a.auto_applied ? ' · auto' : ''}
                          {a.reversed_at ? ' · removed' : ''}
                        </span>
                        {!a.reversed_at && (
                          <Button size="sm" variant="ghost" className="h-7" onClick={() =>
                            run('Credit removed from invoice', () => reverseCreditApplication(a.id, 'Removed from credits'))
                          }>Remove</Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {applyFor?.id === c.id && (
                  <div className="grid gap-2 sm:grid-cols-[1fr_8rem_auto] items-end">
                    <select value={applyInvoice} onChange={e => setApplyInvoice(e.target.value)}
                            className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                      {!invoices.length && <option value="">No unsent invoice for this customer</option>}
                      {invoices.map(inv => (
                        <option key={inv.id} value={inv.id}>{inv.invoice_number} · {inv.status} · balance {money(inv.balance_due)}</option>
                      ))}
                    </select>
                    <Input type="number" step="0.01" aria-label="Amount to apply" value={applyAmount} onChange={e => setApplyAmount(e.target.value)} />
                    <Button size="sm" disabled={!applyInvoice} onClick={() => run('Credit applied', async () => {
                      await applyCustomerCredit(c.id, applyInvoice, applyAmount ? Number(applyAmount) : null);
                      setApplyFor(null);
                    })}>Apply</Button>
                  </div>
                )}
              </div>
            ))}
        </CardContent>
      </Card>

      <IssueCreditDialog open={issueOpen} onOpenChange={setIssueOpen} onIssued={load} />
    </div>
  );
};

export default CreditsTab;
