export interface CrmStage {
  id: string;
  name: string;
  sort_order: number;
  color: string;
  is_won: boolean;
  is_lost: boolean;
  active: boolean;
}

export interface CrmLead {
  id: string;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: 'new' | 'contacted' | 'qualified' | 'unqualified' | 'converted';
  notes: string | null;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmDeal {
  id: string;
  name: string;
  lead_id: string | null;
  account_id: string | null;
  stage_id: string;
  value: number | null;
  expected_close_date: string | null;
  probability: number | null;
  owner_id: string | null;
  lost_reason: string | null;
  won_at: string | null;
  lost_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmActivity {
  id: string;
  deal_id: string | null;
  lead_id: string | null;
  type: 'call' | 'email' | 'meeting' | 'note' | 'task';
  subject: string;
  body: string | null;
  due_at: string | null;
  completed_at: string | null;
  owner_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CrmQuote {
  id: string;
  deal_id: string;
  quote_number: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
  subtotal: number;
  tax_rate: number;
  tax: number;
  total: number;
  valid_until: string | null;
  terms: string | null;
  notes: string | null;
  created_at: string;
}

export interface CrmQuoteItem {
  id: string;
  quote_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  sort_order: number;
}

export const LEAD_SOURCES = [
  'Referral',
  'Website',
  'Cold Call',
  'Walk-in',
  'Repeat Client',
  'Other',
];

export const LEAD_STATUS_LABELS: Record<CrmLead['status'], string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  unqualified: 'Unqualified',
  converted: 'Converted',
};