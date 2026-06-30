
-- =========== SERVICES CATALOG ===========
CREATE TABLE public.crm_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text,
  unit text NOT NULL DEFAULT 'each',
  default_unit_price numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_services TO authenticated;
GRANT ALL ON public.crm_services TO service_role;
ALTER TABLE public.crm_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CRM users manage services" ON public.crm_services
  FOR ALL TO authenticated
  USING (public.is_crm_user(auth.uid()))
  WITH CHECK (public.is_crm_user(auth.uid()));
CREATE TRIGGER update_crm_services_updated_at BEFORE UPDATE ON public.crm_services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========== QUOTE SIGNATURES ===========
CREATE TABLE public.crm_quote_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.crm_quotes(id) ON DELETE CASCADE,
  signer_name text NOT NULL,
  signer_email text,
  signer_title text,
  signature_data text NOT NULL,
  signature_type text NOT NULL CHECK (signature_type IN ('drawn','typed')),
  ip_hash text,
  user_agent text,
  signed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_quote_signatures TO authenticated;
GRANT ALL ON public.crm_quote_signatures TO service_role;
ALTER TABLE public.crm_quote_signatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CRM users manage signatures" ON public.crm_quote_signatures
  FOR ALL TO authenticated
  USING (public.is_crm_user(auth.uid()))
  WITH CHECK (public.is_crm_user(auth.uid()));

-- =========== INVOICES ===========
CREATE SEQUENCE IF NOT EXISTS crm_invoice_number_seq START 1000;

CREATE TABLE public.crm_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE DEFAULT ('INV-' || lpad(nextval('crm_invoice_number_seq')::text, 5, '0')),
  deal_id uuid REFERENCES public.crm_deals(id) ON DELETE SET NULL,
  quote_id uuid REFERENCES public.crm_quotes(id) ON DELETE SET NULL,
  company_id uuid REFERENCES public.crm_companies(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','overdue','void')),
  subtotal numeric NOT NULL DEFAULT 0,
  tax_rate numeric NOT NULL DEFAULT 0,
  tax numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL DEFAULT 0,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  paid_at timestamptz,
  terms text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_invoices TO authenticated;
GRANT ALL ON public.crm_invoices TO service_role;
ALTER TABLE public.crm_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CRM users manage invoices" ON public.crm_invoices
  FOR ALL TO authenticated
  USING (public.is_crm_user(auth.uid()))
  WITH CHECK (public.is_crm_user(auth.uid()));
CREATE TRIGGER update_crm_invoices_updated_at BEFORE UPDATE ON public.crm_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.crm_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.crm_invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_invoice_items TO authenticated;
GRANT ALL ON public.crm_invoice_items TO service_role;
ALTER TABLE public.crm_invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CRM users manage invoice items" ON public.crm_invoice_items
  FOR ALL TO authenticated
  USING (public.is_crm_user(auth.uid()))
  WITH CHECK (public.is_crm_user(auth.uid()));

-- =========== MEETINGS ===========
CREATE TABLE public.crm_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  deal_id uuid REFERENCES public.crm_deals(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  company_id uuid REFERENCES public.crm_companies(id) ON DELETE SET NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz,
  location text,
  meeting_url text,
  attendees jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','cancelled','no_show')),
  notes text,
  owner_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_meetings TO authenticated;
GRANT ALL ON public.crm_meetings TO service_role;
ALTER TABLE public.crm_meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CRM users manage meetings" ON public.crm_meetings
  FOR ALL TO authenticated
  USING (public.is_crm_user(auth.uid()))
  WITH CHECK (public.is_crm_user(auth.uid()));
CREATE TRIGGER update_crm_meetings_updated_at BEFORE UPDATE ON public.crm_meetings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========== EMAIL LOGS ===========
CREATE TABLE public.crm_email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid REFERENCES public.crm_deals(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  company_id uuid REFERENCES public.crm_companies(id) ON DELETE SET NULL,
  direction text NOT NULL CHECK (direction IN ('outbound','inbound')),
  subject text,
  body text,
  from_email text,
  to_emails text[] NOT NULL DEFAULT '{}',
  cc_emails text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'logged' CHECK (status IN ('logged','sent','delivered','bounced','failed')),
  sent_at timestamptz NOT NULL DEFAULT now(),
  logged_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_email_logs TO authenticated;
GRANT ALL ON public.crm_email_logs TO service_role;
ALTER TABLE public.crm_email_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CRM users manage email logs" ON public.crm_email_logs
  FOR ALL TO authenticated
  USING (public.is_crm_user(auth.uid()))
  WITH CHECK (public.is_crm_user(auth.uid()));

CREATE INDEX idx_crm_email_logs_deal ON public.crm_email_logs(deal_id);
CREATE INDEX idx_crm_email_logs_lead ON public.crm_email_logs(lead_id);
CREATE INDEX idx_crm_meetings_start ON public.crm_meetings(start_at);
CREATE INDEX idx_crm_invoices_status ON public.crm_invoices(status);
