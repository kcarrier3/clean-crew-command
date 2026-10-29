import { supabase } from '@/integrations/supabase/client';
import { dueDateFromTerms } from '@/lib/billing/kpi';
import type { BillingEvent, Invoice } from '@/lib/billing/types';
import { buildPaymentLink, fetchOnlinePaymentConfig, isCollectionReady } from '@/lib/billing/onlinePayments';

/** Untyped handle — the billing tables are new and joined ad hoc. */
export const db = supabase as any;

export const fetchBillingEvents = async (statuses: string[]): Promise<BillingEvent[]> => {
  const { data, error } = await db
    .from('billing_events')
    .select('*')
    .in('status', statuses)
    .order('completed_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as BillingEvent[];
};

export const fetchInvoices = async (): Promise<Invoice[]> => {
  const { data, error } = await db
    .from('billing_invoices')
    .select('*')
    .order('invoice_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Invoice[];
};

/** Re-read an invoice after a write. Triggers own line totals, tax, credits, and balance. */
export const reloadInvoice = async (id: string): Promise<Invoice> => {
  const { data, error } = await db.from('billing_invoices').select('*').eq('id', id).single();
  if (error) throw error;
  return data as Invoice;
};

/** No-op write that forces the draft/ready tax trigger to run again. */
export const recomputeInvoice = async (invoice: { id: string; notes: string | null }): Promise<Invoice> => {
  const { error } = await db.from('billing_invoices').update({ notes: invoice.notes }).eq('id', invoice.id);
  if (error) throw error;
  return reloadInvoice(invoice.id);
};

export interface CreateInvoiceOptions {
  events: BillingEvent[];
  invoiceDate: string;
  terms: string;
  /** Ignored. Sales tax is calculated by the database when the invoice is saved. */
  taxRate?: number;
  poNumber?: string | null;
  billingEmail?: string | null;
  billingContactName?: string | null;
  customerName?: string | null;
  notes?: string | null;
  billTo?: { name?: string; address?: string; city?: string; state?: string; zip?: string } | null;
  shipTo?: { name?: string; address?: string; city?: string; state?: string; zip?: string } | null;
  taxJurisdiction?: string | null;
}

/** Turns one or more Ready to Bill events into a single invoice. */
export const createInvoiceFromEvents = async (o: CreateInvoiceOptions): Promise<Invoice> => {
  if (!o.events.length) throw new Error('Select at least one billable item.');

  const { data: userData } = await supabase.auth.getUser();
  const { data: numberData, error: numErr } = await db.rpc('next_invoice_number');
  if (numErr) throw numErr;

  const first = o.events[0];
  const earliest = o.events
    .map(e => e.completed_at)
    .sort()[0] ?? null;

  const { data: invoice, error } = await db.from('billing_invoices').insert({
    invoice_number: numberData,
    job_site_id: first.job_site_id,
    crm_company_id: first.crm_company_id,
    crm_lead_id: first.crm_lead_id,
    customer_name: o.customerName ?? null,
    billing_contact_name: o.billingContactName ?? null,
    billing_email: o.billingEmail ?? first.billing_email ?? null,
    po_number: o.poNumber ?? first.po_number ?? null,
    status: 'ready',
    invoice_date: o.invoiceDate,
    due_date: dueDateFromTerms(o.invoiceDate, o.terms),
    payment_terms: o.terms,
    bill_to_name: o.billTo?.name || null,
    bill_to_address: o.billTo?.address || null,
    bill_to_city: o.billTo?.city || null,
    bill_to_state: o.billTo?.state || null,
    bill_to_zip: o.billTo?.zip || null,
    ship_to_name: o.shipTo?.name || null,
    ship_to_address: o.shipTo?.address || null,
    ship_to_city: o.shipTo?.city || null,
    ship_to_state: o.shipTo?.state || null,
    ship_to_zip: o.shipTo?.zip || null,
    notes: o.notes ?? null,
    earliest_completed_at: earliest,
    created_by: userData?.user?.id ?? null,
  }).select().single();
  if (error) throw error;

  const items = o.events.map((e, idx) => ({
    invoice_id: invoice.id,
    description: e.description
      ? `${e.label}\n${e.description}`
      : e.billing_percent
        ? `${e.label} (${Number(e.billing_percent)}% of contract)`
        : e.label,
    quantity: 1,
    unit_price: Number(e.amount || 0),
    sort_order: idx,
  }));
  const { error: itemErr } = await db.from('billing_invoice_items').insert(items);
  if (itemErr) throw itemErr;

  const { error: evtErr } = await db.from('billing_events').update({
    status: 'invoiced',
    invoice_id: invoice.id,
    invoiced_at: new Date().toISOString(),
  }).in('id', o.events.map(e => e.id));
  if (evtErr) throw evtErr;

  // Attach a customer pay link when online collection is on by default.
  try {
    const payCfg = await fetchOnlinePaymentConfig();
    if (payCfg.default_on_new_invoices && isCollectionReady(payCfg)) {
      const link = buildPaymentLink(payCfg, invoice);
      if (link) {
        await db.from('billing_invoices').update({
          online_payment_enabled: true,
          payment_link_url: link,
          payment_processor: payCfg.processor,
        }).eq('id', invoice.id);
        invoice.online_payment_enabled = true;
        invoice.payment_link_url = link;
      }
    }
  } catch { /* pay link is optional — never block invoicing */ }

  return reloadInvoice(invoice.id);
};

/** Records a payment and allocates it across invoices; balances recalc in the DB. */
export const recordPayment = async (payment: {
  crm_company_id?: string | null;
  payer_name?: string | null;
  payment_date: string;
  amount: number;
  method: string;
  reference_number?: string | null;
  deposit_date?: string | null;
  deposit_account_label?: string | null;
  notes?: string | null;
  entry_source?: string;
}, allocations: { invoice_id: string; amount: number }[]) => {
  const { data: userData } = await supabase.auth.getUser();
  const { data: row, error } = await db.from('billing_payments')
    .insert({ ...payment, entered_by: userData?.user?.id ?? null })
    .select().single();
  if (error) throw error;

  const rows = allocations.filter(a => a.amount > 0).map(a => ({ ...a, payment_id: row.id }));
  if (rows.length) {
    const { error: allocErr } = await db.from('billing_payment_allocations').insert(rows);
    if (allocErr) throw allocErr;
  }
  return row;
};
export interface ManualInvoiceLine {
  billing_item_id?: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  /** Explicit per-line override. Omitted lets the item's taxable flag win. */
  taxable?: boolean;
}

/** Creates a stand-alone invoice with hand-entered lines (not tied to Ready to Bill events). */
export const createManualInvoice = async (o: {
  jobSiteId?: string | null; crmCompanyId?: string | null;
  customerName?: string | null; billingEmail?: string | null; poNumber?: string | null;
  invoiceDate: string; terms: string; taxRate?: number; notes?: string | null;
  lines: ManualInvoiceLine[];
}): Promise<Invoice> => {
  const lines = o.lines.filter(l => l.description.trim() && l.quantity > 0);
  if (!lines.length) throw new Error('Add at least one line item.');
  if (lines.some(l => !l.billing_item_id)) throw new Error('Pick a billable item for every line.');
  const { data: userData } = await supabase.auth.getUser();
  const { data: numberData, error: numErr } = await db.rpc('next_invoice_number');
  if (numErr) throw numErr;
  const { data: invoice, error } = await db.from('billing_invoices').insert({
    invoice_number: numberData,
    job_site_id: o.jobSiteId ?? null,
    crm_company_id: o.crmCompanyId ?? null,
    customer_name: o.customerName ?? null,
    billing_email: o.billingEmail ?? null,
    po_number: o.poNumber ?? null,
    status: 'ready',
    invoice_date: o.invoiceDate,
    due_date: dueDateFromTerms(o.invoiceDate, o.terms),
    payment_terms: o.terms,
    notes: o.notes ?? null,
    created_by: userData?.user?.id ?? null,
  }).select().single();
  if (error) throw error;
  const { error: itemErr } = await db.from('billing_invoice_items').insert(lines.map((l, idx) => ({
    invoice_id: invoice.id, billing_item_id: l.billing_item_id ?? null,
    description: l.description.trim(), quantity: l.quantity,
    unit_price: l.unit_price,
    taxable: l.taxable,
    sort_order: idx,
  })));
  if (itemErr) throw itemErr;
  return reloadInvoice(invoice.id);
};

export type BillingItemKind = 'service' | 'product' | 'credit' | 'adjustment';

export interface BillingItem {
  id: string; name: string; description: string | null; category: string | null;
  unit: string; default_unit_price: number; active: boolean;
  qb_item_id: string | null; sku: string | null; taxable: boolean;
  qb_item_type: string | null; qb_income_account: string | null;
  purchase_cost: number | null; item_kind: BillingItemKind;
}

export const fetchBillingItems = async (
  includeInactive = false,
  opts?: { linePicker?: boolean },
): Promise<BillingItem[]> => {
  let q = db.from('billing_items').select('*').order('category').order('name');
  if (!includeInactive) q = q.eq('active', true);
  if (opts?.linePicker) q = q.not('item_kind', 'in', '("credit","adjustment")');
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as BillingItem[];
};

export const saveBillingItem = async (item: Partial<BillingItem> & { name: string }): Promise<BillingItem> => {
  const { data: userData } = await supabase.auth.getUser();
  const row = {
    name: item.name.trim(), description: item.description?.trim() || null,
    category: item.category?.trim() || null, unit: item.unit?.trim() || 'each',
    default_unit_price: Number(item.default_unit_price || 0), active: item.active ?? true,
    sku: item.sku?.trim() || null,
    taxable: item.taxable ?? true,
    item_kind: item.item_kind || 'service',
  };
  const res = item.id
    ? await db.from('billing_items').update(row).eq('id', item.id).select().single()
    : await db.from('billing_items').insert({ ...row, created_by: userData?.user?.id ?? null }).select().single();
  if (res.error) {
    if (res.error.code === '23505') throw new Error('An item with that name already exists.');
    throw res.error;
  }
  return res.data as BillingItem;
};
