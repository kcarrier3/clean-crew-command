
-- ============================================================
-- CRM helper: who can access CRM
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_crm_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = _user_id
        AND job_title IN ('Owner', 'Administrator')
    )
$$;

REVOKE EXECUTE ON FUNCTION public.is_crm_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_crm_user(uuid) TO authenticated, service_role;

-- ============================================================
-- Pipeline stages (configurable)
-- ============================================================
CREATE TABLE public.crm_pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  color text NOT NULL DEFAULT '#94a3b8',
  is_won boolean NOT NULL DEFAULT false,
  is_lost boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_pipeline_stages TO authenticated;
GRANT ALL ON public.crm_pipeline_stages TO service_role;

ALTER TABLE public.crm_pipeline_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CRM users can view stages" ON public.crm_pipeline_stages
  FOR SELECT TO authenticated USING (public.is_crm_user(auth.uid()));
CREATE POLICY "CRM users can manage stages" ON public.crm_pipeline_stages
  FOR ALL TO authenticated
  USING (public.is_crm_user(auth.uid()))
  WITH CHECK (public.is_crm_user(auth.uid()));

CREATE TRIGGER update_crm_pipeline_stages_updated_at
  BEFORE UPDATE ON public.crm_pipeline_stages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.crm_pipeline_stages (name, sort_order, color, is_won, is_lost) VALUES
  ('Prospect',    10, '#94a3b8', false, false),
  ('Contacted',   20, '#60a5fa', false, false),
  ('Quoted',      30, '#fbbf24', false, false),
  ('Negotiation', 40, '#fb923c', false, false),
  ('Won',         50, '#22c55e', true,  false),
  ('Lost',        60, '#ef4444', false, true);

-- ============================================================
-- Leads
-- ============================================================
CREATE TABLE public.crm_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  contact_name text,
  email text,
  phone text,
  source text,
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','contacted','qualified','unqualified','converted')),
  notes text,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_leads TO authenticated;
GRANT ALL ON public.crm_leads TO service_role;

ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CRM users can view leads" ON public.crm_leads
  FOR SELECT TO authenticated USING (public.is_crm_user(auth.uid()));
CREATE POLICY "CRM users can manage leads" ON public.crm_leads
  FOR ALL TO authenticated
  USING (public.is_crm_user(auth.uid()))
  WITH CHECK (public.is_crm_user(auth.uid()));

CREATE TRIGGER update_crm_leads_updated_at
  BEFORE UPDATE ON public.crm_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_crm_leads_status ON public.crm_leads(status);
CREATE INDEX idx_crm_leads_assigned ON public.crm_leads(assigned_to);

-- ============================================================
-- Deals
-- ============================================================
CREATE TABLE public.crm_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  lead_id uuid REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  account_id uuid REFERENCES public.job_sites(id) ON DELETE SET NULL,
  stage_id uuid NOT NULL REFERENCES public.crm_pipeline_stages(id),
  value numeric(12,2) DEFAULT 0,
  expected_close_date date,
  probability integer DEFAULT 50 CHECK (probability BETWEEN 0 AND 100),
  owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  lost_reason text,
  won_at timestamptz,
  lost_at timestamptz,
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_deals TO authenticated;
GRANT ALL ON public.crm_deals TO service_role;

ALTER TABLE public.crm_deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CRM users can view deals" ON public.crm_deals
  FOR SELECT TO authenticated USING (public.is_crm_user(auth.uid()));
CREATE POLICY "CRM users can manage deals" ON public.crm_deals
  FOR ALL TO authenticated
  USING (public.is_crm_user(auth.uid()))
  WITH CHECK (public.is_crm_user(auth.uid()));

CREATE TRIGGER update_crm_deals_updated_at
  BEFORE UPDATE ON public.crm_deals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_crm_deals_stage ON public.crm_deals(stage_id);
CREATE INDEX idx_crm_deals_owner ON public.crm_deals(owner_id);
CREATE INDEX idx_crm_deals_account ON public.crm_deals(account_id);

-- ============================================================
-- Activities
-- ============================================================
CREATE TABLE public.crm_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid REFERENCES public.crm_deals(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('call','email','meeting','note','task')),
  subject text NOT NULL,
  body text,
  due_at timestamptz,
  completed_at timestamptz,
  owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (deal_id IS NOT NULL OR lead_id IS NOT NULL)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_activities TO authenticated;
GRANT ALL ON public.crm_activities TO service_role;

ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CRM users can view activities" ON public.crm_activities
  FOR SELECT TO authenticated USING (public.is_crm_user(auth.uid()));
CREATE POLICY "CRM users can manage activities" ON public.crm_activities
  FOR ALL TO authenticated
  USING (public.is_crm_user(auth.uid()))
  WITH CHECK (public.is_crm_user(auth.uid()));

CREATE TRIGGER update_crm_activities_updated_at
  BEFORE UPDATE ON public.crm_activities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_crm_activities_deal ON public.crm_activities(deal_id);
CREATE INDEX idx_crm_activities_lead ON public.crm_activities(lead_id);
CREATE INDEX idx_crm_activities_due ON public.crm_activities(due_at) WHERE completed_at IS NULL;
CREATE INDEX idx_crm_activities_owner ON public.crm_activities(owner_id);

-- ============================================================
-- Quotes
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS public.crm_quote_number_seq START 1000;

CREATE TABLE public.crm_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.crm_deals(id) ON DELETE CASCADE,
  quote_number text NOT NULL UNIQUE
    DEFAULT ('Q-' || lpad(nextval('public.crm_quote_number_seq')::text, 5, '0')),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sent','accepted','rejected','expired')),
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  tax_rate numeric(5,2) NOT NULL DEFAULT 0,
  tax numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  valid_until date,
  terms text,
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_quotes TO authenticated;
GRANT ALL ON public.crm_quotes TO service_role;
GRANT USAGE ON SEQUENCE public.crm_quote_number_seq TO authenticated, service_role;

ALTER TABLE public.crm_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CRM users can view quotes" ON public.crm_quotes
  FOR SELECT TO authenticated USING (public.is_crm_user(auth.uid()));
CREATE POLICY "CRM users can manage quotes" ON public.crm_quotes
  FOR ALL TO authenticated
  USING (public.is_crm_user(auth.uid()))
  WITH CHECK (public.is_crm_user(auth.uid()));

CREATE TRIGGER update_crm_quotes_updated_at
  BEFORE UPDATE ON public.crm_quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_crm_quotes_deal ON public.crm_quotes(deal_id);

-- ============================================================
-- Quote line items
-- ============================================================
CREATE TABLE public.crm_quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.crm_quotes(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  line_total numeric(12,2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_quote_items TO authenticated;
GRANT ALL ON public.crm_quote_items TO service_role;

ALTER TABLE public.crm_quote_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CRM users can view quote items" ON public.crm_quote_items
  FOR SELECT TO authenticated USING (public.is_crm_user(auth.uid()));
CREATE POLICY "CRM users can manage quote items" ON public.crm_quote_items
  FOR ALL TO authenticated
  USING (public.is_crm_user(auth.uid()))
  WITH CHECK (public.is_crm_user(auth.uid()));

CREATE TRIGGER update_crm_quote_items_updated_at
  BEFORE UPDATE ON public.crm_quote_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_crm_quote_items_quote ON public.crm_quote_items(quote_id);
