import { supabase } from '@/integrations/supabase/client';
import { dueDateFromTerms } from '@/lib/billing/kpi';

const db = supabase as any;

export type ProposalStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'invoiced';

export interface ProposalLine {
  label: string;
  detail?: string | null;
  amount: number;
}

export interface Proposal {
  id: string;
  proposal_number: string;
  estimate_id: string | null;
  revision_id: string | null;
  lead_id: string | null;
  company_id: string | null;
  title: string;
  customer_name: string | null;
  customer_contact_name: string | null;
  customer_email: string | null;
  period_label: string;
  status: ProposalStatus;
  valid_until: string | null;
  intro: string | null;
  terms: string | null;
  lines: ProposalLine[];
  subtotal: number;
  tax_rate: number;
  tax: number;
  total: number;
  bill_to_name?: string | null;
  bill_to_address?: string | null;
  bill_to_city?: string | null;
  bill_to_state?: string | null;
  bill_to_zip?: string | null;
  ship_to_name?: string | null;
  ship_to_address?: string | null;
  ship_to_city?: string | null;
  ship_to_state?: string | null;
  ship_to_zip?: string | null;
  tax_jurisdiction?: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  invoice_id: string | null;
  converted_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const PROPOSAL_STATUS_LABEL: Record<ProposalStatus, string> = {
  draft: 'Draft',
  sent: 'Sent to customer',
  accepted: 'Accepted',
  declined: 'Declined',
  invoiced: 'Invoiced',
};

const normalize = (row: any): Proposal => ({
  ...row,
  lines: Array.isArray(row.lines) ? row.lines : [],
  subtotal: Number(row.subtotal || 0),
  tax_rate: Number(row.tax_rate || 0),
  tax: Number(row.tax || 0),
  total: Number(row.total || 0),
});

export const proposalTotals = (lines: ProposalLine[], taxRate: number) => {
  const subtotal = Math.round(lines.reduce((s, l) => s + (Number(l.amount) || 0), 0) * 100) / 100;
  const tax = Math.round(subtotal * ((Number(taxRate) || 0) / 100) * 100) / 100;
  return { subtotal, tax, total: Math.round((subtotal + tax) * 100) / 100 };
};

export const fetchProposals = async (
  filter: { leadId?: string | null; estimateId?: string | null }
): Promise<Proposal[]> => {
  let q = db.from('estimate_proposals').select('*').order('created_at', { ascending: false });
  if (filter.estimateId) q = q.eq('estimate_id', filter.estimateId);
  else if (filter.leadId) q = q.eq('lead_id', filter.leadId);
  else return [];
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(normalize);
};

export interface CreateProposalInput {
  estimate_id: string | null;
  revision_id: string | null;
  lead_id: string | null;
  company_id: string | null;
  title: string;
  customer_name: string | null;
  customer_contact_name: string | null;
  customer_email: string | null;
  period_label: string;
  valid_until: string | null;
  intro: string | null;
  terms: string | null;
  lines: ProposalLine[];
  tax_rate: number;
}

export interface ProposalAddresses {
  bill_to_name?: string | null;
  bill_to_address?: string | null;
  bill_to_city?: string | null;
  bill_to_state?: string | null;
  bill_to_zip?: string | null;
  ship_to_name?: string | null;
  ship_to_address?: string | null;
  ship_to_city?: string | null;
  ship_to_state?: string | null;
  ship_to_zip?: string | null;
  tax_jurisdiction?: string | null;
}

export type CreateProposalPayload = CreateProposalInput & ProposalAddresses;

export const createProposal = async (input: CreateProposalInput): Promise<Proposal> => {
  const { data: userData } = await supabase.auth.getUser();
  const totals = proposalTotals(input.lines, input.tax_rate);
  const { data, error } = await db.from('estimate_proposals').insert({
    ...input,
    lines: input.lines,
    ...totals,
    status: 'draft',
    created_by: userData?.user?.id ?? null,
  }).select().single();
  if (error) throw error;
  return normalize(data);
};

export const updateProposalStatus = async (id: string, status: ProposalStatus) => {
  const now = new Date().toISOString();
  const patch: Record<string, any> = { status };
  if (status === 'sent') patch.sent_at = now;
  if (status === 'accepted') patch.accepted_at = now;
  if (status === 'declined') patch.declined_at = now;
  const { error } = await db.from('estimate_proposals').update(patch).eq('id', id);
  if (error) throw error;
};

/** Turns an accepted customer proposal into a billing invoice, one line per service. */
export const convertProposalToInvoice = async (
  p: Proposal,
  opts: { invoiceDate: string; terms: string; poNumber?: string | null }
) => {
  if (p.invoice_id) throw new Error('This proposal has already been invoiced.');
  const { data: userData } = await supabase.auth.getUser();
  const { data: number, error: numErr } = await db.rpc('next_invoice_number');
  if (numErr) throw numErr;

  const { data: invoice, error } = await db.from('billing_invoices').insert({
    invoice_number: number,
    crm_company_id: p.company_id,
    crm_lead_id: p.lead_id,
    customer_name: p.customer_name,
    billing_contact_name: p.customer_contact_name,
    billing_email: p.customer_email,
    po_number: opts.poNumber ?? null,
    status: 'ready',
    invoice_date: opts.invoiceDate,
    due_date: dueDateFromTerms(opts.invoiceDate, opts.terms),
    payment_terms: opts.terms,
    subtotal: p.subtotal,
    tax_rate: p.tax_rate,
    tax: p.tax,
    total: p.total,
    bill_to_name: p.bill_to_name ?? null,
    bill_to_address: p.bill_to_address ?? null,
    bill_to_city: p.bill_to_city ?? null,
    bill_to_state: p.bill_to_state ?? null,
    bill_to_zip: p.bill_to_zip ?? null,
    ship_to_name: p.ship_to_name ?? null,
    ship_to_address: p.ship_to_address ?? null,
    ship_to_city: p.ship_to_city ?? null,
    ship_to_state: p.ship_to_state ?? null,
    ship_to_zip: p.ship_to_zip ?? null,
    tax_jurisdiction: p.tax_jurisdiction ?? null,
    balance_due: p.total,
    notes: `Generated from proposal ${p.proposal_number}.`,
    created_by: userData?.user?.id ?? null,
  }).select().single();
  if (error) throw error;

  const items = p.lines.map((l, idx) => ({
    invoice_id: invoice.id,
    description: l.detail ? `${l.label} — ${l.detail}` : l.label,
    quantity: 1,
    unit_price: Number(l.amount || 0),
    line_total: Number(l.amount || 0),
    sort_order: idx,
  }));
  if (items.length) {
    const { error: itemErr } = await db.from('billing_invoice_items').insert(items);
    if (itemErr) throw itemErr;
  }

  const { error: upErr } = await db.from('estimate_proposals').update({
    status: 'invoiced',
    invoice_id: invoice.id,
    converted_at: new Date().toISOString(),
  }).eq('id', p.id);
  if (upErr) throw upErr;

  return invoice;
};
