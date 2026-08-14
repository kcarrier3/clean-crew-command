CREATE SEQUENCE IF NOT EXISTS public.proposal_number_seq START 1;

CREATE OR REPLACE FUNCTION public.next_proposal_number()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'PROP-' || lpad(nextval('public.proposal_number_seq')::text, 4, '0')
$$;

CREATE TABLE public.estimate_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_number text NOT NULL UNIQUE DEFAULT public.next_proposal_number(),
  estimate_id uuid REFERENCES public.estimates(id) ON DELETE SET NULL,
  revision_id uuid REFERENCES public.estimate_revisions(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  company_id uuid REFERENCES public.crm_companies(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT 'Service Proposal',
  customer_name text,
  customer_contact_name text,
  customer_email text,
  period_label text NOT NULL DEFAULT 'for this project',
  status text NOT NULL DEFAULT 'draft',
  valid_until date,
  intro text,
  terms text,
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric NOT NULL DEFAULT 0,
  tax_rate numeric NOT NULL DEFAULT 0,
  tax numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  sent_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  invoice_id uuid REFERENCES public.billing_invoices(id) ON DELETE SET NULL,
  converted_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.estimate_proposals TO authenticated;
GRANT ALL ON public.estimate_proposals TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.proposal_number_seq TO authenticated, service_role;

ALTER TABLE public.estimate_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view proposals"
ON public.estimate_proposals FOR SELECT TO authenticated
USING (
  public.can_estimate(auth.uid())
  OR public.can_manage_billing(auth.uid())
  OR public.is_crm_user(auth.uid())
);

CREATE POLICY "Staff can create proposals"
ON public.estimate_proposals FOR INSERT TO authenticated
WITH CHECK (
  public.can_estimate(auth.uid())
  OR public.can_manage_billing(auth.uid())
  OR public.is_crm_user(auth.uid())
);

CREATE POLICY "Staff can update proposals"
ON public.estimate_proposals FOR UPDATE TO authenticated
USING (
  public.can_estimate(auth.uid())
  OR public.can_manage_billing(auth.uid())
  OR public.is_crm_user(auth.uid())
)
WITH CHECK (
  public.can_estimate(auth.uid())
  OR public.can_manage_billing(auth.uid())
  OR public.is_crm_user(auth.uid())
);

CREATE POLICY "Admins can delete proposals"
ON public.estimate_proposals FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_estimate_proposals_lead ON public.estimate_proposals(lead_id);
CREATE INDEX idx_estimate_proposals_estimate ON public.estimate_proposals(estimate_id);

CREATE TRIGGER update_estimate_proposals_updated_at
BEFORE UPDATE ON public.estimate_proposals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();