import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Edit2,
  Trash2,
  FileText,
  MapPin,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Employee {
  id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  job_title: string;
  user_id?: string | null;
}

interface JobSite {
  id: string;
  name: string;
  address: string;
  client_name: string;
}

interface Schedule {
  id: string;
  employee_id: string;
  job_site_id: string;
  start_time: string;
  end_time: string;
  days_of_week: number[];
  start_date: string;
  end_date: string | null;
  notes: string | null;
  active: boolean;
  employees: Employee;
  job_sites: JobSite;
}

interface WeeklyScheduleViewProps {
  schedules: Schedule[];
  sortBy: 'alphabetical' | 'job_title';
  onEdit: (schedule: Schedule) => void;
  onDelete: (scheduleId: string) => void;
}

const WeeklyScheduleView = ({ schedules, sortBy, onEdit, onDelete }: WeeklyScheduleViewProps) => {
  // Week anchor = Monday of the currently viewed week
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeekMon(new Date()));
  const [rateByUserId, setRateByUserId] = useState<Record<string, number>>({});

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const weekEnd = weekDays[6];

  // Fetch hourly rates from profiles for wage totals
  useEffect(() => {
    const userIds = Array.from(
      new Set(
        schedules
          .map((s) => s.employees.user_id)
          .filter((v): v is string => !!v),
      ),
    );
    if (userIds.length === 0) return;
    supabase
      .from('profiles')
      .select('id, hourly_rate')
      .in('id', userIds)
      .then(({ data }) => {
        const map: Record<string, number> = {};
        (data || []).forEach((p: any) => {
          if (p.hourly_rate != null) map[p.id] = Number(p.hourly_rate);
        });
        setRateByUserId(map);
      });
  }, [schedules]);

  // Unique employees sorted
  const employees = useMemo(() => {
    const list = Array.from(
      new Map(schedules.map((s) => [s.employee_id, s.employees])).values(),
    );
    return list.sort((a, b) => {
      if (sortBy === 'job_title') {
        const t = a.job_title.localeCompare(b.job_title);
        if (t !== 0) return t;
      }
      return a.first_name.localeCompare(b.first_name);
    });
  }, [schedules, sortBy]);

  // Determine which shifts fall on a given date for a given employee
  const getShiftsFor = (employeeId: string, date: Date) => {
    const dayNum = ((date.getDay() + 6) % 7) + 1; // Mon=1..Sun=7
    const iso = toISODate(date);
    return schedules.filter((s) => {
      if (s.employee_id !== employeeId) return false;
      if (!s.days_of_week.includes(dayNum)) return false;
      if (s.start_date && s.start_date > iso) return false;
      if (s.end_date && s.end_date < iso) return false;
      return true;
    });
  };

  const employeeStats = (employeeId: string) => {
    let hours = 0;
    weekDays.forEach((d) => {
      getShiftsFor(employeeId, d).forEach((s) => {
        hours += shiftHours(s.start_time, s.end_time);
      });
    });
    const emp = employees.find((e) => e.id === employeeId);
    const rate = (emp?.user_id && rateByUserId[emp.user_id]) || 0;
    return { hours, wages: hours * rate };
  };

  const dayTotals = (date: Date) => {
    let hours = 0;
    let wages = 0;
    let people = 0;
    employees.forEach((emp) => {
      const shifts = getShiftsFor(emp.id, date);
      if (shifts.length === 0) return;
      people += 1;
      const rate = (emp.user_id && rateByUserId[emp.user_id]) || 0;
      shifts.forEach((s) => {
        const h = shiftHours(s.start_time, s.end_time);
        hours += h;
        wages += h * rate;
      });
    });
    return { hours, wages, people };
  };

  const isToday = (d: Date) => toISODate(d) === toISODate(new Date());

  return (
    <Card className="overflow-hidden border-border">
      {/* Top toolbar */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b bg-background">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => setWeekStart(startOfWeekMon(new Date()))}
          >
            Today
          </Button>
          <div className="flex items-center gap-1 border rounded-md px-3 py-1.5 text-sm">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">
              {formatRange(weekStart, weekEnd)}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="text-sm text-muted-foreground border rounded-md px-3 py-1.5 ml-1">
            Week
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[1100px]">
          {/* Header row */}
          <div className="grid grid-cols-[240px_repeat(7,minmax(0,1fr))] border-b bg-muted/30">
            <div className="px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground">
              View by <span className="font-semibold text-foreground">{sortBy === 'alphabetical' ? 'First name' : 'Job title'}</span>
            </div>
            {weekDays.map((d) => (
              <div
                key={d.toISOString()}
                className="px-3 py-3 text-center border-l"
              >
                <div
                  className={`inline-flex items-center justify-center px-3 py-0.5 rounded-full text-sm font-medium ${
                    isToday(d)
                      ? 'border border-primary text-primary'
                      : 'text-foreground'
                  }`}
                >
                  {d.toLocaleDateString(undefined, { weekday: 'short' })},{' '}
                  {d.getDate()}
                </div>
              </div>
            ))}
          </div>

          {/* Section label */}
          <div className="px-4 py-2 text-xs font-semibold text-muted-foreground border-b bg-background">
            Team members ({employees.length})
          </div>

          {/* Employee rows */}
          {employees.length === 0 && (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No schedules created yet.
            </div>
          )}

          {employees.map((emp) => {
            const stats = employeeStats(emp.id);
            return (
              <div
                key={emp.id}
                className="grid grid-cols-[240px_repeat(7,minmax(0,1fr))] border-b hover:bg-muted/20 transition"
              >
                {/* Person column */}
                <div className="px-3 py-2 flex items-center gap-2 border-r bg-background">
                  <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                    {initials(emp.first_name, emp.last_name)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium leading-tight truncate">
                      {emp.first_name} {emp.last_name}
                    </div>
                    <div className="text-[11px] text-muted-foreground leading-tight">
                      {stats.hours.toFixed(2)} hrs / ${stats.wages.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {emp.job_title}
                    </div>
                  </div>
                </div>

                {/* Day cells */}
                {weekDays.map((d) => {
                  const shifts = getShiftsFor(emp.id, d);
                  return (
                    <div
                      key={d.toISOString()}
                      className="border-l p-1 min-h-[70px] space-y-1"
                    >
                      {shifts.map((s) => (
                        <ShiftBlock
                          key={s.id}
                          schedule={s}
                          onEdit={onEdit}
                          onDelete={onDelete}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Footer totals */}
          {employees.length > 0 && (
            <div className="grid grid-cols-[240px_repeat(7,minmax(0,1fr))] border-t bg-muted/40 sticky bottom-0">
              <div className="px-3 py-2 text-xs font-semibold border-r">
                <div>Wages</div>
                <div className="text-muted-foreground">Hours</div>
              </div>
              {weekDays.map((d) => {
                const t = dayTotals(d);
                return (
                  <div
                    key={d.toISOString()}
                    className="px-2 py-2 border-l text-xs"
                  >
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        👥 {t.people}
                      </span>
                      <span className="font-semibold">
                        ${t.wages.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-right text-muted-foreground">
                      {t.hours.toFixed(2)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

/* ------------ Shift block ------------ */
function ShiftBlock({
  schedule,
  onEdit,
  onDelete,
}: {
  schedule: Schedule;
  onEdit: (s: Schedule) => void;
  onDelete: (id: string) => void;
}) {
  const colors = jobColor(schedule.employees.job_title);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`w-full text-left rounded-md px-2 py-1.5 text-white shadow-sm hover:brightness-110 transition ${colors}`}
          title={schedule.notes || ''}
        >
          <div className="text-[11px] font-semibold leading-tight">
            {shortTime(schedule.start_time)}–{shortTime(schedule.end_time)}
          </div>
          <div className="text-[10px] leading-tight opacity-90 flex items-center gap-1 truncate">
            <MapPin className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">{schedule.job_sites.name}</span>
          </div>
          {schedule.notes && (
            <div className="text-[10px] leading-tight opacity-90 flex items-center gap-1">
              <FileText className="h-2.5 w-2.5" /> Notes
            </div>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={() => onEdit(schedule)}>
          <Edit2 className="h-4 w-4 mr-2" /> Edit shift
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onDelete(schedule.id)}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-2" /> Delete shift
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ------------ Helpers ------------ */
function startOfWeekMon(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0=Sun..6=Sat
  const diff = (day + 6) % 7; // days since Monday
  x.setDate(x.getDate() - diff);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function formatRange(start: Date, end: Date) {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const yr = end.getFullYear();
  return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}, ${yr}`;
}
function shiftHours(start: string, end: string) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  return mins / 60;
}
function shortTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'pm' : 'am';
  const hh = ((h + 11) % 12) + 1;
  return m === 0 ? `${hh}${period}` : `${hh}:${String(m).padStart(2, '0')}${period}`;
}
function initials(f: string, l: string) {
  return `${(f || '').charAt(0)}${(l || '').charAt(0)}`.toUpperCase();
}
function jobColor(title: string) {
  const map: Record<string, string> = {
    Owner: 'bg-violet-600',
    Manager: 'bg-rose-600',
    'Office Manager': 'bg-indigo-600',
    'Operations Manager': 'bg-indigo-600',
    'Night Manager': 'bg-amber-500',
    'Janitorial Manager': 'bg-rose-500',
    'Project Crew Lead': 'bg-orange-500',
    'Project Worker': 'bg-sky-600',
    'Construction Crew': 'bg-orange-500',
    'Janitorial Staff': 'bg-sky-600',
    Janitor: 'bg-sky-600',
    Floater: 'bg-rose-600',
    Floaters: 'bg-rose-600',
    Supply: 'bg-emerald-600',
    'Supply Management': 'bg-emerald-600',
  };
  return map[title] || 'bg-slate-600';
}

export default WeeklyScheduleView;