
-- 1. app_settings: restrict SELECT to admins
DROP POLICY IF EXISTS "Authenticated users can view app settings" ON public.app_settings;
CREATE POLICY "Admins can view app settings"
  ON public.app_settings FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. company_contacts: restrict SELECT to managers/admins
DROP POLICY IF EXISTS "Any authenticated user can view company contacts" ON public.company_contacts;
CREATE POLICY "Managers and admins can view company contacts"
  ON public.company_contacts FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

-- 3. permissions / roles / role_permissions: restrict SELECT to admins
DROP POLICY IF EXISTS "Authenticated can view permissions" ON public.permissions;
CREATE POLICY "Admins can view permissions"
  ON public.permissions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated can view roles" ON public.roles;
CREATE POLICY "Admins can view roles"
  ON public.roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated can view role permissions" ON public.role_permissions;
CREATE POLICY "Admins can view role permissions"
  ON public.role_permissions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 4. inspection-photos storage upload: require folder to match an inspection the uploader owns
DROP POLICY IF EXISTS "inspection_photos_upload" ON storage.objects;
CREATE POLICY "inspection_photos_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'inspection-photos'
    AND (
      public.has_role(auth.uid(), 'manager'::app_role)
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.inspections i
        WHERE i.id::text = (storage.foldername(name))[1]
          AND i.inspector_id = auth.uid()
      )
    )
  );

-- 5. Revoke anon access to SECURITY DEFINER function
REVOKE EXECUTE ON FUNCTION public.regenerate_job_site_qr_token(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.regenerate_job_site_qr_token(uuid) TO authenticated;
