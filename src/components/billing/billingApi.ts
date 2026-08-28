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

export interface CreateInvoiceOptions {
  events: BillingEvent[];
  invoiceDate: string;
  terms: string;
  taxRate: number;
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

  const subtotal = o.events.reduce((s, e) => s + Number(e.amount || 0), 0);
  const tax = Math.round(subtotal * (o.taxRate / 100) * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;
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
    subtotal, tax_rate: o.taxRate, tax, total,
    balance_due: total,
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
    tax_jurisdiction: o.taxJurisdiction || null,
    notes: o.notes ?? null,
    earliest_completed_at: earliest,
    created_by: userData?.user?.id ?? null,
  }).select().single();
  if (error) throw error;

  const items = o.events.map((e, idx) => ({
    invoice_id: invoice.id,
    description: e.billing_percent
      ? `${e.label} (${Number(e.billing_percent)}% of contract)`
      : e.label,
    quantity: 1,
    unit_price: Number(e.amount || 0),
    line_total: Number(e.amount || 0),
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

  return invoice as Invoice;
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