import { supabase } from '@/integrations/supabase/client';
import { db } from './billingApi';
import { dueDateFromTerms } from '@/lib/billing/kpi';
import {
  invoiceDateForPeriod, periodEnd, periodLabel, scheduleBillsPeriod,
  type RecurringLine, type RecurringPeriod, type RecurringSchedule, type RecurringScheduleStatus,
} from '@/lib/billing/recurring';
import {
  planInvoiceBatches, scheduleAmount, type PlanSchedule,
} from '@/lib/billing/recurringPlan';
import { fetchCompanyAddress } from '@/lib/billing/taxRates';

export interface RecurringSite {
  id: string;
  name: string;
  client_name: string | null;
  crm_company_id: string | null;
  crm_deal_id: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  county?: string | null;
  tax_exempt?: boolean | null;
  tax_exemption_reason?: string | null;
}

export interface RecurringLastInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  sent_at: string | null;
  last_emailed_at: string | null;
  email_status: string | null;
  job_site_id: string | null;
  recurring_schedule_id: string | null;
  recurring_group_key: string | null;
}

export interface RecurringRow {
  site: RecurringSite;
  schedule: RecurringSchedule | null;
  lines: RecurringLine[];
  period: RecurringPeriod | null;
  lastInvoice: RecurringLastInvoice | null;
}

const rowKey = (r: Pick<RecurringRow, 'site' | 'schedule'>) => r.schedule?.id ?? `site:${r.site.id}`;
export { rowKey as recurringRowKey };

const asSchedule = (raw: any): RecurringSchedule => ({
  ...raw,
  label: raw.label || 'Monthly service',
  status: (raw.status || (raw.active ? 'active' : 'inactive')) as RecurringScheduleStatus,
  cc_recipients: raw.cc_recipients ?? [],
  reply_to_email: raw.reply_to_email ?? null,
  memo: raw.memo ?? null,
  start_date: raw.start_date ?? null,
  consolidated: !!raw.consolidated,
  qb_last_sent_on: raw.qb_last_sent_on ?? null,
  qb_last_email_status: raw.qb_last_email_status ?? null,
});

const SITE_COLUMNS = 'id, name, client_name, crm_company_id, crm_deal_id, address, city, state, postal_code, county, tax_exempt, tax_exemption_reason';

/** One row per schedule. A site with no schedule still appears once so it can be set up. */
export const fetchRecurringRows = async (periodStart: string): Promise<RecurringRow[]> => {
  const { data: sites, error } = await db
    .from('job_sites')
    .select(SITE_COLUMNS)
    .eq('is_recurring_monthly', true)
    .eq('active', true)
    .order('name');
  if (error) throw error;
  const ids = (sites ?? []).map((s: RecurringSite) => s.id);
  if (!ids.length) return [];

  const [{ data: schedules }, { data: periods }, { data: invoices }] = await Promise.all([
    db.from('recurring_billing_schedules').select('*').in('job_site_id', ids),
    db.from('recurring_billing_periods').select('*').in('job_site_id', ids).eq('period_start', periodStart),
    db.from('billing_invoices')
      .select('id, invoice_number, invoice_date, sent_at, last_emailed_at, email_status, job_site_id, recurring_schedule_id, recurring_group_key')
      .eq('is_recurring', true).neq('status', 'void')
      .order('invoice_date', { ascending: false }),
  ]);

  const scheduleIds = (schedules ?? []).map((s: { id: string }) => s.id);
  const { data: lineRows } = scheduleIds.length
    ? await db.from('recurring_billing_lines').select('*').in('schedule_id', scheduleIds).order('sort_order')
    : { data: [] };

  const linesBySchedule: Record<string, RecurringLine[]> = {};
  (lineRows ?? []).forEach((l: any) => {
    (linesBySchedule[l.schedule_id] ??= []).push(l);
  });
  const periodBySchedule: Record<string, RecurringPeriod> = {};
  (periods ?? []).forEach((p: RecurringPeriod) => { periodBySchedule[p.schedule_id] = p; });

  const invoiceFor = (scheduleId: string, siteId: string): RecurringLastInvoice | null => {
    const match = (invoices ?? []).find((inv: RecurringLastInvoice) =>
      inv.recurring_schedule_id === scheduleId
      || (inv.job_site_id === siteId && !inv.recurring_schedule_id));
    return match ?? null;
  };

  const bySite: Record<string, RecurringSite> = {};
  (sites ?? []).forEach((s: RecurringSite) => { bySite[s.id] = s; });

  const rows: RecurringRow[] = [];
  const sitesWithSchedule = new Set<string>();
  for (const raw of schedules ?? []) {
    const schedule = asSchedule(raw);
    const site = bySite[schedule.job_site_id];
    if (!site) continue;
    sitesWithSchedule.add(site.id);
    rows.push({
      site,
      schedule,
      lines: linesBySchedule[schedule.id] ?? [],
      period: periodBySchedule[schedule.id] ?? null,
      lastInvoice: invoiceFor(schedule.id, site.id),
    });
  }
  for (const site of sites ?? []) {
    if (!sitesWithSchedule.has(site.id)) {
      rows.push({ site, schedule: null, lines: [], period: null, lastInvoice: null });
    }
  }
  rows.sort((a, b) => a.site.name.localeCompare(b.site.name) || (a.schedule?.label ?? '').localeCompare(b.schedule?.label ?? ''));
  return rows;
};

