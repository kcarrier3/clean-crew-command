CREATE TABLE public.billing_check_intakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'review_needed',
  payer_name text,
  crm_company_id uuid REFERENCES public.crm_companies(id) ON DELETE SET NULL,
  check_number text,
  check_date date,
  received_date date NOT NULL DEFAULT CURRENT_DATE,
  deposit_date date,
  deposit_account_label text,
  amount numeric NOT NULL DEFAULT 0,
  check_image_path text,
  stub_image_path text,
  extraction jsonb NOT NULL DEFAULT '{}'::jsonb,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  proposed_allocations jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  payment_id uuid REFERENCES public.billing_payments(id) ON DELETE SET NULL,
  processed_by uuid,
  processed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_check_intakes TO authenticated;
GRANT ALL ON public.billing_check_intakes TO service_role;
ALTER TABLE public.billing_check_intakes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Billing managers manage check intakes"
  ON public.billing_check_intakes FOR ALL TO authenticated
  USING (public.can_manage_billing(auth.uid()))
  WITH CHECK (public.can_manage_billing(auth.uid()));

CREATE TRIGGER update_billing_check_intakes_updated_at
  BEFORE UPDATE ON public.billing_check_intakes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_check_intakes_status ON public.billing_check_intakes(status);
CREATE INDEX idx_check_intakes_dupe ON public.billing_check_intakes(check_number, amount);

CREATE TABLE public.billing_check_intake_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intake_id uuid NOT NULL REFERENCES public.billing_check_intakes(id) ON DELETE CASCADE,
  event text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.billing_check_intake_events TO authenticated;
GRANT ALL ON public.billing_check_intake_events TO service_role;
ALTER TABLE public.billing_check_intake_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Billing managers read check intake events"
  ON public.billing_check_intake_events FOR SELECT TO authenticated
  USING (public.can_manage_billing(auth.uid()));
CREATE POLICY "Billing managers add check intake events"
  ON public.billing_check_intake_events FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_billing(auth.uid()));