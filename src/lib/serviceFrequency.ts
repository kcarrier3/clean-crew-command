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
