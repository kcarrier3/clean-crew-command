-- =========================================================
-- Phase 1: additive Salesforce fidelity columns (no data loss)
-- =========================================================

-- ---------- crm_lead_notes ----------
ALTER TABLE public.crm_lead_notes
  ALTER COLUMN lead_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS salesforce_id text,
  ADD COLUMN IF NOT EXISTS sf_source_object text,
  ADD COLUMN IF NOT EXISTS parent_type text,
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.crm_companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES public.crm_tasks(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS sf_parent_id text,
  ADD COLUMN IF NOT EXISTS sf_owner_id text,
  ADD COLUMN IF NOT EXISTS sf_created_by_id text,
  ADD COLUMN IF NOT EXISTS sf_created_date timestamptz,
  ADD COLUMN IF NOT EXISTS sf_last_modified_date timestamptz,
  ADD COLUMN IF NOT EXISTS content_html text;

-- Backfill parent_type for the existing 863 opportunity notes.
UPDATE public.crm_lead_notes
   SET parent_type = 'opportunity'
 WHERE parent_type IS NULL AND lead_id IS NOT NULL;

-- Every note must hang off exactly one parent.
ALTER TABLE public.crm_lead_notes
  DROP CONSTRAINT IF EXISTS crm_lead_notes_parent_present,
  ADD CONSTRAINT crm_lead_notes_parent_present CHECK (
    (lead_id IS NOT NULL)::int
  + (company_id IS NOT NULL)::int
  + (contact_id IS NOT NULL)::int
  + (task_id IS NOT NULL)::int >= 1
  );

ALTER TABLE public.crm_lead_notes
  DROP CONSTRAINT IF EXISTS crm_lead_notes_parent_type_valid,
  ADD CONSTRAINT crm_lead_notes_parent_type_valid CHECK (
    parent_type IS NULL OR parent_type IN ('account','contact','opportunity','task')
  );

CREATE UNIQUE INDEX IF NOT EXISTS crm_lead_notes_salesforce_id_key
  ON public.crm_lead_notes (salesforce_id) WHERE salesforce_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_lead_notes_lead ON public.crm_lead_notes (lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_lead_notes_company ON public.crm_lead_notes (company_id);
CREATE INDEX IF NOT EXISTS idx_crm_lead_notes_contact ON public.crm_lead_notes (contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_lead_notes_task ON public.crm_lead_notes (task_id);

-- ---------- crm_lead_files ----------
ALTER TABLE public.crm_lead_files
  ALTER COLUMN lead_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS salesforce_id text,
  ADD COLUMN IF NOT EXISTS sf_source_object text,
  ADD COLUMN IF NOT EXISTS parent_type text,
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.crm_companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES public.crm_tasks(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS sf_parent_id text,
  ADD COLUMN IF NOT EXISTS sf_content_document_id text,
  ADD COLUMN IF NOT EXISTS sf_content_version_id text,
  ADD COLUMN IF NOT EXISTS sf_owner_id text,
  ADD COLUMN IF NOT EXISTS sf_created_by_id text,
  ADD COLUMN IF NOT EXISTS sf_created_date timestamptz,
  ADD COLUMN IF NOT EXISTS sf_last_modified_date timestamptz,
  ADD COLUMN IF NOT EXISTS body_missing boolean NOT NULL DEFAULT false;

UPDATE public.crm_lead_files
   SET parent_type = 'opportunity'
 WHERE parent_type IS NULL AND lead_id IS NOT NULL;

ALTER TABLE public.crm_lead_files
  DROP CONSTRAINT IF EXISTS crm_lead_files_parent_present,
  ADD CONSTRAINT crm_lead_files_parent_present CHECK (
    (lead_id IS NOT NULL)::int
  + (company_id IS NOT NULL)::int
  + (contact_id IS NOT NULL)::int
  + (task_id IS NOT NULL)::int >= 1
  );

ALTER TABLE public.crm_lead_files
  DROP CONSTRAINT IF EXISTS crm_lead_files_parent_type_valid,
  ADD CONSTRAINT crm_lead_files_parent_type_valid CHECK (
    parent_type IS NULL OR parent_type IN ('account','contact','opportunity','task')
  );

-- A Salesforce document can legitimately be linked to several parents, so the
-- idempotency key is (salesforce_id + resolved parent), not salesforce_id alone.
CREATE UNIQUE INDEX IF NOT EXISTS crm_lead_files_sfid_parent_key
  ON public.crm_lead_files (
    salesforce_id,
    COALESCE(lead_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(contact_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(task_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) WHERE salesforce_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_lead_files_lead ON public.crm_lead_files (lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_lead_files_company ON public.crm_lead_files (company_id);
CREATE INDEX IF NOT EXISTS idx_crm_lead_files_contact ON public.crm_lead_files (contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_lead_files_task ON public.crm_lead_files (task_id);
CREATE INDEX IF NOT EXISTS idx_crm_lead_files_doc ON public.crm_lead_files (sf_content_document_id);
CREATE INDEX IF NOT EXISTS idx_crm_lead_files_path ON public.crm_lead_files (file_path);

-- ---------- crm_tasks ----------
ALTER TABLE public.crm_tasks
  ADD COLUMN IF NOT EXISTS salesforce_id text,
  ADD COLUMN IF NOT EXISTS sf_owner_id text,
  ADD COLUMN IF NOT EXISTS sf_created_by_id text,
  ADD COLUMN IF NOT EXISTS sf_who_id text,
  ADD COLUMN IF NOT EXISTS sf_what_id text,
  ADD COLUMN IF NOT EXISTS sf_status text,
  ADD COLUMN IF NOT EXISTS sf_priority text,
  ADD COLUMN IF NOT EXISTS sf_created_date timestamptz,
  ADD COLUMN IF NOT EXISTS sf_last_modified_date timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS crm_tasks_salesforce_id_key
  ON public.crm_tasks (salesforce_id) WHERE salesforce_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_tasks_company ON public.crm_tasks (company_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_contact ON public.crm_tasks (contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_lead ON public.crm_tasks (lead_id);

-- ---------- crm_leads / crm_companies / crm_contacts source metadata ----------
ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS sf_owner_id text,
  ADD COLUMN IF NOT EXISTS sf_created_date timestamptz,
  ADD COLUMN IF NOT EXISTS sf_last_modified_date timestamptz;

ALTER TABLE public.crm_companies
  ADD COLUMN IF NOT EXISTS sf_owner_id text,
  ADD COLUMN IF NOT EXISTS sf_created_date timestamptz,
  ADD COLUMN IF NOT EXISTS sf_last_modified_date timestamptz;

ALTER TABLE public.crm_contacts
  ADD COLUMN IF NOT EXISTS sf_owner_id text,
  ADD COLUMN IF NOT EXISTS sf_created_date timestamptz,
  ADD COLUMN IF NOT EXISTS sf_last_modified_date timestamptz;

-- ---------- grants (unchanged posture: CRM users only, no anon) ----------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_lead_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_lead_files TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_tasks TO authenticated;
GRANT ALL ON public.crm_lead_notes TO service_role;
GRANT ALL ON public.crm_lead_files TO service_role;
GRANT ALL ON public.crm_tasks TO service_role;