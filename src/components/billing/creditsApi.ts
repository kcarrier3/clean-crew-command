import { supabase } from '@/integrations/supabase/client';
import { db } from './billingApi';

export type CreditReason = 'referral' | 'dissatisfaction' | 'goodwill' | 'other';
export type CreditStatus = 'pending_approval' | 'available' | 'fully_applied' | 'voided';

/** Owner-facing reasons first. goodwill and other stay available; the database still stores those codes. */
export const CREDIT_REASONS: { value: CreditReason; label: string }[] = [
  { value: 'referral', label: 'Referral' },
  { value: 'dissatisfaction', label: 'Dissatisfied with service' },
  { value: 'goodwill', label: 'Goodwill' },
  { value: 'other', label: 'Other' },
];

export const creditReasonLabel = (reason: string) =>
  CREDIT_REASONS.find(r => r.value === reason)?.label ?? reason;

export const CREDIT_STATUS_LABEL: Record<string, string> = {
  pending_approval: 'Pending approval',
  available: 'Available',
  fully_applied: 'Fully applied',
  voided: 'Voided',
};

export interface CustomerCredit {
  id: string;
  crm_company_id: string | null;
  job_site_id: string | null;
  reason: CreditReason;
  referred_crm_company_id: string | null;
  related_invoice_id: string | null;
  amount: number;
  remaining_amount: number;
  reduces_taxable_amount: boolean;
  auto_apply: boolean;
  status: CreditStatus;
  notes: string | null;
  expires_on: string | null;
  issued_at: string;
  void_reason: string | null;
  company?: { name: string } | null;
  site?: { name: string } | null;
  referred?: { name: string } | null;
}

export interface CreditApplication {
  id: string;
  credit_id: string;
  invoice_id: string | null;
  amount: number;
  auto_applied: boolean;
  applied_at: string;
  reversed_at: string | null;
  reversal_reason: string | null;
  invoice?: { invoice_number: string; status: string } | null;
}

const rpc = async (name: string, args: Record<string, unknown>) => {
  const { data, error } = await db.rpc(name, args);
  if (error) throw error;
  return data;
};

export const canApproveCredits = async (userId: string): Promise<boolean> => {
  const { data, error } = await supabase.rpc('can_approve_credits', { _user_id: userId });
  if (error) throw error;
  return !!data;
};

export interface IssueCreditInput {
  amount: number;
  reason: CreditReason;
  crmCompanyId?: string | null;
  jobSiteId?: string | null;
  notes?: string | null;
  reducesTaxableAmount?: boolean | null;
  autoApply?: boolean;
  relatedInvoiceId?: string | null;
  referredCompanyId?: string | null;
  expiresOn?: string | null;
}

export const issueCustomerCredit = (input: IssueCreditInput) => rpc('issue_customer_credit', {
  _amount: input.amount,
  _reason: input.reason,
  _crm_company_id: input.crmCompanyId ?? null,
  _job_site_id: input.jobSiteId ?? null,
  _notes: input.notes ?? null,
  _reduces_taxable_amount: input.reducesTaxableAmount ?? null,
  _auto_apply: input.autoApply ?? true,
  _related_invoice_id: input.relatedInvoiceId ?? null,
  _referred_crm_company_id: input.referredCompanyId ?? null,
  _expires_on: input.expiresOn || null,
});

export const approveCustomerCredit = (creditId: string) =>
  rpc('approve_customer_credit', { _credit_id: creditId });

export const voidCustomerCredit = (creditId: string, reason?: string | null) =>
  rpc('void_customer_credit', { _credit_id: creditId, _reason: reason ?? null });

export const applyCustomerCredit = (creditId: string, invoiceId: string, amount?: number | null) =>
  rpc('apply_customer_credit', {
    _credit_id: creditId,
    _invoice_id: invoiceId,
    _amount: amount ?? null,
  });

export const reverseCreditApplication = (applicationId: string, reason?: string | null) =>
  rpc('reverse_credit_application', { _application_id: applicationId, _reason: reason ?? null });

export const autoApplyCustomerCredits = (invoiceId: string) =>
  rpc('auto_apply_customer_credits', { _invoice_id: invoiceId });

export const fetchCredits = async (filters?: {
  status?: string;
  reason?: string;
  companyId?: string | null;
}): Promise<CustomerCredit[]> => {
  let q = db.from('customer_credits')
    .select('*, company:crm_companies!customer_credits_crm_company_id_fkey(name), referred:crm_companies!customer_credits_referred_crm_company_id_fkey(name), site:job_sites(name)')
    .order('issued_at', { ascending: false });
  if (filters?.status && filters.status !== 'all') q = q.eq('status', filters.status);
  if (filters?.reason && filters.reason !== 'all') q = q.eq('reason', filters.reason);
  if (filters?.companyId) q = q.eq('crm_company_id', filters.companyId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as CustomerCredit[];
};

export const fetchCreditApplications = async (creditId: string): Promise<CreditApplication[]> => {
  const { data, error } = await db.from('customer_credit_applications')
    .select('*, invoice:billing_invoices(invoice_number, status)')
    .eq('credit_id', creditId)
    .order('applied_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as CreditApplication[];
};

export const fetchInvoiceApplications = async (invoiceId: string): Promise<CreditApplication[]> => {
  const { data, error } = await db.from('customer_credit_applications')
    .select('*, invoice:billing_invoices(invoice_number, status)')
    .eq('invoice_id', invoiceId)
    .is('reversed_at', null)
    .order('applied_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as CreditApplication[];
};

export const fetchAvailableCredits = async (companyId?: string | null, jobSiteId?: string | null): Promise<CustomerCredit[]> => {
  const { data, error } = await db.from('customer_credits')
    .select('*')
    .eq('status', 'available')
    .gt('remaining_amount', 0)
    .order('issued_at', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as CustomerCredit[]).filter(c =>
    (companyId && c.crm_company_id === companyId) || (jobSiteId && c.job_site_id === jobSiteId)
  );
};
