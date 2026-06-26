
-- =========================================================
-- 1. Replace permissive "Allow all" policies on sensitive tables
-- =========================================================

-- employee_schedules
DROP POLICY IF EXISTS "Allow all access to employee_schedules" ON public.employee_schedules;

CREATE POLICY "Employees view own schedules"
  ON public.employee_schedules FOR SELECT TO authenticated
  USING (
    employee_id = auth.uid()
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Managers manage schedules"
  ON public.employee_schedules FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'manager'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers update schedules"
  ON public.employee_schedules FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'manager'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'manager'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers delete schedules"
  ON public.employee_schedules FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'manager'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

-- employees
DROP POLICY IF EXISTS "Allow all access to employees" ON public.employees;

CREATE POLICY "Employees view own employee record"
  ON public.employees FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Managers manage employees insert"
  ON public.employees FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'manager'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers manage employees update"
  ON public.employees FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'manager'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'manager'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers manage employees delete"
  ON public.employees FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'manager'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

-- location_updates
DROP POLICY IF EXISTS "Allow all access to location_updates" ON public.location_updates;

CREATE POLICY "View own or managed location updates"
  ON public.location_updates FOR SELECT TO authenticated
  USING (
    employee_id = auth.uid()
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Insert own location updates"
  ON public.location_updates FOR INSERT TO authenticated
  WITH CHECK (
    employee_id = auth.uid()
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Managers update location updates"
  ON public.location_updates FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'manager'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'manager'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers delete location updates"
  ON public.location_updates FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'manager'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

-- monthly_budget_history (managers/admins only)
DROP POLICY IF EXISTS "Allow all access to monthly_budget_history" ON public.monthly_budget_history;

CREATE POLICY "Managers view budget history"
  ON public.monthly_budget_history FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'manager'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers insert budget history"
  ON public.monthly_budget_history FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'manager'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers update budget history"
  ON public.monthly_budget_history FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'manager'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'manager'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers delete budget history"
  ON public.monthly_budget_history FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'manager'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

-- time_entries
DROP POLICY IF EXISTS "Allow all access to time_entries" ON public.time_entries;

CREATE POLICY "View own time entries"
  ON public.time_entries FOR SELECT TO authenticated
  USING (
    employee_id = auth.uid()
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Insert own time entries"
  ON public.time_entries FOR INSERT TO authenticated
  WITH CHECK (
    employee_id = auth.uid()
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Update own or managed time entries"
  ON public.time_entries FOR UPDATE TO authenticated
  USING (
    employee_id = auth.uid()
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    employee_id = auth.uid()
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Managers delete time entries"
  ON public.time_entries FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'manager'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

-- time_off_requests (tighten existing always-true policies)
DROP POLICY IF EXISTS "Employees can create time off requests" ON public.time_off_requests;
DROP POLICY IF EXISTS "Employees can view their own time off requests" ON public.time_off_requests;
DROP POLICY IF EXISTS "Managers can update time off requests" ON public.time_off_requests;
DROP POLICY IF EXISTS "Managers can view all time off requests" ON public.time_off_requests;

CREATE POLICY "View own time off requests"
  ON public.time_off_requests FOR SELECT TO authenticated
  USING (
    employee_id = auth.uid()
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Create own time off requests"
  ON public.time_off_requests FOR INSERT TO authenticated
  WITH CHECK (employee_id = auth.uid());

CREATE POLICY "Managers update time off requests"
  ON public.time_off_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'manager'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'manager'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers delete time off requests"
  ON public.time_off_requests FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'manager'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

-- work_order_notes — mirror access to parent work order
DROP POLICY IF EXISTS "Users can create work order notes" ON public.work_order_notes;
DROP POLICY IF EXISTS "Users can view work order notes" ON public.work_order_notes;

CREATE POLICY "View accessible work order notes"
  ON public.work_order_notes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.work_orders wo
      WHERE wo.id = work_order_notes.work_order_id
        AND (
          wo.created_by = auth.uid()
          OR wo.assigned_to = auth.uid()
          OR public.has_role(auth.uid(), 'manager'::app_role)
          OR public.has_role(auth.uid(), 'admin'::app_role)
        )
    )
  );

CREATE POLICY "Create notes on accessible work orders"
  ON public.work_order_notes FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.work_orders wo
      WHERE wo.id = work_order_notes.work_order_id
        AND (
          wo.created_by = auth.uid()
          OR wo.assigned_to = auth.uid()
          OR public.has_role(auth.uid(), 'manager'::app_role)
          OR public.has_role(auth.uid(), 'admin'::app_role)
        )
    )
  );

CREATE POLICY "Authors or managers update work order notes"
  ON public.work_order_notes FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'manager'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'manager'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authors or managers delete work order notes"
  ON public.work_order_notes FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'manager'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

-- =========================================================
-- 2. Restrict profiles compensation columns to admins only
--    Replace the "Managers can view all profiles" policy so only admins
--    get the full row; managers/everyone else are scoped to their own profile.
--    Compensation/financial fields should only be readable by admins via direct table access.
-- =========================================================
DROP POLICY IF EXISTS "Managers can view all profiles" ON public.profiles;

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Provide managers with a safe view that excludes compensation/geofence fields.
CREATE OR REPLACE VIEW public.profiles_directory
WITH (security_invoker = true) AS
SELECT
  id, first_name, last_name, email, phone, job_title, employee_id, active,
  created_at, updated_at
FROM public.profiles;

GRANT SELECT ON public.profiles_directory TO authenticated;

-- =========================================================
-- 3. Storage: tighten work-order-photos write policies to owners only
-- =========================================================
DROP POLICY IF EXISTS "Users can delete their own work order photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own work order photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload work order photos" ON storage.objects;

CREATE POLICY "Owners or managers delete work order photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'work-order-photos'
    AND (
      owner = auth.uid()
      OR public.has_role(auth.uid(), 'manager'::app_role)
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

CREATE POLICY "Owners or managers update work order photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'work-order-photos'
    AND (
      owner = auth.uid()
      OR public.has_role(auth.uid(), 'manager'::app_role)
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  )
  WITH CHECK (bucket_id = 'work-order-photos');

-- =========================================================
-- 4. Realtime: limit broadcast subscriptions to conversation participants
-- =========================================================
CREATE POLICY "Conversation participants receive realtime messages"
  ON realtime.messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.user_id = auth.uid()
        AND cp.conversation_id::text = realtime.topic()
    )
  );

-- =========================================================
-- 5. Pin search_path on remaining functions that lack it
-- =========================================================
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.cleanup_old_device_tokens() SET search_path = public;
ALTER FUNCTION public.enforce_single_primary_contact() SET search_path = public;
ALTER FUNCTION public.compute_inspection_score(uuid) SET search_path = public;
ALTER FUNCTION public.create_group_conversation(text, text, uuid[], uuid) SET search_path = public;
ALTER FUNCTION public.create_announcement(text, text, text) SET search_path = public;
ALTER FUNCTION public.get_my_conversations() SET search_path = public;
ALTER FUNCTION public.mark_conversation_read(uuid) SET search_path = public;
ALTER FUNCTION public.get_coworkers_at_shared_accounts() SET search_path = public;

-- =========================================================
-- 6. Revoke EXECUTE from anon/public on SECURITY DEFINER functions
--    Keep authenticated/service_role for user-callable ones; service_role only for trigger/internal.
-- =========================================================

-- Trigger-only / internal functions: service_role only
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_conversation_last_message() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_device_tokens() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_job_site_hours() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_single_primary_contact() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_default_employee_permissions(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_default_manager_permissions(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.initialize_monthly_budget(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compute_inspection_score(uuid) FROM PUBLIC, anon, authenticated;

-- User-callable functions: revoke from anon, keep authenticated
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_conversation_participant(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, app_permission) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_job_site_sensitive_info(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_or_create_conversation(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_all_permissions(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_message_user(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_employee_managers(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_employee_department_managers(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_own_account() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_group_conversation(text, text, uuid[], uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_announcement(text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_conversations() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_conversation_read(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_coworkers_at_shared_accounts() FROM PUBLIC, anon;
