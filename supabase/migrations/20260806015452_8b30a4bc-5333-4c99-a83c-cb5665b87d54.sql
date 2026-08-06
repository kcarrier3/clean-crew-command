ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS sf_account_id text,
  ADD COLUMN IF NOT EXISTS sf_account_name text;

ALTER TABLE public.crm_deals
  ADD COLUMN IF NOT EXISTS sf_account_id text;

CREATE INDEX IF NOT EXISTS idx_crm_leads_sf_account_id ON public.crm_leads (sf_account_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_sf_account_id ON public.crm_deals (sf_account_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_company_id ON public.crm_leads (company_id);