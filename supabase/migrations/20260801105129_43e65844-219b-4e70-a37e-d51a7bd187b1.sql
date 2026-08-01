
-- 1. device_tokens: explicit per-command policies, authenticated only, with checks
DROP POLICY IF EXISTS "Users can manage their own device tokens" ON public.device_tokens;

CREATE POLICY "device_tokens_select_own" ON public.device_tokens
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "device_tokens_insert_own" ON public.device_tokens
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "device_tokens_update_own" ON public.device_tokens
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "device_tokens_delete_own" ON public.device_tokens
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 2. employee_document_submissions: lock signed/completed submissions
CREATE OR REPLACE FUNCTION public.lock_signed_document_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Once signed or no longer pending, immutable content fields are locked for everyone
  IF OLD.signed_at IS NOT NULL OR OLD.status IS DISTINCT FROM 'pending' THEN
    IF NEW.field_values IS DISTINCT FROM OLD.field_values
       OR NEW.form_data IS DISTINCT FROM OLD.form_data
       OR NEW.signature_data IS DISTINCT FROM OLD.signature_data
       OR NEW.signature_typed IS DISTINCT FROM OLD.signature_typed
       OR NEW.signed_at IS DISTINCT FROM OLD.signed_at
       OR NEW.filled_pdf_path IS DISTINCT FROM OLD.filled_pdf_path
       OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
       OR NEW.employee_id IS DISTINCT FROM OLD.employee_id
       OR NEW.document_id IS DISTINCT FROM OLD.document_id
       OR NEW.ip_address IS DISTINCT FROM OLD.ip_address
    THEN
      RAISE EXCEPTION 'Submitted documents are locked; only review fields may be updated';
    END IF;
  END IF;

  -- Reviewers (non-owners) may only change review metadata, never the employee's content
  IF auth.uid() IS DISTINCT FROM OLD.employee_id THEN
    IF NEW.field_values IS DISTINCT FROM OLD.field_values
       OR NEW.form_data IS DISTINCT FROM OLD.form_data
       OR NEW.signature_data IS DISTINCT FROM OLD.signature_data
       OR NEW.signature_typed IS DISTINCT FROM OLD.signature_typed
       OR NEW.signed_at IS DISTINCT FROM OLD.signed_at
       OR NEW.filled_pdf_path IS DISTINCT FROM OLD.filled_pdf_path
       OR NEW.employee_id IS DISTINCT FROM OLD.employee_id
       OR NEW.document_id IS DISTINCT FROM OLD.document_id
       OR NEW.ip_address IS DISTINCT FROM OLD.ip_address
    THEN
      RAISE EXCEPTION 'Reviewers may only update review fields on a submission';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.lock_signed_document_submission() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS lock_signed_document_submission_trg ON public.employee_document_submissions;
CREATE TRIGGER lock_signed_document_submission_trg
  BEFORE UPDATE ON public.employee_document_submissions
  FOR EACH ROW EXECUTE FUNCTION public.lock_signed_document_submission();

-- employee self-update also needs a WITH CHECK so they can't reassign the row
DROP POLICY IF EXISTS "submissions_employee_update" ON public.employee_document_submissions;
CREATE POLICY "submissions_employee_update" ON public.employee_document_submissions
  FOR UPDATE TO authenticated
  USING (employee_id = auth.uid() AND status = 'pending')
  WITH CHECK (employee_id = auth.uid());

-- 3. profiles manager scope: only admins may change department assignments
DROP POLICY IF EXISTS "Admins can manage department managers" ON public.department_managers;
CREATE POLICY "Admins can manage department managers" ON public.department_managers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins and managers can manage department employees" ON public.department_employees;
CREATE POLICY "Admins can manage department employees" ON public.department_employees
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- managers only see profiles in departments they manage AND only via admin-controlled assignments
DROP POLICY IF EXISTS "Managers can view profiles in their departments" ON public.profiles;
CREATE POLICY "Managers can view profiles in their departments" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager'::app_role)
    AND public.manager_can_view_profile(auth.uid(), id)
  );
