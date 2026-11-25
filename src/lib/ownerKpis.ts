export interface KpiInvoice { status: string; invoice_date: string | null; due_date: string | null; total: number | null; balance_due: number | null; paid_at: string | null; }
export interface KpiWorkOrder { created_at: string; completed_at: string | null; }

const DAY = 86400000;
const NOT_OPEN = new Set(['draft', 'ready', 'void', 'voided', 'cancelled', 'paid']);

export const isOpen = (i: KpiInvoice) => !NOT_OPEN.has(i.status) && Number(i.balance_due ?? 0) > 0;
const day = (d: string) => new Date(d.length === 10 ? d + 'T00:00:00' : d).getTime();

export function arSplit(invoices: KpiInvoice[], now = new Date()) {
  let current = 0, past = 0, currentCount = 0, pastCount = 0;
  const aging = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90: 0 };
  for (const i of invoices.filter(isOpen)) {
    const bal = Number(i.balance_due);
    const late = i.due_date ? Math.floor((now.getTime() - day(i.due_date)) / DAY) : 0;
    if (late > 0) { past += bal; pastCount++; } else { current += bal; currentCount++; }
    if (late <= 0) aging.current += bal; else if (late <= 30) aging.d1_30 += bal;
    else if (late <= 60) aging.d31_60 += bal; else if (late <= 90) aging.d61_90 += bal; else aging.d90 += bal;
  }
  const total = current + past;
  return { total, current, past, currentCount, pastCount, aging,
    pastPct: total ? (past / total) * 100 : 0, currentPct: total ? (current / total) * 100 : 0 };
}

/** Average days from invoice date to paid, for invoices paid in the window. */
export function avgDaysToPay(invoices: KpiInvoice[], now = new Date(), windowDays = 365) {
  const since = now.getTime() - windowDays * DAY;
  const d = invoices.filter(i => i.paid_at && i.invoice_date && day(i.paid_at) >= since)
    .map(i => (day(i.paid_at!) - day(i.invoice_date!)) / DAY);
  return d.length ? d.reduce((a, b) => a + b, 0) / d.length : null;
}

/** AR turnover = billed in last 365 days / open AR; DSO = 365 / turnover. */
export function arTurnover(invoices: KpiInvoice[], now = new Date()) {
  const since = now.getTime() - 365 * DAY;
  const billed = invoices.filter(i => !NOT_OPEN.has(i.status) || i.status === 'paid')
    .filter(i => i.invoice_date && day(i.invoice_date) >= since)
    .reduce((s, i) => s + Number(i.total ?? 0), 0);
  const ar = arSplit(invoices, now).total;
  const turnover = ar > 0 ? billed / ar : null;
  return { billed, turnover, dso: turnover ? 365 / turnover : null };
}

export function avgWorkOrderHours(orders: KpiWorkOrder[]) {
  const h = orders.filter(o => o.completed_at).map(o => (day(o.completed_at!) - day(o.created_at)) / 3600000).filter(x => x >= 0);
  return h.length ? { hours: h.reduce((a, b) => a + b, 0) / h.length, count: h.length } : null;
}

export interface KpiSite { is_recurring_monthly: boolean | null; budgeted_hours: number | null; used_hours: number | null; current_month_used_hours: number | null; }
/** Janitorial compares this month's hours to the monthly budget; construction compares total hours to the project budget. */
export function budgetVsActual(sites: KpiSite[], recurring: boolean) {
  const list = sites.filter(s => !!s.is_recurring_monthly === recurring && Number(s.budgeted_hours ?? 0) > 0);
  const budgeted = list.reduce((a, s) => a + Number(s.budgeted_hours), 0);
  const actual = list.reduce((a, s) => a + Number((recurring ? s.current_month_used_hours : s.used_hours) ?? 0), 0);
  const over = list.filter(s => Number((recurring ? s.current_month_used_hours : s.used_hours) ?? 0) > Number(s.budgeted_hours)).length;
  return { budgeted, actual, pct: budgeted ? (actual / budgeted) * 100 : null, count: list.length, over };
}

/** Completed work orders with a due date that were finished on or before it. */
export function onTimePct(orders: { completed_at: string | null; due_date: string | null }[]) {
  const done = orders.filter(o => o.completed_at && o.due_date);
  if (!done.length) return null;
  const ok = done.filter(o => o.completed_at!.slice(0, 10) <= o.due_date!).length;
  return (ok / done.length) * 100;
}

/** Of staff hired at least a year ago, the share still active. */
export function retentionPct(people: { hire_date: string | null; active: boolean | null }[], now = new Date()) {
  const cutoff = new Date(now.getTime() - 365 * DAY).toISOString().slice(0, 10);
  const pool = people.filter(p => p.hire_date && p.hire_date <= cutoff);
  return pool.length ? { pct: (pool.filter(p => p.active).length / pool.length) * 100, count: pool.length } : null;
}
