import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarClock, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface RosterEntry {
  scheduleId: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  jobSiteName: string | null;
  startTime: string; // HH:MM:SS
  endTime: string;
  clockInAt: string | null;
  clockOutAt: string | null;
  excused: { id: string; reason: string | null } | null;
}

const fmt = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const hourBucket = (t: string) => {
  const h = Number(t.split(':')[0]);
  const d = new Date();
  d.setHours(h, 0, 0, 0);
  return d.toLocaleTimeString([], { hour: 'numeric' }).toLowerCase();
};

const initials = (f: string, l: string) =>
  `${(f || '').charAt(0)}${(l || '').charAt(0)}`.toUpperCase();

const ShiftRoster = () => {
  const [rows, setRows] = useState<RosterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { isManager } = useAuth();
  const { toast } = useToast();
  const canManage = isManager();
  const [excuseTarget, setExcuseTarget] = useState<RosterEntry | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    try {
      const now = new Date();
      const dow = now.getDay() === 0 ? 7 : now.getDay();
      const today = now.toISOString().split('T')[0];
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

      const { data: schedules } = await supabase
        .from('employee_schedules')
        .select(`
          id, start_time, end_time,
          employees:employee_id(id, first_name, last_name, job_title),
          job_sites:job_site_id(name)
        `)
        .eq('active', true)
        .contains('days_of_week', [dow])
        .lte('start_date', today)
        .or(`end_date.is.null,end_date.gte.${today}`);

      const { data: entries } = await supabase
        .from('time_entries')
        .select('employee_id, clock_in, clock_out')
        .gte('clock_in', startOfDay);

      const { data: excusedRows } = await (supabase as any)
        .from('excused_shifts')
        .select('id, schedule_id, reason')
        .eq('excused_date', today);
      const excusedBySchedule = new Map<string, { id: string; reason: string | null }>();
      (excusedRows || []).forEach((e: any) => excusedBySchedule.set(e.schedule_id, { id: e.id, reason: e.reason }));

      const activeByEmp = new Map<string, { clock_in: string; clock_out: string | null }>();
      entries?.forEach((e: any) => {
        const cur = activeByEmp.get(e.employee_id);
        if (!cur || new Date(e.clock_in) > new Date(cur.clock_in)) {
          activeByEmp.set(e.employee_id, { clock_in: e.clock_in, clock_out: e.clock_out });
        }
      });

      const list: RosterEntry[] = (schedules || []).map((s: any) => {
        const emp = s.employees;
        const punch = activeByEmp.get(emp?.id);
        return {
          scheduleId: s.id,
          employeeId: emp?.id,
          firstName: emp?.first_name || '',
          lastName: emp?.last_name || '',
          jobTitle: emp?.job_title || null,
          jobSiteName: s.job_sites?.name || null,
          startTime: s.start_time,
          endTime: s.end_time,
          clockInAt: punch?.clock_in ?? null,
          clockOutAt: punch?.clock_out ?? null,
          excused: excusedBySchedule.get(s.id) || null,
        };
      });

      list.sort((a, b) => a.startTime.localeCompare(b.startTime));
      setRows(list);
    } finally {
      setLoading(false);
    }
  };

  const statusFor = (r: RosterEntry) => {
    if (r.excused) {
      return { label: `Day off on us${r.excused.reason ? ` — ${r.excused.reason}` : ''}`, dotClass: 'bg-blue-500', barClass: 'bg-blue-500' };
    }
    if (r.clockInAt && !r.clockOutAt) {
      const start = new Date(r.clockInAt);
      const mins = Math.floor((Date.now() - start.getTime()) / 60000);
      const hrs = Math.floor(mins / 60);
      const rem = mins % 60;
      const dur = hrs > 0 ? `${hrs} hr${hrs > 1 ? 's' : ''} ${rem} min` : `${rem} min`;
      const timeStr = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase();
      return { label: `${timeStr} clock in (${dur})`, dotClass: 'bg-emerald-500', barClass: 'bg-emerald-500' };
    }
    if (r.clockOutAt) {
      return { label: 'Shift ended', dotClass: 'bg-muted-foreground', barClass: 'bg-muted' };
    }
    const [h, m] = r.startTime.split(':').map(Number);
    const start = new Date();
    start.setHours(h, m, 0, 0);
    const diffMin = Math.floor((Date.now() - start.getTime()) / 60000);
    if (diffMin < 0) {
      const until = Math.abs(diffMin);
      const hrs = Math.floor(until / 60);
      const rem = until % 60;
      const dur = hrs > 0 ? `${hrs} hr${hrs > 1 ? 's' : ''} ${rem} min` : `${rem} min`;
      return { label: `Starts in ${dur}`, dotClass: 'bg-muted-foreground/40', barClass: 'bg-muted' };
    }
    if (diffMin > 30) {
      return { label: `No-show (${diffMin} min late)`, dotClass: 'bg-red-500', barClass: 'bg-red-500' };
    }
    return { label: `Late by ${diffMin} min`, dotClass: 'bg-amber-500', barClass: 'bg-amber-500' };
  };

  const grantExcuse = async () => {
    if (!excuseTarget) return;
    setSaving(true);
    const today = new Date().toISOString().split('T')[0];
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from('excused_shifts').insert({
      schedule_id: excuseTarget.scheduleId,
      employee_id: excuseTarget.employeeId,
      excused_date: today,
      reason: reason || null,
      granted_by: user?.id ?? null,
    });
    setSaving(false);
    if (error) {
      toast({ title: 'Could not grant day off', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Day off granted', description: `${excuseTarget.firstName} ${excuseTarget.lastName} won't be penalized for this shift.` });
    setExcuseTarget(null);
    setReason('');
    load();
  };

  const revokeExcuse = async (r: RosterEntry) => {
    if (!r.excused) return;
    const { error } = await (supabase as any).from('excused_shifts').delete().eq('id', r.excused.id);
    if (error) {
      toast({ title: 'Could not remove', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Excused shift removed' });
    load();
  };

  // group by hour bucket for the timeline label column
  let lastBucket = '';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5" />
          Today's Shift Roster
          <Badge variant="outline" className="ml-2">{rows.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-muted-foreground text-center py-8">Loading roster…</p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No one is scheduled today.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => {
              const bucket = hourBucket(r.startTime);
              const showBucket = bucket !== lastBucket;
              lastBucket = bucket;
              const s = statusFor(r);
              return (
                <div key={r.scheduleId} className="flex items-stretch gap-3">
                  <div className="w-14 pt-3 text-xs text-muted-foreground">
                    {showBucket ? bucket : ''}
                  </div>
                  <div className={`w-1 rounded-full ${s.barClass}`} />
                  <div className="flex-1 border rounded-lg bg-card px-3 py-2 flex items-center gap-3">
                    <div className="relative">
                      <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                        {initials(r.firstName, r.lastName)}
                      </div>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${s.dotClass}`}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-semibold truncate">
                          {r.firstName} {r.lastName}
                        </span>
                        {r.jobTitle && (
                          <span className="text-muted-foreground truncate">• {r.jobTitle}</span>
                        )}
                        {r.excused && (
                          <Badge variant="secondary" className="ml-1 bg-blue-500/10 text-blue-700 border-blue-500/30">
                            <Gift className="h-3 w-3 mr-1" /> Day off on us
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {s.label} <span className="mx-1">/</span> {fmt(r.startTime)} - {fmt(r.endTime)}
                        {r.jobSiteName ? ` • ${r.jobSiteName}` : ''}
                      </div>
                    </div>
                    {canManage && !r.clockInAt && (
                      r.excused ? (
                        <Button size="sm" variant="ghost" onClick={() => revokeExcuse(r)}>
                          Undo
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setExcuseTarget(r); setReason(''); }}
                        >
                          <Gift className="h-3.5 w-3.5 mr-1.5" />
                          Give day off on us
                        </Button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={!!excuseTarget} onOpenChange={(o) => !o && setExcuseTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Give day off on us</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              This excuses <strong>{excuseTarget?.firstName} {excuseTarget?.lastName}</strong>'s shift today.
              They won't get a late/no-show alert, and it won't count against attendance or bonus eligibility.
              The shift stays on the schedule.
            </p>
            <div>
              <Label>Reason (optional)</Label>
              <Textarea
                placeholder="e.g. Customer cancelled — power outage"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExcuseTarget(null)} disabled={saving}>Cancel</Button>
            <Button onClick={grantExcuse} disabled={saving}>
              {saving ? 'Saving…' : 'Grant day off'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default ShiftRoster;