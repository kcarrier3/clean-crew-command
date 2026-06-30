
-- Companies
CREATE TABLE public.crm_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  industry text,
  website text,
  phone text,
  address text,
  city text,
  state text,
  zip text,
  notes text,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_companies TO authenticated;
GRANT ALL ON public.crm_companies TO service_role;
ALTER TABLE public.crm_companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CRM users manage companies" ON public.crm_companies
  FOR ALL TO authenticated
  USING (public.is_crm_user(auth.uid()))
  WITH CHECK (public.is_crm_user(auth.uid()));
CREATE TRIGGER trg_crm_companies_updated BEFORE UPDATE ON public.crm_companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Contacts
CREATE TABLE public.crm_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text,
  email text,
  phone text,
  title text,
  company_id uuid REFERENCES public.crm_companies(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  is_primary boolean NOT NULL DEFAULT false,
  notes text,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_contacts TO authenticated;
GRANT ALL ON public.crm_contacts TO service_role;
ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CRM users manage contacts" ON public.crm_contacts
  FOR ALL TO authenticated
  USING (public.is_crm_user(auth.uid()))
  WITH CHECK (public.is_crm_user(auth.uid()));
CREATE INDEX idx_crm_contacts_company ON public.crm_contacts(company_id);
CREATE INDEX idx_crm_contacts_lead ON public.crm_contacts(lead_id);
CREATE TRIGGER trg_crm_contacts_updated BEFORE UPDATE ON public.crm_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tasks
CREATE TABLE public.crm_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  due_at timestamptz,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','done','cancelled')),
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES public.crm_deals(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.crm_companies(id) ON DELETE CASCADE,
  completed_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_tasks TO authenticated;
GRANT ALL ON public.crm_tasks TO service_role;
ALTER TABLE public.crm_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CRM users manage tasks" ON public.crm_tasks
  FOR ALL TO authenticated
  USING (public.is_crm_user(auth.uid()))
  WITH CHECK (public.is_crm_user(auth.uid()));
CREATE INDEX idx_crm_tasks_assignee ON public.crm_tasks(assigned_to);
CREATE INDEX idx_crm_tasks_status ON public.crm_tasks(status);
CREATE TRIGGER trg_crm_tasks_updated BEFORE UPDATE ON public.crm_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Link leads/deals to companies + primary contact
ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.crm_companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS primary_contact_id uuid REFERENCES public.crm_contacts(id) ON DELETE SET NULL;

ALTER TABLE public.crm_deals
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.crm_companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS primary_contact_id uuid REFERENCES public.crm_contacts(id) ON DELETE SET NULL;
