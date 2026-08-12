/** Date math for billing KPIs (calendar + business days, A/R aging). */

const MS_DAY = 86_400_000;

export const calendarDays = (from: string | Date | null, to: string | Date | null): number | null => {
  if (!from || !to) return null;
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.max(0, Math.round((b - a) / MS_DAY));
};

/** Whole business days (Mon–Fri) between two instants, excluding the start day. */
export const businessDays = (from: string | Date | null, to: string | Date | null): number | null => {
  if (!from || !to) return null;
  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  if (end <= start) return 0;
  let count = 0;
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cursor < last) {
    cursor.setDate(cursor.getDate() + 1);
    const d = cursor.getDay();
    if (d !== 0 && d !== 6) count += 1;
  }
  return count;
};

export const ageInDays = (from: string | Date | null): number | null => calendarDays(from, new Date());

export const avg = (xs: number[]): number | null =>
  xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null;

export const pctWithin = (values: number[], threshold: number): number | null =>
  values.length ? Math.round((values.filter(v => v <= threshold).length / values.length) * 100) : null;

export type AgingBucket = '0-30' | '31-60' | '61-90' | '90+';

export const agingBucket = (dueOrInvoiceDate: string | null): AgingBucket => {
  const d = ageInDays(dueOrInvoiceDate) ?? 0;
  if (d <= 30) return '0-30';
  if (d <= 60) return '31-60';
  if (d <= 90) return '61-90';
  return '90+';
};

export const AGING_BUCKETS: AgingBucket[] = ['0-30', '31-60', '61-90', '90+'];

/** Due date from simple "Net N" terms. */
export const dueDateFromTerms = (invoiceDate: string, terms: string | null | undefined): string => {
  const m = /net\s*(\d+)/i.exec(terms ?? '');
  const days = m ? parseInt(m[1], 10) : 30;
  const d = new Date(`${invoiceDate}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};