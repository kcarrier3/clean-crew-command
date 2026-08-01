/**
 * Shift matching helpers.
 *
 * Workers rarely punch exactly at their scheduled start. These helpers take a
 * punch time and the employee's active recurring schedules and figure out which
 * scheduled shift the punch belongs to, so an early/late punch still counts as
 * "showed up" instead of being recorded as a no-show.
 */

export interface MatchableSchedule {
  id: string;
  job_site_id: string;
  start_time: string | null;
  end_time: string | null;
  days_of_week: number[] | null;
  [key: string]: any;
}

export interface ShiftMatch {
  schedule: MatchableSchedule;
  scheduledStart: Date;
  scheduledEnd: Date;
  /** Minutes between the scheduled start and the punch (negative = early). */
  minutesFromStart: number;
}

/** ISO day-of-week used by employee_schedules: 1 = Monday … 7 = Sunday. */
export const isoDay = (d: Date) => (d.getDay() === 0 ? 7 : d.getDay());

const withTime = (base: Date, time: string) => {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(base);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
};

/**
 * Build the concrete start/end for a schedule on a given calendar day,
 * rolling the end past midnight for overnight shifts.
 */
export const shiftWindowOn = (schedule: MatchableSchedule, day: Date): ShiftMatch | null => {
  if (!schedule.start_time) return null;
  const scheduledStart = withTime(day, schedule.start_time);
  const scheduledEnd = schedule.end_time
    ? withTime(day, schedule.end_time)
    : new Date(scheduledStart.getTime() + 8 * 60 * 60 * 1000);
  if (scheduledEnd <= scheduledStart) {
    scheduledEnd.setDate(scheduledEnd.getDate() + 1); // overnight shift
  }
  return { schedule, scheduledStart, scheduledEnd, minutesFromStart: 0 };
};

/**
 * Pick the scheduled shift a punch most likely belongs to.
 *
 * Considers yesterday / today / tomorrow (covers overnight shifts and punches
 * just before midnight) and returns the shift whose start is closest to the
 * punch, as long as the punch falls inside the tolerance window:
 * `earlyToleranceMinutes` before the start through `lateToleranceMinutes`
 * after the scheduled end.
 */
export const matchPunchToShift = (
  schedules: MatchableSchedule[],
  punchAt: Date,
  earlyToleranceMinutes = 120,
  lateToleranceMinutes = 120,
): ShiftMatch | null => {
  const candidates: ShiftMatch[] = [];

  for (const offset of [-1, 0, 1]) {
    const day = new Date(punchAt);
    day.setDate(day.getDate() + offset);
    const dow = isoDay(day);

    for (const schedule of schedules) {
      if (!schedule.days_of_week?.includes(dow)) continue;
      const window = shiftWindowOn(schedule, day);
      if (!window) continue;

      const earliest = window.scheduledStart.getTime() - earlyToleranceMinutes * 60_000;
      const latest = window.scheduledEnd.getTime() + lateToleranceMinutes * 60_000;
      const t = punchAt.getTime();
      if (t < earliest || t > latest) continue;

      candidates.push({
        ...window,
        minutesFromStart: Math.round((t - window.scheduledStart.getTime()) / 60_000),
      });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort(
    (a, b) => Math.abs(a.minutesFromStart) - Math.abs(b.minutesFromStart),
  );
  return candidates[0];
};
