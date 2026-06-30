
DROP POLICY IF EXISTS "Users can view basic job site info" ON public.job_sites;
CREATE POLICY "Users view permitted job sites" ON public.job_sites
  FOR SELECT TO authenticated
  USING (public.can_access_job_site_sensitive_info(auth.uid(), id));

DROP POLICY IF EXISTS "System can insert late notifications" ON public.late_notifications;
CREATE POLICY "Only service role inserts late notifications" ON public.late_notifications
  FOR INSERT TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "System can insert missed punch notifications" ON public.missed_punch_notifications;
CREATE POLICY "Only service role inserts missed punch notifications" ON public.missed_punch_notifications
  FOR INSERT TO service_role
  WITH CHECK (true);

ALTER TABLE public.employees DROP COLUMN IF EXISTS hourly_rate;

DROP POLICY IF EXISTS "Authenticated users can view work order photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload work order photos" ON storage.objects;

CREATE POLICY "View work order photos by access" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'work-order-photos'
    AND (
      owner = auth.uid()
      OR public.has_role(auth.uid(), 'manager'::app_role)
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

CREATE POLICY "Upload work order photos by owner" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'work-order-photos'
    AND owner = auth.uid()
  );

DROP POLICY IF EXISTS "inspection_photos_upload" ON storage.objects;
DROP POLICY IF EXISTS "inspection_photos_storage_read" ON storage.objects;

CREATE POLICY "inspection_photos_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'inspection-photos'
    AND (
      public.has_role(auth.uid(), 'manager'::app_role)
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (SELECT 1 FROM public.inspections i WHERE i.inspector_id = auth.uid())
    )
  );

CREATE POLICY "inspection_photos_storage_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'inspection-photos'
    AND (
      public.has_role(auth.uid(), 'manager'::app_role)
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (SELECT 1 FROM public.inspections i WHERE i.inspector_id = auth.uid())
    )
  );

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, app_permission) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.get_user_all_permissions(uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.is_conversation_participant(uuid, uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.can_message_user(uuid, uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.can_access_job_site_sensitive_info(uuid, uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.is_crm_user(uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.get_employee_managers(uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.get_employee_department_managers(uuid) FROM authenticated, anon, public;
