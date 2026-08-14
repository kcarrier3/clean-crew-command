import { supabase } from '@/integrations/supabase/client';
import { db } from './billingApi';
import { dueDateFromTerms } from '@/lib/billing/kpi';
import {
  invoiceDateForPeriod, periodEnd, periodLabel, renderInvoiceDescription,
  type RecurringPeriod, type RecurringSchedule,
} from '@/lib/billing/recurring';

export interface RecurringRow {
  site: { id: string; name: string; client_name: string | null; crm_company_id: string | null; crm_deal_id: string | null };
  schedule: RecurringSchedule | null;
  period: RecurringPeriod | null;
  lastInvoice: { id: string; invoice_number: string; invoice_date: string } | null;
}

/** Loads every recurring monthly account with its schedule + the selected period's state. */
export const fetchRecurringRows = async (periodStart: string): Promise<RecurringRow[]> => {
  const { data: sites, error } = await db
    .from('job_sites')
    .select('id, name, client_name, crm_company_id, crm_deal_id, address, city, state')
    .eq('is_recurring_monthly', true)
    .eq('active', true)
    .order('name');
  if (error) throw error;
  const ids = (sites ?? []).map((s: any) => s.id);
  if (!ids.length) return [];

  const [{ data: schedules }, { data: periods }, { data: invoices }] = await Promise.all([
    db.from('recurring_billing_schedules').select('*').in('job_site_id', ids),
    db.from('recurring_billing_periods').select('*').in('job_site_id', ids).eq('period_start', periodStart),
    db.from('billing_invoices')
      .select('id, invoice_number, invoice_date, job_site_id')
      .in('job_site_id', ids).eq('is_recurring', true).neq('status', 'void')
      .order('invoice_date', { ascending: false }),
  ]);

  const bySite = <T extends { job_site_id: string }>(rows: T[] | null) => {
    const m: Record<string, T> = {};
    (rows ?? []).forEach(r => { if (!m[r.job_site_id]) m[r.job_site_id] = r; });
    return m;
  };
  const sch = bySite<any>(schedules);
  const per = bySite<any>(periods);
  const inv = bySite<any>(invoices);

  return (sites ?? []).map((s: any) => ({
    site: s,
    schedule: sch[s.id] ?? null,
    period: per[s.id] ?? null,
    lastInvoice: inv[s.id] ?? null,
  }));
};

export const saveRecurringSchedule = async (
  jobSiteId: string,
  patch: Partial<RecurringSchedule>,
): Promise<RecurringSchedule> => {
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await db
    .from('recurring_billing_schedules')
    .upsert({ job_site_id: jobSiteId, created_by: u?.user?.id ?? null, ...patch },
      { onConflict: 'job_site_id' })
    .select().single();
  if (error) throw error;
  return data as RecurringSchedule;
};

/** Upserts the period row for a schedule and sets an explicit status. */
export const setPeriodStatus = async (
  row: RecurringRow,
  periodStart: string,
  status: RecurringPeriod['status'],
  reason?: string | null,
): Promise<void> => {
  if (!row.schedule) throw new Error('This account has no recurring billing schedule yet.');
  const { error } = await db.from('recurring_billing_periods').upsert({
    schedule_id: row.schedule.id,
    job_site_id: row.site.id,
    period_start: periodStart,
    period_end: periodEnd(periodStart, row.schedule.frequency),
    amount: Number(row.schedule.amount || 0),
    status,
    reason: reason ?? null,
  }, { onConflict: 'schedule_id,period_start' });
  if (error) throw error;
};

export interface GenerateResult { ok: string[]; failed: { name: string; error: string }[] }

/** Creates the recurring invoice for one account/period. Idempotent via the DB unique index. */
export const generateRecurringInvoice = async (
  row: RecurringRow,
  periodStart: string,
): Promise<string> => {
  const s = row.schedule;
  if (!s) throw new Error('No recurring billing schedule configured.');
  if (!s.active) throw new Error('Recurring billing is inactive for this account.');
  const amount = Number(s.amount || 0);
  if (amount <= 0) throw new Error('Recurring amount is not set.');
  if (s.po_required && !s.po_number) throw new Error('A PO number is required for this customer.');

  const pEnd = periodEnd(periodStart, s.frequency);
  const label = periodLabel(periodStart, s.frequency);

  // Guard in app as well as in the database.
  const { data: dupe } = await db.from('billing_invoices')
    .select('id').eq('job_site_id', row.site.id).eq('recurring_period_start', periodStart)
    .neq('status', 'void').maybeSingle();
  if (dupe?.id) return dupe.id as string;

  const { data: u } = await supabase.auth.getUser();
  const { data: numberData, error: numErr } = await db.rpc('next_invoice_number');
  if (numErr) throw numErr;

  const taxRate = Number(s.tax_rate || 0);
  const tax = Math.round(amount * (taxRate / 100) * 100) / 100;
  const total = Math.round((amount + tax) * 100) / 100;
  const invoiceDate = invoiceDateForPeriod(periodStart, s);

  const { data: invoice, error } = await db.from('billing_invoices').insert({
    invoice_number: numberData,
    job_site_id: row.site.id,
    crm_company_id: s.crm_company_id ?? row.site.crm_company_id ?? null,
    crm_deal_id: s.crm_deal_id ?? row.site.crm_deal_id ?? null,
    customer_name: row.site.client_name || row.site.name,
    billing_contact_name: s.billing_contact_name ?? null,
    billing_email: s.billing_email ?? null,
    po_number: s.po_number ?? null,
    status: 'ready',
    invoice_date: invoiceDate,
    due_date: dueDateFromTerms(invoiceDate, s.payment_terms),
    payment_terms: s.payment_terms ?? 'Net 30',
    subtotal: amount, tax_rate: taxRate, tax, total,
    balance_due: total,
    notes: s.notes ?? null,
    is_recurring: true,
    recurring_period_start: periodStart,
    recurring_period_end: pEnd,
    created_by: u?.user?.id ?? null,
  }).select().single();
  if (error) throw error;

  const { error: itemErr } = await db.from('billing_invoice_items').insert({
    invoice_id: invoice.id,
    description: renderInvoiceDescription(s.invoice_description, {
      period: label, account: row.site.client_name || row.site.name,
    }),
    quantity: 1,
    unit_price: amount,
    line_total: amount,
    sort_order: 0,
  });
  if (itemErr) throw itemErr;

  await db.from('recurring_billing_periods').upsert({
    schedule_id: s.id,
    job_site_id: row.site.id,
    period_start: periodStart,
    period_end: pEnd,
    amount,
    status: 'generated',
    invoice_id: invoice.id,
    generated_at: new Date().toISOString(),
    generated_by: u?.user?.id ?? null,
    reason: null,
  }, { onConflict: 'schedule_id,period_start' });

  return invoice.id as string;
};

export const generateMany = async (rows: RecurringRow[], periodStart: string): Promise<GenerateResult> => {
  const out: GenerateResult = { ok: [], failed: [] };
  for (const r of rows) {
    try {
      out.ok.push(await generateRecurringInvoice(r, periodStart));
    } catch (e: any) {
      out.failed.push({ name: r.site.client_name || r.site.name, error: e.message ?? String(e) });
    }
  }
  return out;
};
