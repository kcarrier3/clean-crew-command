-- tax_rates: effective dating + official codes
ALTER TABLE public.tax_rates
  ADD COLUMN IF NOT EXISTS effective_from date NOT NULL DEFAULT DATE '2000-01-01',
  ADD COLUMN IF NOT EXISTS effective_to date,
  ADD COLUMN IF NOT EXISTS ust_code text,
  ADD COLUMN IF NOT EXISTS transit_area text,
  ADD COLUMN IF NOT EXISTS source_url text;
CREATE INDEX IF NOT EXISTS idx_tax_rates_county_effective ON public.tax_rates (state, lower(county), effective_from) WHERE active AND city IS NULL AND zip IS NULL AND transit_area IS NULL;

-- job_sites: county + exemption override + review flag
ALTER TABLE public.job_sites
  ADD COLUMN IF NOT EXISTS county text,
  ADD COLUMN IF NOT EXISTS county_needs_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS county_source text,
  ADD COLUMN IF NOT EXISTS tax_exempt boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_exemption_reason text,
  ADD COLUMN IF NOT EXISTS tax_rate_id uuid REFERENCES public.tax_rates(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.job_sites.tax_rate_id IS 'Optional manual tax rate override; normally the rate is resolved from county';

-- crm_companies: customer exemption
ALTER TABLE public.crm_companies
  ADD COLUMN IF NOT EXISTS tax_exempt boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_exemption_reason text,
  ADD COLUMN IF NOT EXISTS tax_exempt_certificate_on_file boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_exempt_certificate_expires date,
  ADD COLUMN IF NOT EXISTS tax_exempt_certificate_path text,
  ADD COLUMN IF NOT EXISTS qb_customer_id text;
CREATE UNIQUE INDEX IF NOT EXISTS crm_companies_qb_customer_id_key ON public.crm_companies (qb_customer_id) WHERE qb_customer_id IS NOT NULL;

-- invoice lines: taxable + credit linkage
ALTER TABLE public.billing_invoice_items
  ADD COLUMN IF NOT EXISTS taxable boolean,
  ADD COLUMN IF NOT EXISTS line_type text NOT NULL DEFAULT 'charge';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='billing_invoice_items_line_type_check') THEN
    ALTER TABLE public.billing_invoice_items ADD CONSTRAINT billing_invoice_items_line_type_check CHECK (line_type IN ('charge','credit'));
  END IF;
END $$;

-- invoices: tax result fields
ALTER TABLE public.billing_invoices
  ADD COLUMN IF NOT EXISTS taxable_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credits_applied numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_rate_id uuid REFERENCES public.tax_rates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tax_exempt boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_exemption_reason text,
  ADD COLUMN IF NOT EXISTS tax_status text NOT NULL DEFAULT 'ok',
  ADD COLUMN IF NOT EXISTS tax_review_reason text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='billing_invoices_tax_status_check') THEN
    ALTER TABLE public.billing_invoices ADD CONSTRAINT billing_invoices_tax_status_check CHECK (tax_status IN ('ok','needs_review'));
  END IF;
END $$;
