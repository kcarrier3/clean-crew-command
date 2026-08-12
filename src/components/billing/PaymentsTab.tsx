import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Banknote, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { db } from './billingApi';
import { RecordPaymentDialog } from './RecordPaymentDialog';
import { money } from '@/lib/billing/types';

export const PaymentsTab = () => {
  const { toast } = useToast();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await db
      .from('billing_payments')
      .select('*, allocations:billing_payment_allocations(amount, invoice:billing_invoices(invoice_number))')
      .order('payment_date', { ascending: false });
    if (error) toast({ title: 'Could not load payments', description: error.message, variant: 'destructive' });
    setPayments(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

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
        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2"><Banknote className="h-4 w-4" /> Payments received</CardTitle>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Record check / payment
          </Button>
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
              return (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{money(p.amount)}</span>
                      <Badge variant="secondary" className="capitalize">{p.method}</Badge>
                      {p.reference_number && <span className="text-xs text-muted-foreground">#{p.reference_number}</span>}
                      {applied < Number(p.amount) && <Badge className="bg-amber-100 text-amber-900">Unapplied {money(Number(p.amount) - applied)}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {p.payer_name ? `${p.payer_name} · ` : ''}
                      Received {format(new Date(`${p.payment_date}T00:00:00`), 'MMM d, yyyy')}
                      {p.deposit_date ? ` · Deposited ${p.deposit_date}` : ''}
                      {p.deposit_account_label ? ` · ${p.deposit_account_label}` : ''}
                    </p>
                    {!!(p.allocations ?? []).length && (
                      <p className="text-xs text-muted-foreground">
                        Applied to {(p.allocations ?? []).map((a: any) => a.invoice?.invoice_number).filter(Boolean).join(', ')}
                      </p>
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
    </div>
  );
};

export default PaymentsTab;