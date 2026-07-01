
-- 1. Prevent self-escalation via profile updates (job_title, pay, geofencing, etc.)
CREATE OR REPLACE FUNCTION public.prevent_profile_privileged_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND auth.uid() = OLD.id
     AND NOT public.has_role(auth.uid(), 'admin'::app_role)
  THEN
    IF NEW.job_title IS DISTINCT FROM OLD.job_title
       OR NEW.hourly_rate IS DISTINCT FROM OLD.hourly_rate
       OR NEW.salary_amount IS DISTINCT FROM OLD.salary_amount
       OR NEW.pay_type IS DISTINCT FROM OLD.pay_type
       OR NEW.attendance_bonus_amount IS DISTINCT FROM OLD.attendance_bonus_amount
       OR NEW.time_bonus_amount IS DISTINCT FROM OLD.time_bonus_amount
       OR NEW.employee_id IS DISTINCT FROM OLD.employee_id
       OR NEW.require_geofencing IS DISTINCT FROM OLD.require_geofencing
       OR NEW.geofence_lat IS DISTINCT FROM OLD.geofence_lat
       OR NEW.geofence_lng IS DISTINCT FROM OLD.geofence_lng
       OR NEW.geofence_radius_meters IS DISTINCT FROM OLD.geofence_radius_meters
       OR NEW.active IS DISTINCT FROM OLD.active
       OR NEW.hire_date IS DISTINCT FROM OLD.hire_date
    THEN
      RAISE EXCEPTION 'You are not allowed to modify privileged profile fields';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_privileged_self_update ON public.profiles;
CREATE TRIGGER prevent_profile_privileged_self_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_privileged_self_update();

REVOKE EXECUTE ON FUNCTION public.prevent_profile_privileged_self_update() FROM PUBLIC, anon, authenticated;

-- 2. Allow managers (in addition to admins) to view all profiles
DROP POLICY IF EXISTS "Managers can view all profiles" ON public.profiles;
CREATE POLICY "Managers can view all profiles" ON public.profiles
FOR SELECT
USING (public.has_role(auth.uid(), 'manager'::app_role));

-- 3. Harden is_crm_user to rely on roles only (job_title also now locked, but defense-in-depth)
CREATE OR REPLACE FUNCTION public.is_crm_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::app_role)
      OR public.has_role(_user_id, 'manager'::app_role);
$$;

-- 4. Inspection photos: only inspector for that specific inspection, or manager/admin
DROP POLICY IF EXISTS "inspection_photos_storage_read" ON storage.objects;
CREATE POLICY "inspection_photos_storage_read" ON storage.objects
FOR SELECT
USING (
  bucket_id = 'inspection-photos'
  AND (
    public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.inspection_photos ip
      JOIN public.inspections i ON i.id = ip.inspection_id
      WHERE ip.storage_path = storage.objects.name
        AND i.inspector_id = auth.uid()
    )
  )
);

-- 5. Work order photos storage: mirror table-level assignment check
DROP POLICY IF EXISTS "View work order photos by access" ON storage.objects;
CREATE POLICY "View work order photos by access" ON storage.objects
FOR SELECT
USING (
  bucket_id = 'work-order-photos'
  AND (
    public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.work_order_photos wop
      JOIN public.work_orders wo ON wo.id = wop.work_order_id
      WHERE (wop.photo_url = storage.objects.name OR wop.photo_url LIKE '%' || storage.objects.name)
        AND (wo.assigned_to = auth.uid() OR wo.created_by = auth.uid() OR wop.uploaded_by = auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "Owners or managers delete work order photos" ON storage.objects;
CREATE POLICY "Owners or managers delete work order photos" ON storage.objects
FOR DELETE
USING (
  bucket_id = 'work-order-photos'
  AND (
    public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.work_order_photos wop
      WHERE (wop.photo_url = storage.objects.name OR wop.photo_url LIKE '%' || storage.objects.name)
        AND wop.uploaded_by = auth.uid()
    )
  )
);

-- 6. Revoke EXECUTE on internal trigger and helper functions from anon/authenticated
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_conversation_last_message() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_job_site_hours() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_single_primary_contact() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_default_employee_permissions(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_default_manager_permissions(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_device_tokens() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.initialize_monthly_budget(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compute_inspection_score(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_owner_profile() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_supply_movement() FROM PUBLIC, anon, authenticated;
