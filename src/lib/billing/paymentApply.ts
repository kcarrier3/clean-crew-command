/** How a customer payment is spread across open invoices, and how A/R is aged. */

export type ArBucket = 'current' | '30' | '60' | '90' | '90+';

export const AR_BUCKETS: ArBucket[] = ['current', '30', '60', '90', '90+'];

export const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const parseDay = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00`).getTime();

/** Days past the due date. Negative means not yet due. */
export const daysPastDue = (due: string, today: string) =>
  Math.floor((parseDay(today) - parseDay(due)) / 86_400_000);

export const arBucket = (due: string | null | undefined, today: string): ArBucket => {
  if (!due) return 'current';
  const days = daysPastDue(due, today);
  if (days <= 0) return 'current';
  if (days <= 30) return '30';
  if (days <= 60) return '60';
  if (days <= 90) return '90';
  return '90+';
};

export interface OpenInvoice {
  id: string;
  balance: number;
  dueDate: string | null;
}

export interface Allocation {
  invoiceId: string;
  amount: number;
}

/** Fills oldest-due invoices first. Anything left is unapplied credit, not a second invoice. */
export const allocatePayment = (amount: number, invoices: OpenInvoice[]): { allocations: Allocation[]; unapplied: number } => {
  let left = round2(amount);
  const ordered = invoices
    .filter(i => i.balance > 0)
    .slice()
    .sort((a, b) => (a.dueDate ?? '9999-12-31').localeCompare(b.dueDate ?? '9999-12-31'));
  const allocations: Allocation[] = [];
  for (const inv of ordered) {
    if (left <= 0) break;
    const take = round2(Math.min(left, inv.balance));
    if (take <= 0) continue;
    allocations.push({ invoiceId: inv.id, amount: take });
    left = round2(left - take);
  }
  return { allocations, unapplied: left };
};

export const unappliedAmount = (paymentAmount: number, applied: number[]) =>
  round2(paymentAmount - applied.reduce((s, n) => s + Number(n || 0), 0));

export interface AgingInvoice {
  id: string;
  customerId: string | null;
  customerName: string;
  balance: number;
  dueDate: string | null;
  status: string;
}

export const customerBalances = (invoices: AgingInvoice[], today: string) => {
  const map = new Map<string, { customerId: string | null; customerName: string; total: number; buckets: Record<ArBucket, number> }>();
  for (const inv of invoices) {
    if (inv.status === 'void' || inv.status === 'draft' || inv.balance <= 0) continue;
    const key = inv.customerId ?? inv.customerName;
    const row = map.get(key) ?? {
      customerId: inv.customerId,
      customerName: inv.customerName,
      total: 0,
      buckets: { current: 0, '30': 0, '60': 0, '90': 0, '90+': 0 },
    };
    const bucket = arBucket(inv.dueDate, today);
    row.buckets[bucket] = round2(row.buckets[bucket] + inv.balance);
    row.total = round2(row.total + inv.balance);
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
};

export const toCsv = (rows: Record<string, string | number | null | undefined>[]): string => {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const cell = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map(r => headers.map(h => cell(r[h])).join(','))].join('\n');
};
