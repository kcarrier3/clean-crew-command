/** Types + period math for recurring (janitorial) invoicing. */

export type RecurringFrequency = 'monthly' | 'quarterly' | 'semiannual' | 'annual';

export const FREQUENCIES: { value: RecurringFrequency; label: string; months: number }[] = [
  { value: 'monthly', label: 'Monthly', months: 1 },
  { value: 'quarterly', label: 'Quarterly', months: 3 },
  { value: 'semiannual', label: 'Semi-annual', months: 6 },
  { value: 'annual', label: 'Annual', months: 12 },
];

export const frequencyMonths = (f: RecurringFrequency) =>
  FREQUENCIES.find(x => x.value === f)?.months ?? 1;

export type RecurringPeriodStatus = 'pending' | 'ready' | 'generated' | 'held' | 'skipped';

export const PERIOD_STATUS_LABEL: Record<RecurringPeriodStatus, string> = {
  pending: 'Pending setup',
  ready: 'Ready',
  generated: 'Generated',
  held: 'On hold',
  skipped: 'Skipped',
};

export const PERIOD_STATUS_CLASS: Record<RecurringPeriodStatus, string> = {
  pending: 'bg-muted text-muted-foreground',
  ready: 'bg-blue-100 text-blue-800',
  generated: 'bg-green-100 text-green-800',
  held: 'bg-amber-100 text-amber-900',
  skipped: 'bg-muted text-muted-foreground line-through',
};

export interface RecurringSchedule {
  id: string;
  job_site_id: string;
  active: boolean;
  amount: number;
  frequency: RecurringFrequency;
  billing_day_rule: 'day_of_month' | 'last_day';
  billing_day: number;
  service_period: 'current' | 'prior';
  payment_terms: string | null;
  po_number: string | null;
  po_required: boolean;
  billing_contact_name: string | null;
  billing_email: string | null;
  tax_rate: number;
  invoice_description: string | null;
  notes: string | null;
  crm_company_id: string | null;
  crm_deal_id: string | null;
  next_invoice_date: string | null;
}

export interface RecurringPeriod {
  id: string;
  schedule_id: string;
  job_site_id: string;
  period_start: string;
  period_end: string;
  status: RecurringPeriodStatus;
  reason: string | null;
  amount: number | null;
  invoice_id: string | null;
  generated_at: string | null;
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** First day of the month containing `d` (accepts 'YYYY-MM' or a date string). */
export const monthStart = (d: string | Date): string => {
  const dt = typeof d === 'string'
    ? new Date(`${d.length === 7 ? `${d}-01` : d.slice(0, 10)}T00:00:00`)
    : d;
  return iso(new Date(dt.getFullYear(), dt.getMonth(), 1));
};

export const addMonths = (isoDate: string, n: number): string => {
  const d = new Date(`${isoDate}T00:00:00`);
  return iso(new Date(d.getFullYear(), d.getMonth() + n, 1));
};

/** Inclusive end date of a period starting at `start` for the given frequency. */
export const periodEnd = (start: string, frequency: RecurringFrequency): string => {
  const d = new Date(`${start}T00:00:00`);
  const end = new Date(d.getFullYear(), d.getMonth() + frequencyMonths(frequency), 0);
  return iso(end);
};

export const lastDayOfMonth = (isoDate: string): string => {
  const d = new Date(`${isoDate}T00:00:00`);
  return iso(new Date(d.getFullYear(), d.getMonth() + 1, 0));
};

/**
 * Invoice date for a service period.
 * `current` bills inside the service month; `prior` bills the month after service.
 */
export const invoiceDateForPeriod = (
  periodStart: string,
  s: Pick<RecurringSchedule, 'billing_day_rule' | 'billing_day' | 'service_period'>,
): string => {
  const billingMonth = s.service_period === 'prior' ? addMonths(periodStart, 1) : periodStart;
  if (s.billing_day_rule === 'last_day') return lastDayOfMonth(billingMonth);
  const d = new Date(`${billingMonth}T00:00:00`);
  return iso(new Date(d.getFullYear(), d.getMonth(), Math.min(Math.max(s.billing_day || 1, 1), 28)));
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

export const periodLabel = (periodStart: string, frequency: RecurringFrequency = 'monthly'): string => {
  const d = new Date(`${periodStart}T00:00:00`);
  if (frequency === 'monthly') return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  const end = new Date(`${periodEnd(periodStart, frequency)}T00:00:00`);
  return `${MONTHS[d.getMonth()]}–${MONTHS[end.getMonth()]} ${end.getFullYear()}`;
};

/** Renders the invoice line description, supporting {{period}} / {{account}}. */
export const renderInvoiceDescription = (
  template: string | null | undefined,
  vars: { period: string; account: string },
): string =>
  (template && template.trim() ? template : 'Janitorial Services — {{period}}')
    .replace(/\{\{\s*period\s*\}\}/g, vars.period)
    .replace(/\{\{\s*account\s*\}\}/g, vars.account);

/** Does this schedule bill in the given period-start month? */
export const scheduleBillsPeriod = (s: RecurringSchedule, periodStart: string): boolean => {
  const months = frequencyMonths(s.frequency);
  if (months === 1) return true;
  const d = new Date(`${periodStart}T00:00:00`);
  const anchor = s.next_invoice_date
    ? new Date(`${monthStart(s.next_invoice_date)}T00:00:00`)
    : new Date(d.getFullYear(), 0, 1);
  const diff = (d.getFullYear() - anchor.getFullYear()) * 12 + (d.getMonth() - anchor.getMonth());
  return diff % months === 0;
};

/** Months to show in the period selector: 6 back, 3 forward from today. */
export const periodOptions = (): string[] => {
  const now = new Date();
  const out: string[] = [];
  for (let i = -6; i <= 3; i += 1) out.push(iso(new Date(now.getFullYear(), now.getMonth() + i, 1)));
  return out.reverse();
};

export const currentPeriodStart = (): string => monthStart(new Date());
