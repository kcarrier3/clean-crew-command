
-- Allow admins to update and delete profiles
CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete profiles" ON public.profiles
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Protect Owner accounts from being deactivated or deleted
CREATE OR REPLACE FUNCTION public.protect_owner_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.job_title = 'Owner' THEN
      RAISE EXCEPTION 'Owner accounts cannot be deleted';
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.job_title = 'Owner' AND (NEW.active = false OR NEW.job_title IS DISTINCT FROM 'Owner') THEN
      -- Allow changes only if performed by the Owner themselves
      IF auth.uid() IS DISTINCT FROM OLD.id THEN
        RAISE EXCEPTION 'Owner accounts cannot be deactivated or have their role changed by another user';
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_owner_profile_trg ON public.profiles;
CREATE TRIGGER protect_owner_profile_trg
  BEFORE UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_owner_profile();
