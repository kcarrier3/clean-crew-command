ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS lost_reason text,
  ADD COLUMN IF NOT EXISTS lost_notes text,
  ADD COLUMN IF NOT EXISTS lost_competitor text,
  ADD COLUMN IF NOT EXISTS lost_at timestamptz;

CREATE OR REPLACE FUNCTION public.crm_lead_set_lost_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_lost boolean;
BEGIN
  _is_lost := NEW.status = 'unqualified'
    OR EXISTS (SELECT 1 FROM public.crm_pipeline_stages s WHERE s.id = NEW.stage_id AND s.is_lost);
  IF _is_lost THEN
    IF NEW.lost_at IS NULL THEN
      NEW.lost_at := now();
    END IF;
  ELSE
    NEW.lost_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_leads_set_lost_at ON public.crm_leads;
CREATE TRIGGER crm_leads_set_lost_at
BEFORE INSERT OR UPDATE ON public.crm_leads
FOR EACH ROW EXECUTE FUNCTION public.crm_lead_set_lost_at();

UPDATE public.crm_leads l
SET lost_at = COALESCE(l.updated_at, l.created_at)
WHERE l.lost_at IS NULL
  AND (l.status = 'unqualified'
       OR EXISTS (SELECT 1 FROM public.crm_pipeline_stages s WHERE s.id = l.stage_id AND s.is_lost));