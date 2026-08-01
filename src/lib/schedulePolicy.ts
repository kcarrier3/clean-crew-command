// Company scheduling & time-off policy helpers.
// Work week runs Sunday -> Saturday.

export type ScheduleDepartment = 'janitorial' | 'project';

/** Day of week the schedule must be posted (0 = Sunday). */
export const SCHEDULE_POST_DAY: Record<ScheduleDepartment, number> = {
  janitorial: 3, // Wednesday
  project: 5, // Friday
};

export const SCHEDULE_DEPARTMENT_LABEL: Record<ScheduleDepartment, string> = {
  janitorial: 'Janitorial',
  project: 'Project / Construction',
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Sunday that begins the work week containing `date`. */
export function workWeekStart(date: Date): Date {
  const d = startOfDay(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

/**
 * Posting deadline for the work week beginning on `weekStartSunday`:
 * the department's posting day during the PRIOR week, end of day.
 */
export function schedulePostingDeadline(weekStartSunday: Date, dept: ScheduleDepartment): Date {
  const prevSunday = new Date(weekStartSunday);
  prevSunday.setDate(prevSunday.getDate() - 7);
  const deadline = new Date(prevSunday);
  deadline.setDate(deadline.getDate() + SCHEDULE_POST_DAY[dept]);
  deadline.setHours(23, 59, 59, 999);
  return deadline;
}

/**
 * Time-off cutoff: 12:00 PM on the Wednesday of the week prior to the
 * work week (Sunday–Saturday) the requested time off falls in.
 */
export function timeOffCutoffFor(startDate: Date | string): Date {
  const base = typeof startDate === 'string' ? parseISODate(startDate) : startDate;
  const sunday = workWeekStart(base);
  const cutoff = new Date(sunday);
  cutoff.setDate(cutoff.getDate() - 4); // prior Wednesday
  cutoff.setHours(12, 0, 0, 0);
  return cutoff;
}

export function isPastTimeOffCutoff(startDate: Date | string, now: Date = new Date()): boolean {
  return now.getTime() > timeOffCutoffFor(startDate).getTime();
}

/** Parse a yyyy-mm-dd string as a local date (avoids UTC shift). */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function formatDeadline(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatCutoff(d: Date): string {
  return `${d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })} at 12:00 PM`;
}
