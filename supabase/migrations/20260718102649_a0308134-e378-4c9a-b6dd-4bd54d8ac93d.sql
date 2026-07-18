
ALTER TABLE public.crm_lead_notes
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS updated_by uuid;

CREATE OR REPLACE FUNCTION public.crm_lead_notes_set_updated_by()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = COALESCE(auth.uid(), NEW.updated_by);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_lead_notes_updated_by_trg ON public.crm_lead_notes;
CREATE TRIGGER crm_lead_notes_updated_by_trg
  BEFORE UPDATE ON public.crm_lead_notes
  FOR EACH ROW EXECUTE FUNCTION public.crm_lead_notes_set_updated_by();