export interface ScheduleDraft {
  id?: string;
  label: string;
  status: RecurringScheduleStatus;
  frequency: RecurringSchedule['frequency'];
  billing_day_rule: RecurringSchedule['billing_day_rule'];
  billing_day: number;
  service_period: RecurringSchedule['service_period'];
  payment_terms: string | null;
  po_number: string | null;
  po_required: boolean;
  billing_contact_name: string | null;
  billing_email: string | null;
  cc_recipients: string[];
  reply_to_email: string | null;
  memo: string | null;
  start_date: string | null;
  consolidated: boolean;
  invoice_description: string | null;
  notes: string | null;
  crm_company_id: string | null;
  crm_deal_id: string | null;
  next_invoice_date: string | null;
  lines: RecurringLine[];
}

export const saveRecurringSchedule = async (jobSiteId: string, draft: ScheduleDraft): Promise<string> => {
  const { data: u } = await supabase.auth.getUser();
  const amount = scheduleAmount(draft.lines);
  const payload = {
    job_site_id: jobSiteId,
    label: draft.label.trim() || 'Monthly service',
    status: draft.status,
    amount,
    frequency: draft.frequency,
    billing_day_rule: draft.billing_day_rule,
    billing_day: draft.billing_day,
    service_period: draft.service_period,
    payment_terms: draft.payment_terms,
    po_number: draft.po_number,
    po_required: draft.po_required,
    billing_contact_name: draft.billing_contact_name,
    billing_email: draft.billing_email,
    cc_recipients: draft.cc_recipients,
    reply_to_email: draft.reply_to_email,
    memo: draft.memo,
    start_date: draft.start_date,
    consolidated: draft.consolidated,
    invoice_description: draft.invoice_description,
    notes: draft.notes,
    crm_company_id: draft.crm_company_id,
    crm_deal_id: draft.crm_deal_id,
    next_invoice_date: draft.next_invoice_date,
    created_by: u?.user?.id ?? null,
  };
  const write = draft.id
    ? db.from('recurring_billing_schedules').update(payload).eq('id', draft.id).select('id').single()
    : db.from('recurring_billing_schedules').insert(payload).select('id').single();
  const { data, error } = await write;
  if (error) throw error;
  const scheduleId = data.id as string;
  await db.from('recurring_billing_lines').delete().eq('schedule_id', scheduleId);
  if (draft.lines.length) {
    const { error: lineErr } = await db.from('recurring_billing_lines').insert(draft.lines.map((l, i) => ({
      schedule_id: scheduleId,
      billing_item_id: l.billing_item_id,
      description: l.description.trim() || 'Janitorial Services',
      quantity: Number(l.quantity) || 1,
      rate: Number(l.rate) || 0,
      taxable: l.taxable !== false,
      sort_order: i,
    })));
    if (lineErr) throw lineErr;
  }
  if (draft.crm_company_id) {
    await db.from('billing_account_preferences').upsert({
      crm_company_id: draft.crm_company_id,
      primary_billing_email: draft.billing_email,
      cc_recipients: draft.cc_recipients,
      reply_to_email: draft.reply_to_email,
      po_required: draft.po_required,
      default_terms: draft.payment_terms,
      consolidated_invoicing: draft.consolidated,
    }, { onConflict: 'crm_company_id' });
  }
  return scheduleId;
};

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
    amount: scheduleAmount(row.lines.length ? row.lines : [{ quantity: 1, rate: Number(row.schedule.amount || 0) }]),
    status,
    reason: reason ?? null,
  }, { onConflict: 'schedule_id,period_start' });
  if (error) throw error;
};

