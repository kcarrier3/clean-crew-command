
-- Add Salesforce parity fields
ALTER TABLE public.crm_companies
  ADD COLUMN IF NOT EXISTS salesforce_id text,
  ADD COLUMN IF NOT EXISTS annual_revenue numeric,
  ADD COLUMN IF NOT EXISTS employee_count integer;

CREATE UNIQUE INDEX IF NOT EXISTS crm_companies_salesforce_id_key
  ON public.crm_companies (salesforce_id) WHERE salesforce_id IS NOT NULL;

ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS salesforce_id text,
  ADD COLUMN IF NOT EXISTS lead_source text,
  ADD COLUMN IF NOT EXISTS service_line text,
  ADD COLUMN IF NOT EXISTS owner_id uuid,
  ADD COLUMN IF NOT EXISTS expected_revenue numeric
    GENERATED ALWAYS AS (COALESCE(amount,0) * COALESCE(probability,0) / 100.0) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS crm_leads_salesforce_id_key
  ON public.crm_leads (salesforce_id) WHERE salesforce_id IS NOT NULL;

ALTER TABLE public.crm_contacts
  ADD COLUMN IF NOT EXISTS salesforce_id text;

CREATE UNIQUE INDEX IF NOT EXISTS crm_contacts_salesforce_id_key
  ON public.crm_contacts (salesforce_id) WHERE salesforce_id IS NOT NULL;
