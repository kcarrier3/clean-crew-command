import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { avgWorkOrderHours, budgetVsActual, onTimePct, retentionPct, KpiSite } from '@/lib/ownerKpis';

const hrs = (n: number) => `${Math.round(n).toLocaleString()} hrs`;
const pct = (n: number | null) => (n == null ? '—' : `${n.toFixed(0)}%`);

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

function BudgetRow({ label, b }: { label: string; b: ReturnType<typeof budgetVsActual> }) {
  const w = Math.min(100, b.pct ?? 0);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm"><span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{hrs(b.actual)} of {hrs(b.budgeted)} · {pct(b.pct)}</span></div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${b.pct != null && b.pct > 100 ? 'bg-destructive' : 'bg-primary'}`} style={{ width: `${w}%` }} />
      </div>
      <div className="text-xs text-muted-foreground">{b.count} accounts · {b.over} over budget</div>
    </div>
  );
}

export default function OpsKpis() {
  const [sites, setSites] = useState<KpiSite[]>([]);
  const [wo, setWo] = useState<any[]>([]);
  const [insp, setInsp] = useState<number[]>([]);
  const [people, setPeople] = useState<any[]>([]);

  useEffect(() => {
    const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString();
    const qAgo = new Date(Date.now() - 90 * 86400000).toISOString();
    supabase.from('job_sites').select('is_recurring_monthly, budgeted_hours, used_hours, current_month_used_hours').eq('active', true)
      .then(({ data }) => setSites((data as KpiSite[]) ?? []));
    supabase.from('work_orders').select('created_at, completed_at, due_date').not('completed_at', 'is', null).gte('completed_at', yearAgo)
      .then(({ data }) => setWo(data ?? []));
    (supabase.from('inspections') as any).select('overall_score').not('overall_score', 'is', null).gte('created_at', qAgo)
      .then(({ data }: any) => setInsp((data ?? []).map((r: any) => Number(r.overall_score))));
    (supabase.from('profiles') as any).select('hire_date, active').then(({ data }: any) => setPeople(data ?? []));
  }, []);

  const w = avgWorkOrderHours(wo);
  const woText = w ? (w.hours >= 48 ? `${(w.hours / 24).toFixed(1)} days` : `${w.hours.toFixed(1)} hrs`) : '—';
  const qa = insp.length ? insp.reduce((a, b) => a + b, 0) / insp.length : null;
  const r = retentionPct(people);

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle>Operations KPIs</CardTitle></CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Avg inspection score" value={pct(qa)} hint={`${insp.length} inspections, last 90 days`} />
          <Stat label="Avg work order fix time" value={woText} hint={w ? `Opened to completed · ${w.count} done` : 'No completed work orders yet'} />
          <Stat label="Work orders on time" value={pct(onTimePct(wo))} hint="Completed by the due date" />
          <Stat label="Staff retention (1 yr)" value={pct(r?.pct ?? null)} hint={r ? `Of ${r.count} hired a year+ ago, still active` : 'Needs hire dates on profiles'} />
        </div>
        <div className="space-y-4">
          <div className="text-sm font-medium">Budgeted vs actual hours</div>
          <BudgetRow label="Janitorial (this month)" b={budgetVsActual(sites, true)} />
          <BudgetRow label="Construction (project to date)" b={budgetVsActual(sites, false)} />
        </div>
      </CardContent>
    </Card>
  );
}
