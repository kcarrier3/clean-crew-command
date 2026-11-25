import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { arSplit, arTurnover, avgDaysToPay, avgWorkOrderHours, KpiInvoice, KpiWorkOrder } from '@/lib/ownerKpis';

const money = (n: number) => n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const num = (n: number | null, suffix = '') => (n == null ? '—' : `${n.toFixed(1)}${suffix}`);

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

export default function OwnerKpis() {
  const [inv, setInv] = useState<KpiInvoice[]>([]);
  const [wo, setWo] = useState<KpiWorkOrder[]>([]);
  const [paid30, setPaid30] = useState(0);

  useEffect(() => {
    const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    supabase.from('billing_invoices').select('status, invoice_date, due_date, total, balance_due, paid_at')
      .then(({ data }) => setInv((data as KpiInvoice[]) ?? []));
    supabase.from('work_orders').select('created_at, completed_at').not('completed_at', 'is', null)
      .gte('completed_at', new Date(Date.now() - 365 * 86400000).toISOString())
      .then(({ data }) => setWo((data as KpiWorkOrder[]) ?? []));
    (supabase.from('billing_payments') as any).select('amount, payment_date').gte('payment_date', since)
      .then(({ data }: any) => setPaid30((data ?? []).reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0)));
  }, []);

  const ar = arSplit(inv);
  const t = arTurnover(inv);
  const dtp = avgDaysToPay(inv);
  const w = avgWorkOrderHours(wo);
  const woText = w ? (w.hours >= 48 ? `${(w.hours / 24).toFixed(1)} days` : `${w.hours.toFixed(1)} hrs`) : '—';

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle>Business KPIs</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Open receivables" value={money(ar.total)} hint={`${ar.currentCount + ar.pastCount} open invoices`} />
          <Stat label="Current vs past due" value={`${ar.currentPct.toFixed(0)}% / ${ar.pastPct.toFixed(0)}%`} hint={`${money(ar.current)} current · ${money(ar.past)} past due`} />
          <Stat label="AR turnover (12 mo)" value={t.turnover ? `${t.turnover.toFixed(1)}×` : '—'} hint={`Days sales outstanding: ${num(t.dso)}`} />
          <Stat label="Avg days to get paid" value={num(dtp, ' days')} hint="Invoice date to paid, last 12 months" />
          <Stat label="Billed last 12 months" value={money(t.billed)} />
          <Stat label="Collected last 30 days" value={money(paid30)} />
          <Stat label="90+ days past due" value={money(ar.aging.d90)} />
          <Stat label="Avg work order fix time" value={woText} hint={w ? `Opened to completed · ${w.count} done in 12 mo` : 'No completed work orders yet'} />
        </div>
        <div>
          <div className="text-sm font-medium mb-2">Receivables aging</div>
          <div className="grid grid-cols-5 gap-2 text-center text-xs">
            {([['Current', ar.aging.current], ['1–30', ar.aging.d1_30], ['31–60', ar.aging.d31_60], ['61–90', ar.aging.d61_90], ['90+', ar.aging.d90]] as const).map(([l, v]) => (
              <div key={l} className="rounded-md bg-muted p-2"><div className="text-muted-foreground">{l}</div><div className="font-semibold text-sm">{money(v)}</div></div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
