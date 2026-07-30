-- Remove approval workflow
DROP TRIGGER IF EXISTS enforce_estimate_approval_rights_trg ON public.estimates;
DROP FUNCTION IF EXISTS public.enforce_estimate_approval_rights() CASCADE;

ALTER TABLE public.estimates
  DROP COLUMN IF EXISTS approved_by,
  DROP COLUMN IF EXISTS approved_at,
  DROP COLUMN IF EXISTS rejection_reason;

-- Require a CRM opportunity
DELETE FROM public.estimates WHERE lead_id IS NULL;
ALTER TABLE public.estimates
  ALTER COLUMN lead_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'estimates_lead_id_fkey'
  ) THEN
    ALTER TABLE public.estimates
      ADD CONSTRAINT estimates_lead_id_fkey
      FOREIGN KEY (lead_id) REFERENCES public.crm_leads(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Status limited to draft / completed
UPDATE public.estimates SET status = 'draft' WHERE status <> 'completed';
UPDATE public.estimate_revisions SET status = 'draft' WHERE status <> 'completed';

ALTER TABLE public.estimates DROP CONSTRAINT IF EXISTS estimates_status_check;
ALTER TABLE public.estimates
  ADD CONSTRAINT estimates_status_check CHECK (status IN ('draft','completed'));

ALTER TABLE public.estimate_revisions DROP CONSTRAINT IF EXISTS estimate_revisions_status_check;
ALTER TABLE public.estimate_revisions
  ADD CONSTRAINT estimate_revisions_status_check CHECK (status IN ('draft','completed'));

ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS completed_by uuid;

-- Completed estimates are immutable snapshots
CREATE OR REPLACE FUNCTION public.lock_completed_estimate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status = 'completed' THEN
    RAISE EXCEPTION 'Completed estimates are read-only. Duplicate as a new draft to make changes.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lock_completed_estimate_trg ON public.estimates;
CREATE TRIGGER lock_completed_estimate_trg
  BEFORE UPDATE ON public.estimates
  FOR EACH ROW EXECUTE FUNCTION public.lock_completed_estimate();

CREATE OR REPLACE FUNCTION public.lock_completed_estimate_revision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status = 'completed' THEN
    RAISE EXCEPTION 'Completed estimates are read-only. Duplicate as a new draft to make changes.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lock_completed_estimate_revision_trg ON public.estimate_revisions;
CREATE TRIGGER lock_completed_estimate_revision_trg
  BEFORE UPDATE ON public.estimate_revisions
  FOR EACH ROW EXECUTE FUNCTION public.lock_completed_estimate_revision();

REVOKE EXECUTE ON FUNCTION public.lock_completed_estimate() FROM anon;
REVOKE EXECUTE ON FUNCTION public.lock_completed_estimate_revision() FROM anon;