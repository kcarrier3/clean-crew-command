
DROP POLICY IF EXISTS "onboarding_files_employee_read_own" ON storage.objects;
DROP POLICY IF EXISTS "onboarding_files_employee_write_own" ON storage.objects;
DROP POLICY IF EXISTS "onboarding_files_employee_update_own" ON storage.objects;
DROP POLICY IF EXISTS "onboarding_files_employee_delete_own" ON storage.objects;

CREATE POLICY "onboarding_files_employee_read_own"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'onboarding-files'
    AND (
      (storage.foldername(name))[1] = 'templates'
      OR (
        (storage.foldername(name))[1] IN ('submissions', 'id-documents')
        AND (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  );

CREATE POLICY "onboarding_files_employee_write_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'onboarding-files'
    AND (storage.foldername(name))[1] IN ('submissions', 'id-documents')
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

CREATE POLICY "onboarding_files_employee_update_own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'onboarding-files'
    AND (storage.foldername(name))[1] IN ('submissions', 'id-documents')
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

CREATE POLICY "onboarding_files_employee_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'onboarding-files'
    AND (storage.foldername(name))[1] IN ('submissions', 'id-documents')
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
