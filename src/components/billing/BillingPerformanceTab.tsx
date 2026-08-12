import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Gauge } from 'lucide-react';
import { db, fetchBillingEvents, fetchInvoices } from './billingApi';
import { money, type BillingEvent, type Invoice } from '@/lib/billing/types';
import {
  AGING_BUCKETS, agingBucket, ageInDays, avg, businessDays, calendarDays, pctWithin,
} from '@/lib/billing/kpi';

const Stat = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
  <Card>
    <CardContent className="p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </CardContent>
  </Card>
);

export const BillingPerformanceTab = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [events, setEvents] = useState<BillingEvent[]>([]);
  const [payDays, setPayDays] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [inv, evt] = await Promise.all([fetchInvoices(), fetchBillingEvents(['ready', 'hold'])]);
      setInvoices(inv);
      setEvents(evt);
      const { data: allocs } = await db.from('billing_payment_allocations')
        .select('invoice_id, payment:billing_payments(payment_date)');
      const byInvoice = new Map(inv.map(i => [i.id, i]));
      const days: number[] = [];
      (allocs ?? []).forEach((a: any) => {
        const i = byInvoice.get(a.invoice_id);
        const d = calendarDays(i?.generated_at ?? null, a.payment?.payment_date ?? null);
        if (d != null) days.push(d);
      });
      setPayDays(days);
      setLoading(false);
    })();
  }, []);

  const billed = invoices.filter(i => i.earliest_completed_at && i.status !== 'void');
  const calDays = billed.map(i => calendarDays(i.earliest_completed_at, i.generated_at)).filter(n => n != null) as number[];
  const bizDays = billed.map(i => businessDays(i.earliest_completed_at, i.generated_at)).filter(n => n != null) as number[];

  const ready = events.filter(e => e.status === 'ready');
  const readyTotal = ready.reduce((s, e) => s + Number(e.amount || 0), 0);
  const oldest = ready.length ? Math.max(...ready.map(e => ageInDays(e.completed_at) ?? 0)) : null;

  const openInvoices = invoices.filter(i => !['paid', 'void'].includes(i.status));
  const aging = Object.fromEntries(AGING_BUCKETS.map(b => [b, 0])) as Record<string, number>;
  openInvoices.forEach(i => { aging[agingBucket(i.invoice_date)] += Number(i.balance_due || 0); });
  const arTotal = openInvoices.reduce((s, i) => s + Number(i.balance_due || 0), 0);

  if (loading) return <p className="text-sm text-muted-foreground">Loading billing performance…</p>;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Avg days to bill" value={avg(calDays) == null ? '—' : `${avg(calDays)}d`}
              hint={avg(bizDays) == null ? undefined : `${avg(bizDays)} business days`} />
        <Stat label="Billed within 1 business day" value={pctWithin(bizDays, 1) == null ? '—' : `${pctWithin(bizDays, 1)}%`} />
        <Stat label="Within 3 / 5 business days"
              value={`${pctWithin(bizDays, 3) ?? '—'}% / ${pctWithin(bizDays, 5) ?? '—'}%`} />
        <Stat label="Avg days to payment" value={avg(payDays) == null ? '—' : `${avg(payDays)}d`} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Dollars ready to bill" value={money(readyTotal)} hint={`${ready.length} items`} />
        <Stat label="Oldest unbilled item" value={oldest == null ? '—' : `${oldest} days`} />
        <Stat label="Open A/R" value={money(arTotal)} hint={`${openInvoices.length} open invoices`} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Gauge className="h-4 w-4" /> A/R aging</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-4">
            {AGING_BUCKETS.map(b => (
              <div key={b} className="rounded-md border p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{b} days</p>
                <p className="text-lg font-semibold tabular-nums">{money(aging[b])}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Every timestamp here is captured automatically — completion, ready-to-bill, invoice generated, sent and payment.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default BillingPerformanceTab;