const toPlan = (row: RecurringRow): PlanSchedule | null => {
  if (!row.schedule) return null;
  const lines = row.lines.length
    ? row.lines
    : [{ billing_item_id: null, description: row.schedule.invoice_description || 'Janitorial Services', quantity: 1, rate: Number(row.schedule.amount || 0), taxable: true }];
  return {
    id: row.schedule.id,
    jobSiteId: row.site.id,
    siteName: row.site.name,
    companyId: row.schedule.crm_company_id,
    billingEmail: row.schedule.billing_email,
    consolidated: row.schedule.consolidated,
    status: row.schedule.status,
    poRequired: row.schedule.po_required,
    poNumber: row.schedule.po_number,
    lines: lines.map(l => ({
      billingItemId: l.billing_item_id,
      description: l.description,
      quantity: Number(l.quantity),
      rate: Number(l.rate),
      taxable: l.taxable !== false,
    })),
    alreadyInvoicedId: row.period?.status === 'generated' ? row.period.invoice_id : null,
  };
};

async function consolidatedSiblings(anchor: RecurringRow, periodStart: string): Promise<RecurringRow[]> {
  const s = anchor.schedule;
  if (!s?.consolidated || !s.crm_company_id) return [anchor];
  const { data: schedules } = await db.from('recurring_billing_schedules').select('*')
    .eq('crm_company_id', s.crm_company_id)
    .eq('consolidated', true)
    .eq('billing_email', s.billing_email);
  const list = (schedules ?? []).map(asSchedule).filter(sch => scheduleBillsPeriod(sch, periodStart));
  if (!list.length) return [anchor];
  const siteIds = [...new Set(list.map(sch => sch.job_site_id))];
  const scheduleIds = list.map(sch => sch.id);
  const [{ data: sites }, { data: lines }, { data: periods }] = await Promise.all([
    db.from('job_sites').select(SITE_COLUMNS).in('id', siteIds),
    db.from('recurring_billing_lines').select('*').in('schedule_id', scheduleIds),
    db.from('recurring_billing_periods').select('*').in('schedule_id', scheduleIds).eq('period_start', periodStart),
  ]);
  const siteById: Record<string, RecurringSite> = {};
  (sites ?? []).forEach((site: RecurringSite) => { siteById[site.id] = site; });
  const linesBy: Record<string, RecurringLine[]> = {};
  (lines ?? []).forEach((l: any) => { (linesBy[l.schedule_id] ??= []).push(l); });
  const periodBy: Record<string, RecurringPeriod> = {};
  (periods ?? []).forEach((p: RecurringPeriod) => { periodBy[p.schedule_id] = p; });
  return list.map(sch => ({
    site: siteById[sch.job_site_id] ?? anchor.site,
    schedule: sch,
    lines: linesBy[sch.id] ?? [],
    period: periodBy[sch.id] ?? null,
    lastInvoice: null,
  }));
}

export interface GenerateResult { ok: string[]; failed: { name: string; error: string }[] }

