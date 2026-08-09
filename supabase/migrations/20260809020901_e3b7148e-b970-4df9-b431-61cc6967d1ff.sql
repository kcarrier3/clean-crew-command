CREATE OR REPLACE FUNCTION public.lock_completed_estimate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'completed' AND NEW.status = 'completed' THEN
    RAISE EXCEPTION 'Completed estimates are read-only. Reopen the estimate for edits first.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.lock_completed_estimate_revision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'completed' AND NEW.status = 'completed' THEN
    RAISE EXCEPTION 'Completed estimates are read-only. Reopen the estimate for edits first.';
  END IF;
  RETURN NEW;
END;
$$;