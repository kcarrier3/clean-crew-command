
ALTER TABLE public.job_sites
  ADD COLUMN IF NOT EXISTS qr_code_token uuid UNIQUE DEFAULT gen_random_uuid();

UPDATE public.job_sites SET qr_code_token = gen_random_uuid() WHERE qr_code_token IS NULL;

ALTER TABLE public.job_sites ALTER COLUMN qr_code_token SET NOT NULL;

CREATE OR REPLACE FUNCTION public.regenerate_job_site_qr_token(_job_site_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_token uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role)) THEN
    RAISE EXCEPTION 'Not authorized to regenerate QR token';
  END IF;

  _new_token := gen_random_uuid();
  UPDATE public.job_sites SET qr_code_token = _new_token, updated_at = now() WHERE id = _job_site_id;
  RETURN _new_token;
END;
$$;

REVOKE ALL ON FUNCTION public.regenerate_job_site_qr_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.regenerate_job_site_qr_token(uuid) TO authenticated;
