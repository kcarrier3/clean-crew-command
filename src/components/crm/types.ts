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
  company_id?: string | null;
  primary_contact_id?: string | null;
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
  company_id?: string | null;
  primary_contact_id?: string | null;
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

export interface CrmCompany {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  notes: string | null;
  owner_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmContact {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  company_id: string | null;
  lead_id: string | null;
  is_primary: boolean;
  notes: string | null;
  owner_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type CrmTaskPriority = 'low' | 'normal' | 'high' | 'urgent';
export type CrmTaskStatus = 'open' | 'in_progress' | 'done' | 'cancelled';

export interface CrmTask {
  id: string;
  title: string;
  description: string | null;
  due_at: string | null;
  priority: CrmTaskPriority;
  status: CrmTaskStatus;
  assigned_to: string | null;
  deal_id: string | null;
  lead_id: string | null;
  contact_id: string | null;
  company_id: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const TASK_PRIORITY_LABELS: Record<CrmTaskPriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
};

export const TASK_STATUS_LABELS: Record<CrmTaskStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  done: 'Done',
  cancelled: 'Cancelled',
};