
ALTER TABLE public.onboarding_documents
  ADD COLUMN IF NOT EXISTS source_pdf_path TEXT,
  ADD COLUMN IF NOT EXISTS field_schema JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS auto_assign BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.employee_document_submissions
  ADD COLUMN IF NOT EXISTS field_values JSONB,
  ADD COLUMN IF NOT EXISTS filled_pdf_path TEXT;

DROP POLICY IF EXISTS "onboarding_docs_write" ON public.onboarding_documents;
DROP POLICY IF EXISTS "onboarding_docs_read" ON public.onboarding_documents;
DROP POLICY IF EXISTS "submissions_read" ON public.employee_document_submissions;
DROP POLICY IF EXISTS "submissions_manager_update" ON public.employee_document_submissions;

CREATE POLICY "onboarding_docs_read"
  ON public.onboarding_documents
  FOR SELECT TO authenticated
  USING (active = true OR public.is_crm_user(auth.uid()));

CREATE POLICY "onboarding_docs_admin_write"
  ON public.onboarding_documents
  FOR ALL TO authenticated
  USING (public.is_crm_user(auth.uid()))
  WITH CHECK (public.is_crm_user(auth.uid()));

CREATE POLICY "submissions_read"
  ON public.employee_document_submissions
  FOR SELECT TO authenticated
  USING (employee_id = auth.uid() OR public.is_crm_user(auth.uid()));

CREATE POLICY "submissions_admin_update"
  ON public.employee_document_submissions
  FOR UPDATE TO authenticated
  USING (public.is_crm_user(auth.uid()))
  WITH CHECK (public.is_crm_user(auth.uid()));

DROP POLICY IF EXISTS "onboarding_files_admin_all" ON storage.objects;
DROP POLICY IF EXISTS "onboarding_files_employee_read_own" ON storage.objects;
DROP POLICY IF EXISTS "onboarding_files_employee_write_own" ON storage.objects;
DROP POLICY IF EXISTS "onboarding_files_employee_update_own" ON storage.objects;

CREATE POLICY "onboarding_files_admin_all"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'onboarding-files' AND public.is_crm_user(auth.uid()))
  WITH CHECK (bucket_id = 'onboarding-files' AND public.is_crm_user(auth.uid()));

CREATE POLICY "onboarding_files_employee_read_own"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'onboarding-files'
    AND (
      (storage.foldername(name))[1] = 'templates'
      OR (
        (storage.foldername(name))[1] = 'submissions'
        AND (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  );

CREATE POLICY "onboarding_files_employee_write_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'onboarding-files'
    AND (storage.foldername(name))[1] = 'submissions'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

CREATE POLICY "onboarding_files_employee_update_own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'onboarding-files'
    AND (storage.foldername(name))[1] = 'submissions'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
