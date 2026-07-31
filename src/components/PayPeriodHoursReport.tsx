import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Row {
  employeeId: string;
  name: string;
  code: string;
  scheduled: number;
  actual: number;
}

const getPayPeriod = (offset: number) => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + offset * 7);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  return { start, end };
};

const fmtDate = (d: Date) => d.toLocaleDateString([], { month: 'short', day: 'numeric' });
const toDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const shiftHours = (start: string, end: string) => {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  return mins / 60;
};

const PayPeriodHoursReport = () => {
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const { start, end } = getPayPeriod(offset);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset]);

  const load = async () => {
    setLoading(true);
    try {
      const { start, end } = getPayPeriod(offset);
      const lastDay = new Date(end.getTime() - 86400000);

      const [{ data: schedules }, { data: entries }] = await Promise.all([
        supabase
          .from('employee_schedules')
          .select(`id, start_time, end_time, days_of_week, start_date, end_date,
                   employees:employee_id(id, first_name, last_name, employee_id)`)
          .eq('active', true)
          .lte('start_date', toDateStr(lastDay))
          .or(`end_date.is.null,end_date.gte.${toDateStr(start)}`),
        supabase
          .from('time_entries')
          .select(`employee_id, clock_in, clock_out,
                   employees:employee_id(id, first_name, last_name, employee_id)`)
          .gte('clock_in', start.toISOString())
          .lt('clock_in', end.toISOString()),
      ]);

      const map = new Map<string, Row>();
      const ensure = (emp: any) => {
        if (!emp?.id) return null;
        if (!map.has(emp.id)) {
          map.set(emp.id, {
            employeeId: emp.id,
            name: `${emp.first_name} ${emp.last_name}`,
            code: emp.employee_id,
            scheduled: 0,
            actual: 0,
          });
        }
        return map.get(emp.id)!;
      };

      (schedules || []).forEach((s: any) => {
        const row = ensure(s.employees);
        if (!row) return;
        for (let i = 0; i < 7; i++) {
          const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
          const ds = toDateStr(day);
          if (s.start_date && ds < s.start_date) continue;
          if (s.end_date && ds > s.end_date) continue;
          const dow = day.getDay() === 0 ? 7 : day.getDay();
          if (!(s.days_of_week || []).includes(dow)) continue;
          row.scheduled += shiftHours(s.start_time, s.end_time);
        }
      });

      (entries || []).forEach((e: any) => {
        const row = ensure(e.employees);
        if (!row || !e.clock_out) return;
        row.actual += (new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime()) / 3600000;
      });

      setRows(Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name)));
    } finally {
      setLoading(false);
    }
  };

  const totalSched = rows.reduce((s, r) => s + r.scheduled, 0);
  const totalActual = rows.reduce((s, r) => s + r.actual, 0);

  const variance = (r: { scheduled: number; actual: number }) => r.actual - r.scheduled;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Pay Period Hours • {fmtDate(start)} – {fmtDate(new Date(end.getTime() - 86400000))}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setOffset((o) => o - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setOffset(0)} disabled={offset === 0}>
              This Period
            </Button>
            <Button variant="outline" size="sm" onClick={() => setOffset((o) => o + 1)} disabled={offset >= 0}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-muted-foreground text-center py-8">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No scheduled or worked hours for this pay period.</p>
        ) : (
          <div className="space-y-2">
            <div className="hidden md:grid grid-cols-4 gap-2 px-4 text-xs font-medium text-muted-foreground">
              <span>Employee</span>
              <span className="text-right">Scheduled</span>
              <span className="text-right">Actual</span>
              <span className="text-right">Variance</span>
            </div>
            {rows.map((r) => {
              const v = variance(r);
              return (
                <div key={r.employeeId} className="grid grid-cols-2 md:grid-cols-4 gap-2 items-center border rounded-lg p-3">
                  <div className="col-span-2 md:col-span-1">
                    <p className="font-semibold text-sm">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{r.code}</p>
                  </div>
                  <p className="text-sm font-mono md:text-right">
                    <span className="md:hidden text-muted-foreground text-xs mr-1">Sched</span>
                    {r.scheduled.toFixed(2)}
                  </p>
                  <p className="text-sm font-mono md:text-right">
                    <span className="md:hidden text-muted-foreground text-xs mr-1">Actual</span>
                    {r.actual.toFixed(2)}
                  </p>
                  <div className="md:text-right">
                    <Badge variant={Math.abs(v) < 0.25 ? 'outline' : v > 0 ? 'default' : 'destructive'}>
                      {v > 0 ? '+' : ''}{v.toFixed(2)} hrs
                    </Badge>
                  </div>
                </div>
              );
            })}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 px-3 pt-2 font-semibold text-sm">
              <span className="col-span-2 md:col-span-1">Total</span>
              <span className="font-mono md:text-right">{totalSched.toFixed(2)}</span>
              <span className="font-mono md:text-right">{totalActual.toFixed(2)}</span>
              <span className="font-mono md:text-right">{(totalActual - totalSched > 0 ? '+' : '')}{(totalActual - totalSched).toFixed(2)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PayPeriodHoursReport;
