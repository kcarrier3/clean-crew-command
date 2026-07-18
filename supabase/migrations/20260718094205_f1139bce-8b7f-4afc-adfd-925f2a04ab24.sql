
DROP INDEX IF EXISTS public.crm_companies_salesforce_id_key;
DROP INDEX IF EXISTS public.crm_contacts_salesforce_id_key;
DROP INDEX IF EXISTS public.crm_leads_salesforce_id_key;
CREATE UNIQUE INDEX crm_companies_salesforce_id_key ON public.crm_companies (salesforce_id);
CREATE UNIQUE INDEX crm_contacts_salesforce_id_key ON public.crm_contacts (salesforce_id);
CREATE UNIQUE INDEX crm_leads_salesforce_id_key ON public.crm_leads (salesforce_id);
