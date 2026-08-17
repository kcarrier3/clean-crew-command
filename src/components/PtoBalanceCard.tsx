import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Palmtree, CalendarDays } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  isPtoManagerTitle,
  resolveHolidaysForYear,
  type PaidHolidayRow,
  type ResolvedHoliday,
} from '@/lib/paidHolidays';

export interface PtoSummary {
  employee_id: string;
  hire_date: string | null;
  years_of_service: number;
  eligible: boolean;
  weeks: number;
  avg_weekly_hours: number;
  entitled_hours: number;
  used_hours: number;
  adjustment_hours: number;
  remaining_hours: number;
  year_start: string;
  year_end: string;
}

export async function fetchPtoSummary(employeeId: string): Promise<PtoSummary | null> {
  const { data, error } = await supabase.rpc('get_pto_summary', { _employee_id: employeeId });
  if (error) {
    console.error('Error loading PTO summary:', error);
    return null;
  }
  return ((data as unknown as PtoSummary[]) || [])[0] || null;
}

const fmtDate = (iso?: string | null) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const PtoBalanceCard = ({ employeeId }: { employeeId?: string }) => {
  const [summary, setSummary] = useState<PtoSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [holidays, setHolidays] = useState<ResolvedHoliday[]>([]);
  const [isManager, setIsManager] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!employeeId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchPtoSummary(employeeId).then((s) => {
      if (!cancelled) {
        setSummary(s);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  useEffect(() => {
    let cancelled = false;
    if (!employeeId) return;
    (async () => {
      const [{ data: profile }, { data: rows }] = await Promise.all([
        supabase.from('profiles').select('job_title').eq('id', employeeId).maybeSingle(),
        supabase.from('paid_holidays').select('id, name, rule, active, paid_only_if_weekday'),
      ]);
      if (cancelled) return;
      setIsManager(isPtoManagerTitle(profile?.job_title));
      setHolidays(resolveHolidaysForYear((rows as PaidHolidayRow[]) || [], new Date().getFullYear()));
    })();
    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  if (loading) return null;

  if (!summary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Palmtree className="h-5 w-5" /> Paid time off
          </CardTitle>
          <CardDescription>Add a hire date to this profile to start tracking PTO accrual.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const pct = summary.entitled_hours > 0
    ? Math.min(100, Math.round((summary.used_hours / summary.entitled_hours) * 100))
    : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Palmtree className="h-5 w-5" /> Paid time off
          </CardTitle>
          <Badge variant={summary.eligible ? 'default' : 'secondary'}>
            {summary.eligible ? `${summary.weeks} week${summary.weeks === 1 ? '' : 's'} / year` : 'Not yet eligible'}
          </Badge>
        </div>
        <CardDescription>
          Anniversary year {fmtDate(summary.year_start)} – {fmtDate(summary.year_end)} · {summary.years_of_service} year
          {summary.years_of_service === 1 ? '' : 's'} of service
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!summary.eligible && (
          <p className="text-sm text-muted-foreground">
            Vacation is earned during your first year and becomes available on your first anniversary
            ({fmtDate(summary.year_end)}).
          </p>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Accrued</p>
            <p className="text-lg font-semibold">{summary.entitled_hours.toFixed(1)}h</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Used</p>
            <p className="text-lg font-semibold">{summary.used_hours.toFixed(1)}h</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Adjustments</p>
            <p className="text-lg font-semibold">{summary.adjustment_hours.toFixed(1)}h</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Remaining</p>
            <p className="text-lg font-semibold">{summary.remaining_hours.toFixed(1)}h</p>
          </div>
        </div>
        <Progress value={pct} />
        <p className="text-xs text-muted-foreground">
          Based on an average of {summary.avg_weekly_hours.toFixed(1)} hours worked per week
          {summary.avg_weekly_hours >= 35
            ? " (full time — accrued at a standard 40-hour week)."
            : " (part time — accrued at your weekly average)."}
        </p>

        {isManager && holidays.length > 0 && (
          <div className="rounded-lg border p-3">
            <div className="mb-2 flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Paid holidays · {new Date().getFullYear()}</p>
            </div>
            <ul className="space-y-1.5">
              {holidays.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className={h.paid ? '' : 'text-muted-foreground line-through'}>{h.name}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {h.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                    <Badge variant={h.paid ? 'default' : 'secondary'} className="text-xs">
                      {h.paid ? 'Paid' : 'Not paid'}
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              Paid holidays are a management benefit, and only paid when they fall Monday through Friday.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PtoBalanceCard;