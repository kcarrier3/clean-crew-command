// Weekly supply billing: weeks run Sunday through Saturday, Eastern time (same as the pay week).

const nyDate = (now: Date): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

export const addDays = (d: string, n: number): string => {
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

/** Sunday that starts the week containing the given YYYY-MM-DD day. */
export const weekStartOf = (d: string): string => {
  const dow = new Date(`${d}T12:00:00Z`).getUTCDay();
  return addDays(d, -dow);
};

/** Sunday that starts last week, as seen in Eastern time right now. */
export const lastWeekStart = (now: Date = new Date()): string => addDays(weekStartOf(nyDate(now)), -7);

export interface WeekEvent { id: string; amount: number; status: 'ready' | 'hold' | string }
export interface WeekGroup { skip_reason: string | null; events: WeekEvent[] }

/** Ready items that Approve will bill: on-hold items and skipped accounts are left out. */
export const approvableEvents = (groups: WeekGroup[]): WeekEvent[] =>
  groups.filter(g => !g.skip_reason).flatMap(g => g.events.filter(e => e.status === 'ready'));

export const readyTotal = (g: WeekGroup): number =>
  Math.round(g.events.filter(e => e.status === 'ready').reduce((s, e) => s + Number(e.amount || 0), 0) * 100) / 100;
