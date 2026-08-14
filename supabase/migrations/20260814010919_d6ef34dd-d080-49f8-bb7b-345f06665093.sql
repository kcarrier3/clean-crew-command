CREATE TABLE public.tax_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country text NOT NULL DEFAULT 'US',
  state text NOT NULL,
  county text,
  city text,
  zip text,
  rate numeric NOT NULL DEFAULT 0,
  label text,
  is_default boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tax_rates TO authenticated;
GRANT ALL ON public.tax_rates TO service_role;

ALTER TABLE public.tax_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view tax rates"
  ON public.tax_rates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Billing managers manage tax rates"
  ON public.tax_rates FOR ALL TO authenticated
  USING (public.can_manage_billing(auth.uid()))
  WITH CHECK (public.can_manage_billing(auth.uid()));

CREATE TRIGGER update_tax_rates_updated_at
  BEFORE UPDATE ON public.tax_rates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_tax_rates_lookup ON public.tax_rates (state, city, county, zip) WHERE active;

ALTER TABLE public.billing_invoices
  ADD COLUMN IF NOT EXISTS bill_to_name text,
  ADD COLUMN IF NOT EXISTS bill_to_address text,
  ADD COLUMN IF NOT EXISTS bill_to_city text,
  ADD COLUMN IF NOT EXISTS bill_to_state text,
  ADD COLUMN IF NOT EXISTS bill_to_zip text,
  ADD COLUMN IF NOT EXISTS ship_to_name text,
  ADD COLUMN IF NOT EXISTS ship_to_address text,
  ADD COLUMN IF NOT EXISTS ship_to_city text,
  ADD COLUMN IF NOT EXISTS ship_to_state text,
  ADD COLUMN IF NOT EXISTS ship_to_zip text,
  ADD COLUMN IF NOT EXISTS tax_jurisdiction text;

ALTER TABLE public.estimate_proposals
  ADD COLUMN IF NOT EXISTS bill_to_name text,
  ADD COLUMN IF NOT EXISTS bill_to_address text,
  ADD COLUMN IF NOT EXISTS bill_to_city text,
  ADD COLUMN IF NOT EXISTS bill_to_state text,
  ADD COLUMN IF NOT EXISTS bill_to_zip text,
  ADD COLUMN IF NOT EXISTS ship_to_name text,
  ADD COLUMN IF NOT EXISTS ship_to_address text,
  ADD COLUMN IF NOT EXISTS ship_to_city text,
  ADD COLUMN IF NOT EXISTS ship_to_state text,
  ADD COLUMN IF NOT EXISTS ship_to_zip text,
  ADD COLUMN IF NOT EXISTS tax_jurisdiction text;