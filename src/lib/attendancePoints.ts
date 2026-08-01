// Attendance point policy (Crew Compass)
// Call off / missed punch = 2 points, late punch (>5 min) = 0.5 points.
// Points reset at the start of each calendar quarter. 8 points = termination.

export const POINTS = {
  call_off: 2,
  missed_punch: 2,
  late_punch: 0.5,
} as const;

export const LATE_GRACE_MINUTES = 5;
export const TERMINATION_POINTS = 8;
export const WARNING_POINTS = 6;

export type PointType = keyof typeof POINTS | 'manual';

export function quarterOf(date: Date) {
  return Math.floor(date.getMonth() / 3) + 1;
}

export function quarterRange(date: Date = new Date()) {
  const q = quarterOf(date);
  const start = new Date(date.getFullYear(), (q - 1) * 3, 1);
  const end = new Date(date.getFullYear(), q * 3, 0);
  return { start, end, label: `${date.getFullYear()} Q${q}` };
}

export function pointStatus(points: number) {
  if (points >= TERMINATION_POINTS) return { label: 'Termination threshold', tone: 'destructive' as const };
  if (points >= WARNING_POINTS) return { label: 'Warning', tone: 'warning' as const };
  return { label: 'Good standing', tone: 'ok' as const };
}