const insertBatch = async (batch: ReturnType<typeof planInvoiceBatches>['batches'][number], anchor: RecurringRow, periodStart: string) => {
  const s = anchor.schedule!;
  const pEnd = periodEnd(periodStart, s.frequency);
  const invoiceDate = invoiceDateForPeriod(periodStart, s);
  const { data: u } = await supabase.auth.getUser();
  const { data: numberData, error: numErr } = await db.rpc('next_invoice_number');
  if (numErr) throw numErr;

  const primary = batch.jobSiteId;
  let billTo = { name: anchor.site.client_name || anchor.site.name, address: anchor.site.address ?? null, city: anchor.site.city ?? null, state: anchor.site.state ?? null, zip: anchor.site.postal_code ?? null };
  if (batch.companyId) {
    const co = await fetchCompanyAddress(batch.companyId);
    if (co) billTo = { name: co.name || billTo.name, address: co.address ?? null, city: co.city ?? null, state: co.state ?? null, zip: co.zip ?? null };
  }
  const groupKey = batch.consolidated ? batch.key : null;

  const { data: invoice, error } = await db.from('billing_invoices').insert({
    invoice_number: numberData,
    job_site_id: primary,
    crm_company_id: batch.companyId,
    crm_deal_id: s.crm_deal_id,
    customer_name: billTo.name,
    billing_contact_name: s.billing_contact_name,
    billing_email: batch.billingEmail,
    po_number: s.po_number,
    status: 'ready',
    invoice_date: invoiceDate,
    due_date: dueDateFromTerms(invoiceDate, s.payment_terms),
    payment_terms: s.payment_terms ?? 'Net 30',
    bill_to_name: billTo.name,
    bill_to_address: billTo.address,
    bill_to_city: billTo.city,
    bill_to_state: billTo.state,
    bill_to_zip: billTo.zip,
    ship_to_name: batch.consolidated ? null : anchor.site.name,
    ship_to_address: batch.consolidated ? null : anchor.site.address,
    ship_to_city: batch.consolidated ? null : anchor.site.city,
    ship_to_state: batch.consolidated ? null : anchor.site.state,
    ship_to_zip: batch.consolidated ? null : anchor.site.postal_code,
    notes: [s.memo, batch.consolidated ? 'Service location is on each line.' : null].filter(Boolean).join('\n\n') || null,
    is_recurring: true,
    recurring_period_start: periodStart,
    recurring_period_end: pEnd,
    recurring_schedule_id: groupKey ? null : batch.scheduleIds[0],
    recurring_group_key: groupKey,
    created_by: u?.user?.id ?? null,
  }).select('id').single();
  if (error) throw error;

  const { error: itemErr } = await db.from('billing_invoice_items').insert(batch.lines.map((l, i) => ({
    invoice_id: invoice.id,
    billing_item_id: l.billingItemId,
    description: l.description,
    quantity: l.quantity,
    unit_price: l.rate,
    taxable: l.taxable,
    job_site_id: l.jobSiteId,
    service_location: l.serviceLocation,
    sort_order: i,
  })));
  if (itemErr) throw itemErr;

  for (const scheduleId of batch.scheduleIds) {
    const memberLine = batch.lines.filter(l => l.scheduleId === scheduleId);
    const siteId = memberLine[0]?.jobSiteId ?? anchor.site.id;
    await db.from('recurring_billing_periods').upsert({
      schedule_id: scheduleId,
      job_site_id: siteId,
      period_start: periodStart,
      period_end: pEnd,
      amount: scheduleAmount(memberLine),
      status: 'generated',
      invoice_id: invoice.id,
      generated_at: new Date().toISOString(),
      generated_by: u?.user?.id ?? null,
      reason: null,
    }, { onConflict: 'schedule_id,period_start' });
  }
  return invoice.id as string;
};

