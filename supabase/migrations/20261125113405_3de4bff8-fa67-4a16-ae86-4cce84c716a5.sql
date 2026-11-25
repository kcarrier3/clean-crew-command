CREATE OR REPLACE FUNCTION public.can_view_employee_documents(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _user_id
    AND p.job_title IN ('Owner','Office Manager','Operations Manager'));
$$;
REVOKE EXECUTE ON FUNCTION public.can_view_employee_documents(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_employee_documents(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS submissions_read ON public.employee_document_submissions;
CREATE POLICY submissions_read ON public.employee_document_submissions FOR SELECT TO authenticated
  USING (employee_id = auth.uid() OR public.can_view_employee_documents(auth.uid()));
DROP POLICY IF EXISTS submissions_admin_update ON public.employee_document_submissions;
CREATE POLICY submissions_admin_update ON public.employee_document_submissions FOR UPDATE TO authenticated
  USING (public.can_view_employee_documents(auth.uid())) WITH CHECK (public.can_view_employee_documents(auth.uid()));

DROP POLICY IF EXISTS onboarding_docs_admin_write ON public.onboarding_documents;
CREATE POLICY onboarding_docs_admin_write ON public.onboarding_documents FOR ALL TO authenticated
  USING (public.can_view_employee_documents(auth.uid())) WITH CHECK (public.can_view_employee_documents(auth.uid()));
DROP POLICY IF EXISTS onboarding_docs_read ON public.onboarding_documents;
CREATE POLICY onboarding_docs_read ON public.onboarding_documents FOR SELECT TO authenticated
  USING (public.can_view_employee_documents(auth.uid()) OR (active AND (is_required OR auto_assign)));

DROP POLICY IF EXISTS onboarding_files_admin_all ON storage.objects;
CREATE POLICY onboarding_files_admin_all ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'onboarding-files' AND public.can_view_employee_documents(auth.uid()))
  WITH CHECK (bucket_id = 'onboarding-files' AND public.can_view_employee_documents(auth.uid()));