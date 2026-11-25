// "In your court" rules. Settings live in app_settings key 'in_your_court'.
export interface CourtSettings {
  payroll: { enabled: boolean; titles: string[]; week_start_day: number };
  billing: { enabled: boolean; titles: string[]; recurring_days: number; project_days: number };
  i9: { enabled: boolean; titles: string[] };
  training: { enabled: boolean; titles: string[] };
  work_orders: { enabled: boolean; titles: string[] };
  work_orders_mine: { enabled: boolean; titles: string[] };
}

export const DEFAULT_COURT_SETTINGS: CourtSettings = {
  payroll: { enabled: true, titles: ['Office Manager'], week_start_day: 0 },
  billing: { enabled: true, titles: ['Office Manager'], recurring_days: 5, project_days: 15 },
  i9: { enabled: true, titles: ['Office Manager'] },
  training: { enabled: true, titles: ['Night Manager'] },
  work_orders: { enabled: true, titles: ['Night Manager'] },
  work_orders_mine: { enabled: true, titles: ['Project Worker', 'Project Crew Lead'] },
};

export function parseCourtSettings(raw: string | null | undefined): CourtSettings {
  try {
    const v = raw ? JSON.parse(raw) : {};
    return {
      payroll: { ...DEFAULT_COURT_SETTINGS.payroll, ...(v.payroll || {}) },
      billing: { ...DEFAULT_COURT_SETTINGS.billing, ...(v.billing || {}) },
      i9: { ...DEFAULT_COURT_SETTINGS.i9, ...(v.i9 || {}) },
      training: { ...DEFAULT_COURT_SETTINGS.training, ...(v.training || {}) },
      work_orders: { ...DEFAULT_COURT_SETTINGS.work_orders, ...(v.work_orders || {}) },
      work_orders_mine: { ...DEFAULT_COURT_SETTINGS.work_orders_mine, ...(v.work_orders_mine || {}) },
    };
  } catch {
    return DEFAULT_COURT_SETTINGS;
  }
}

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Most recently closed pay week. A week closes at 12:00 am on its next start day. */
export function lastClosedPayPeriod(now: Date, weekStartDay = 0): { start: string; end: string } {
  const cur = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const back = (cur.getDay() - weekStartDay + 7) % 7;
  const currentStart = new Date(cur); currentStart.setDate(cur.getDate() - back);
  const start = new Date(currentStart); start.setDate(currentStart.getDate() - 7);
  const end = new Date(currentStart); end.setDate(currentStart.getDate() - 1);
  return { start: ymd(start), end: ymd(end) };
}

export function daysPastDue(dueDate: string, now: Date): number {
  const [y, m, d] = dueDate.split('-').map(Number);
  const due = new Date(y, m - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((today.getTime() - due.getTime()) / 86400000);
}

/** Janitorial (recurring monthly) accounts use recurring_days; construction/projects use project_days. */
export function needsFollowUp(dueDate: string | null, isRecurring: boolean, s: CourtSettings['billing'], now: Date): boolean {
  if (!dueDate) return false;
  return daysPastDue(dueDate, now) >= (isRecurring ? s.recurring_days : s.project_days);
}

/** A submitted I-9 needs ID verification until a reviewer approves it. */
export function needsI9Verification(sub: { status: string; reviewed_at: string | null }): boolean {
  return sub.status === 'completed' && !sub.reviewed_at;
}

/** Work order follow-ups re-appear each day until the work order is completed. */
export function workOrderCourtKey(id: string, now: Date): string {
  return `wo:${id}:${ymd(now)}`;
}

/** A worker's own assigned work orders re-appear each day until completed. */
export function myWorkOrderCourtKey(id: string, now: Date): string {
  return `womine:${id}:${ymd(now)}`;
}