/** Creates the recurring invoice for one schedule, merging consolidated siblings. Idempotent. */
export const generateRecurringInvoice = async (row: RecurringRow, periodStart: string): Promise<string> => {
  if (!row.schedule) throw new Error('No recurring billing schedule configured.');
  if (row.period?.status === 'generated' && row.period.invoice_id) return row.period.invoice_id;
  if (row.schedule.start_date && row.schedule.start_date > periodEnd(periodStart, row.schedule.frequency)) {
    throw new Error('This schedule has not started for this period.');
  }
  if (!scheduleBillsPeriod(row.schedule, periodStart)) throw new Error('This schedule does not bill in this period.');

  const group = await consolidatedSiblings(row, periodStart);
  const plans = group.map(toPlan).filter((p): p is PlanSchedule => !!p);
  const { batches, skipped } = planInvoiceBatches(plans, periodStart);
  const mine = skipped.find(s => s.scheduleId === row.schedule!.id);
  if (mine?.reason === 'already-invoiced') {
    const existing = group.find(g => g.schedule?.id === row.schedule!.id);
    if (existing?.period?.invoice_id) return existing.period.invoice_id;
  }
  const batch = batches.find(b => b.scheduleIds.includes(row.schedule!.id));
  if (!batch) {
    const reason = mine?.reason;
    if (reason === 'po-required') throw new Error('A PO number is required for this customer.');
    if (reason === 'no-amount') throw new Error('Recurring amount is not set.');
    if (reason === 'inactive' || reason === 'hold') throw new Error('Recurring billing is not active for this schedule.');
    throw new Error('Nothing to invoice for this schedule.');
  }
  try {
    return await insertBatch(batch, row, periodStart);
  } catch (e: any) {
    const message = String(e?.message ?? e);
    if (!/duplicate|unique/i.test(message)) throw e;
    const column = batch.consolidated ? 'recurring_group_key' : 'recurring_schedule_id';
    const value = batch.consolidated ? batch.key : batch.scheduleIds[0];
    const { data } = await db.from('billing_invoices').select('id')
      .eq(column, value).eq('recurring_period_start', periodStart).neq('status', 'void').maybeSingle();
    if (data?.id) return data.id as string;
    throw e;
  }
};

export const generateMany = async (rows: RecurringRow[], periodStart: string): Promise<GenerateResult> => {
  const out: GenerateResult = { ok: [], failed: [] };
  const seen = new Set<string>();
  for (const r of rows) {
    const key = r.schedule?.id ?? r.site.id;
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      const id = await generateRecurringInvoice(r, periodStart);
      out.ok.push(id);
    } catch (e: any) {
      out.failed.push({ name: `${r.site.name}${r.schedule ? ` (${r.schedule.label})` : ''}`, error: e.message ?? String(e) });
    }
  }
  return out;
};

export const confirmQbPrefill = async (prefillId: string, patch: {
  jobSiteId: string;
  companyId: string | null;
  label: string;
  billingEmail: string | null;
  lines: RecurringLine[];
  terms: string | null;
  billingDay: number;
  memo: string | null;
  consolidated: boolean;
  qbLastSentOn: string | null;
  qbLastEmailStatus: string | null;
}) => {
  const scheduleId = await saveRecurringSchedule(patch.jobSiteId, {
    label: patch.label,
    status: 'inactive',
    frequency: 'monthly',
    billing_day_rule: 'day_of_month',
    billing_day: patch.billingDay || 1,
    service_period: 'current',
    payment_terms: patch.terms,
    po_number: null,
    po_required: false,
    billing_contact_name: null,
    billing_email: patch.billingEmail,
    cc_recipients: [],
    reply_to_email: null,
    memo: patch.memo,
    start_date: null,
    consolidated: patch.consolidated,
    invoice_description: null,
    notes: null,
    crm_company_id: patch.companyId,
    crm_deal_id: null,
    next_invoice_date: null,
    lines: patch.lines,
  });
  await db.from('recurring_billing_schedules').update({
    qb_last_sent_on: patch.qbLastSentOn,
    qb_last_email_status: patch.qbLastEmailStatus,
  }).eq('id', scheduleId);
  const { data: existing } = await db.from('qb_recurring_prefill').select('confirmed_schedule_ids').eq('id', prefillId).maybeSingle();
  const ids = [...(existing?.confirmed_schedule_ids ?? []), scheduleId];
  const { error } = await db.from('qb_recurring_prefill').update({
    status: 'confirmed',
    job_site_id: patch.jobSiteId,
    confirmed_schedule_ids: ids,
  }).eq('id', prefillId);
  if (error) throw error;
  return scheduleId;
};

export const activateSchedules = async (scheduleIds: string[]) => {
  if (!scheduleIds.length) return;
  const { error } = await db.from('recurring_billing_schedules').update({ status: 'active' }).in('id', scheduleIds);
  if (error) throw error;
};
