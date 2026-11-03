
export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Number of times each selected weekday occurs in the given month. */
export function serviceDaysInMonth(serviceDays: number[], date: Date = new Date()): number {
  if (!serviceDays || serviceDays.length === 0) return 0;
  const year = date.getFullYear();
  const month = date.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    if (serviceDays.includes(new Date(year, month, d).getDay())) count++;
  }
  return count;
}

/** Monthly hour allotment derived from a nightly allowance + service days. */
export function monthlyHoursFromNightly(
  nightlyHours: number | null | undefined,
  serviceDays: number[] | null | undefined,
  date: Date = new Date()
): number | null {
  if (!nightlyHours || !serviceDays || serviceDays.length === 0) return null;
  return Math.round(nightlyHours * serviceDaysInMonth(serviceDays, date) * 100) / 100;
}

export function describeFrequency(serviceDays: number[] | null | undefined): string {
  if (!serviceDays || serviceDays.length === 0) return 'No service days set';
  const sorted = [...serviceDays].sort((a, b) => a - b);
  return `${sorted.length}x / week · ${sorted.map((d) => DAY_LABELS[d]).join(', ')}`;
}

/** Sum of each service night's allowance from the 1st of the month through `lastDay`. */
function sumAllowance(
  nightlyHours: number | null | undefined,
  byDay: Array<number | null> | null | undefined,
  serviceDays: number[],
  date: Date,
  lastDay: number
): number {
  const year = date.getFullYear();
  const month = date.getMonth();
  let total = 0;
  for (let d = 1; d <= lastDay; d++) {
    const dow = new Date(year, month, d).getDay();
    if (!serviceDays.includes(dow)) continue;
    total += byDay ? Number(byDay[dow]) || 0 : Number(nightlyHours) || 0;
  }
  return Math.round(total * 100) / 100;
}

/**
 * Monthly hours when each night can have its own allowance.
 * byDay has 7 entries (Sunday..Saturday); when it is set it replaces the flat nightly figure.
 */
export function monthlyHoursForSchedule(
  nightlyHours: number | null | undefined,
  byDay: Array<number | null> | null | undefined,
  serviceDays: number[] | null | undefined,
  date: Date = new Date()
): number | null {
  if (!byDay) return monthlyHoursFromNightly(nightlyHours, serviceDays, date);
  if (!serviceDays || serviceDays.length === 0) return null;
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return sumAllowance(null, byDay, serviceDays, date, daysInMonth);
}

/**
 * Hours the nightly allowance has allowed so far this month, counting every
 * service night from the 1st through `date` (inclusive).
 */
export function hoursAllowedToDate(
  nightlyHours: number | null | undefined,
  byDay: Array<number | null> | null | undefined,
  serviceDays: number[] | null | undefined,
  date: Date = new Date()
): number | null {
  if ((!nightlyHours && !byDay) || !serviceDays || serviceDays.length === 0) return null;
  return sumAllowance(nightlyHours, byDay, serviceDays, date, date.getDate());
}

/** "Mon 4h · Tue 3h" for the selected service days. */
export function describeNightlyByDay(byDay: Array<number | null>, serviceDays: number[]): string {
  return [...serviceDays].sort((a, b) => a - b).map((d) => `${DAY_LABELS[d]} ${Number(byDay[d]) || 0}h`).join(' · ');
}
