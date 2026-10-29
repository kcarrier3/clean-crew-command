import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Banknote, Plus, Camera, ScanLine, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { db } from './billingApi';
import { RecordPaymentDialog } from './RecordPaymentDialog';
import { ScanCheckDialog } from './ScanCheckDialog';
import { ReceiveCheckDialog } from './ReceiveCheckDialog';
import { INTAKE_STATUS_CLASS, INTAKE_STATUS_LABEL } from '@/lib/billing/checkIntake';
import { money } from '@/lib/billing/types';
import { customerBalances, toCsv, unappliedAmount } from '@/lib/billing/paymentApply';

export const PaymentsTab = () => {
  const { toast } = useToast();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [savingDeposit, setSavingDeposit] = useState<string | null>(null);
  const [intakes, setIntakes] = useState<any[]>([]);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [activeIntake, setActiveIntake] = useState<any | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [from, setFrom] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const load = async () => {
    setLoading(true);
    const { data, error } = await db
      .from('billing_payments')
      .select('*, allocations:billing_payment_allocations(id, amount, invoice_id, invoice:billing_invoices(invoice_number))')
      .order('payment_date', { ascending: false });
    if (error) toast({ title: 'Could not load payments', description: error.message, variant: 'destructive' });
    setPayments(data ?? []);
    setLoading(false);

    const { data: intakeRows } = await db
      .from('billing_check_intakes')
      .select('*')
      .eq('status', 'review_needed')
      .order('received_date', { ascending: false });
    setIntakes(intakeRows ?? []);
    const { data: inv } = await db.from('billing_invoices')
      .select('id, invoice_number, customer_name, crm_company_id, balance_due, due_date, status, invoice_date, total, amount_paid');
    setInvoices(inv ?? []);
  };

  const today = new Date().toISOString().slice(0, 10);
  const aging = customerBalances(invoices.map(i => ({
    id: i.id,
    customerId: i.crm_company_id,
    customerName: i.customer_name || 'Unknown',
    balance: Number(i.balance_due || 0),
    dueDate: i.due_date,
    status: i.status,
  })), today);

  const exportBookkeeper = () => {
    const invRows = invoices.filter(i => i.invoice_date >= from && i.invoice_date <= to).map(i => ({
      kind: 'invoice',
      date: i.invoice_date,
      number: i.invoice_number,
      customer: i.customer_name,
      total: i.total,
      amount_paid: i.amount_paid,
      balance_due: i.balance_due,
      status: i.status,
    }));
    const payRows = payments.filter(p => p.payment_date >= from && p.payment_date <= to && !p.voided_at).map(p => ({
      kind: 'payment',
      date: p.payment_date,
      number: p.reference_number,
      customer: p.payer_name,
      total: p.amount,
      amount_paid: '',
      balance_due: '',
      status: p.method,
    }));
    const csv = toCsv([...invRows, ...payRows]);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `billing-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const unapply = async (allocationId: string) => {
    const { error } = await db.rpc('unapply_payment_allocation', { _allocation_id: allocationId, _reason: 'Unapplied from payments' });
    if (error) toast({ title: 'Could not unapply', description: error.message, variant: 'destructive' });
    else load();
  };

  const voidPayment = async (id: string) => {
    const reason = window.prompt('Why is this payment being voided?') ?? '';
    const { error } = await db.rpc('void_customer_payment', { _payment_id: id, _reason: reason || null });
    if (error) toast({ title: 'Could not void payment', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Payment voided' }); load(); }
  };

  useEffect(() => { load(); }, []);

  /** Deposit day can differ from the day the check was received. */
  const updateDeposit = async (id: string, value: string) => {
    setSavingDeposit(id);
    const { error } = await db.from('billing_payments').update({ deposit_date: value || null }).eq('id', id);
    setSavingDeposit(null);
    if (error) {
      toast({ title: 'Could not update deposit date', description: error.message, variant: 'destructive' });
      return;
    }
    setPayments(prev => prev.map(p => (p.id === id ? { ...p, deposit_date: value || null } : p)));
  };

  const total = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const unapplied = payments.filter(p =>
    Number(p.amount || 0) > (p.allocations ?? []).reduce((s: number, a: any) => s + Number(a.amount || 0), 0));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Payments recorded</p>
          <p className="text-2xl font-semibold tabular-nums">{payments.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total received</p>
          <p className="text-2xl font-semibold tabular-nums">{money(total)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Unapplied / partial</p>
          <p className="text-2xl font-semibold tabular-nums">{unapplied.length}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between space-y-0 gap-2">
          <CardTitle className="text-base">Customer balance and A/R aging</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Input className="h-8 w-36" type="date" value={from} onChange={e => setFrom(e.target.value)} aria-label="Export from" />
            <Input className="h-8 w-36" type="date" value={to} onChange={e => setTo(e.target.value)} aria-label="Export to" />
            <Button size="sm" variant="outline" onClick={exportBookkeeper}>Export CSV</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {!aging.length && <p className="text-sm text-muted-foreground">No open balances.</p>}
          {aging.map(row => (
            <div key={row.customerId ?? row.customerName} className="grid gap-1 text-sm sm:grid-cols-6">
              <span className="font-medium sm:col-span-2">{row.customerName}</span>
              <span>Current {money(row.buckets.current)}</span>
              <span>30 {money(row.buckets['30'])}</span>
              <span>60 {money(row.buckets['60'])} · 90 {money(row.buckets['90'])}</span>
              <span className="tabular-nums">90+ {money(row.buckets['90+'])} · {money(row.total)}</span>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">Export is a CSV of invoices and payments in the date range for the bookkeeper. It does not sync to QuickBooks.</p>
        </CardContent>
      </Card>

      {!!intakes.length && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" /> Checks needing review ({intakes.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {intakes.map(i => (
              <button
                key={i.id}
                type="button"
                onClick={() => { setActiveIntake(i); setIntakeOpen(true); }}
                className="w-full text-left flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 hover:bg-accent"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{money(i.amount)}</span>
                    {i.check_number && <span className="text-xs text-muted-foreground">#{i.check_number}</span>}
                    <Badge className={INTAKE_STATUS_CLASS[i.status]}>{INTAKE_STATUS_LABEL[i.status]}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {i.payer_name ? `${i.payer_name} · ` : ''}Received {i.received_date}
                  </p>
                </div>
                <span className="text-xs font-medium">Finish matching →</span>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2"><Banknote className="h-4 w-4" /> Payments received</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => { setActiveIntake(null); setIntakeOpen(true); }}>
              <ScanLine className="h-4 w-4 mr-1" /> Receive check
            </Button>
            <Button size="sm" variant="outline" onClick={() => setScanOpen(true)}>
              <Camera className="h-4 w-4 mr-1" /> Scan check
            </Button>
            <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Record check / payment
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? <p className="text-sm text-muted-foreground">Loading…</p>
            : !payments.length ? (
              <div className="rounded-md border border-dashed p-8 text-center">
                <p className="text-sm font-medium">No payments recorded</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Enter checks as they arrive; invoice balances update automatically.
                </p>
              </div>
            ) : payments.map(p => {
              const applied = (p.allocations ?? []).reduce((s: number, a: any) => s + Number(a.amount || 0), 0);
              const leftover = unappliedAmount(Number(p.amount || 0), (p.allocations ?? []).map((a: any) => Number(a.amount || 0)));
              return (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{money(p.amount)}</span>
                      <Badge variant="secondary" className="capitalize">{p.method}</Badge>
                      {p.reference_number && <span className="text-xs text-muted-foreground">#{p.reference_number}</span>}
                      {p.entry_source === 'auto_scan' && (
                        <Badge className="bg-green-100 text-green-800">Auto applied from scanned check</Badge>
                      )}
                      {p.entry_source === 'reviewed_scan' && (
                        <Badge variant="outline">Reviewed scanned check</Badge>
                      )}
                      {p.voided_at && <Badge variant="outline">Voided</Badge>}
                      {!p.voided_at && leftover > 0 && <Badge className="bg-amber-100 text-amber-900">Unapplied {money(leftover)}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {p.payer_name ? `${p.payer_name} · ` : ''}
                      Received {format(new Date(`${p.payment_date}T00:00:00`), 'MMM d, yyyy')}
                      {p.deposit_account_label ? ` · ${p.deposit_account_label}` : ''}
                    </p>
                    {!!(p.allocations ?? []).length && (
                      <p className="text-xs text-muted-foreground flex flex-wrap gap-2">
                        {(p.allocations ?? []).map((a: any) => (
                          <span key={a.id}>
                            {a.invoice?.invoice_number} {money(a.amount)}
                            {!p.voided_at && (
                              <button type="button" className="ml-1 underline" onClick={() => unapply(a.id)}>Unapply</button>
                            )}
                          </span>
                        ))}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground" htmlFor={`dep_${p.id}`}>Deposited</label>
                    <input
                      id={`dep_${p.id}`}
                      type="date"
                      className="h-8 rounded-md border bg-background px-2 text-xs"
                      value={p.deposit_date ?? ''}
                      disabled={savingDeposit === p.id || !!p.voided_at}
                      onChange={e => updateDeposit(p.id, e.target.value)}
                    />
                    {!p.voided_at && (
                      <Button size="sm" variant="ghost" onClick={() => voidPayment(p.id)}>Void</Button>
                    )}
                  </div>
                </div>
              );
            })}
          <p className="text-xs text-muted-foreground pt-2">
            Deposit batches are stored so checks can later be grouped for bank reconciliation.
          </p>
        </CardContent>
      </Card>

      <RecordPaymentDialog open={open} onOpenChange={setOpen} invoice={null} onSaved={load} />
      <ScanCheckDialog open={scanOpen} onOpenChange={setScanOpen} onSaved={load} />
      <ReceiveCheckDialog
        open={intakeOpen}
        onOpenChange={o => { setIntakeOpen(o); if (!o) setActiveIntake(null); }}
        intake={activeIntake}
        onSaved={load}
      />
    </div>
  );
};

export default PaymentsTab;