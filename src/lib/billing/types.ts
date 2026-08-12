/** Shared types + display helpers for the Billing module. */

export type BillingMode = 'completion' | 'progress' | 'phased' | 'manual';

export const BILLING_MODES: { value: BillingMode; label: string; hint: string }[] = [
  { value: 'completion', label: 'Bill 100% at project completion', hint: 'One invoice when the whole job is marked complete.' },
  { value: 'progress',   label: 'Progress billing (milestones)',    hint: 'Named milestones with a % or dollar amount each.' },
  { value: 'phased',     label: 'Phased billing (operational phases)', hint: 'Tied to the job phases crews mark complete.' },
  { value: 'manual',     label: 'Manual / no automatic billing',    hint: 'Nothing enters Ready to Bill automatically.' },
];

export type BillingEventStatus = 'ready' | 'hold' | 'invoiced' | 'cancelled';

export type InvoiceStatus =
  | 'draft' | 'ready' | 'sent' | 'partially_paid' | 'paid' | 'past_due' | 'void';

export type PaymentMethod = 'check' | 'ach' | 'card' | 'cash' | 'other';

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'check', label: 'Check' },
  { value: 'ach',   label: 'ACH / transfer' },
  { value: 'card',  label: 'Card' },
  { value: 'cash',  label: 'Cash' },
  { value: 'other', label: 'Other' },
];

export type EmailStatus = 'draft' | 'queued' | 'sent' | 'delivered' | 'failed' | 'bounced' | 'opened';

export interface BillingEvent {
  id: string;
  job_site_id: string | null;
  project_phase_id: string | null;
  milestone_id: string | null;
  crm_company_id: string | null;
  crm_lead_id: string | null;
  source: string;
  label: string;
  description: string | null;
  contract_amount: number | null;
  billing_percent: number | null;
  amount: number;
  po_number: string | null;
  billing_email: string | null;
  notes: string | null;
  status: BillingEventStatus;
  hold_reason: string | null;
  hold_at: string | null;
  completed_at: string;
  ready_at: string;
  invoice_id: string | null;
  invoiced_at: string | null;
  created_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  job_site_id: string | null;
  crm_company_id: string | null;
  crm_lead_id: string | null;
  customer_name: string | null;
  billing_contact_name: string | null;
  billing_email: string | null;
  po_number: string | null;
  status: InvoiceStatus;
  invoice_date: string;
  due_date: string | null;
  payment_terms: string | null;
  subtotal: number;
  tax_rate: number;
  tax: number;
  total: number;
  amount_paid: number;
  balance_due: number;
  notes: string | null;
  generated_at: string;
  sent_at: string | null;
  paid_at: string | null;
  earliest_completed_at: string | null;
  qb_sync_status: string;
  created_at: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  sort_order: number;
}

export interface Payment {
  id: string;
  crm_company_id: string | null;
  payer_name: string | null;
  payment_date: string;
  amount: number;
  method: PaymentMethod;
  reference_number: string | null;
  deposit_date: string | null;
  deposit_account_label: string | null;
  deposit_batch_id: string | null;
  notes: string | null;
  entered_by: string | null;
  created_at: string;
}

export const INVOICE_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  ready: 'Ready to send',
  sent: 'Sent / open',
  partially_paid: 'Partially paid',
  paid: 'Paid',
  past_due: 'Past due',
  void: 'Void',
};

/** Tailwind classes for status badges, using semantic-ish neutral tokens. */
export const INVOICE_STATUS_CLASS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  ready: 'bg-blue-100 text-blue-800',
  sent: 'bg-indigo-100 text-indigo-800',
  partially_paid: 'bg-amber-100 text-amber-900',
  paid: 'bg-green-100 text-green-800',
  past_due: 'bg-red-100 text-red-800',
  void: 'bg-muted text-muted-foreground line-through',
};

export const money = (n: number | null | undefined) =>
  `$${Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;