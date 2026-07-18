DROP INDEX IF EXISTS public.crm_deals_lead_id_unique;
CREATE UNIQUE INDEX crm_deals_lead_id_unique ON public.crm_deals (lead_id);