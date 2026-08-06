DROP INDEX IF EXISTS public.crm_lead_notes_salesforce_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS crm_lead_notes_sfid_parent_key
  ON public.crm_lead_notes (
    salesforce_id,
    COALESCE(lead_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(contact_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(task_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE salesforce_id IS NOT NULL;