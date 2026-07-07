
-- ============================================================
-- 1) account_contacts: scope reads to managers or job-site staff
-- ============================================================
DROP POLICY IF EXISTS account_contacts_read ON public.account_contacts;
CREATE POLICY account_contacts_read ON public.account_contacts
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.can_access_job_site_sensitive_info(auth.uid(), job_site_id)
  );

-- ============================================================
-- 2) inspections + related: scope reads
-- ============================================================
DROP POLICY IF EXISTS inspections_read ON public.inspections;
CREATE POLICY inspections_read ON public.inspections
  FOR SELECT TO authenticated
  USING (
    inspector_id = auth.uid()
    OR employee_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.can_access_job_site_sensitive_info(auth.uid(), job_site_id)
  );

DROP POLICY IF EXISTS inspection_items_read ON public.inspection_items;
CREATE POLICY inspection_items_read ON public.inspection_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.inspections i
      WHERE i.id = inspection_items.inspection_id
        AND (
          i.inspector_id = auth.uid()
          OR i.employee_id = auth.uid()
          OR public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'manager'::app_role)
          OR public.can_access_job_site_sensitive_info(auth.uid(), i.job_site_id)
        )
    )
  );

DROP POLICY IF EXISTS inspection_photos_read ON public.inspection_photos;
CREATE POLICY inspection_photos_read ON public.inspection_photos
  FOR SELECT TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.inspections i
      WHERE i.id = inspection_photos.inspection_id
        AND (
          i.inspector_id = auth.uid()
          OR i.employee_id = auth.uid()
          OR public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'manager'::app_role)
          OR public.can_access_job_site_sensitive_info(auth.uid(), i.job_site_id)
        )
    )
  );

-- Templates: restrict to managers/admins (used by inspectors when starting inspections)
DROP POLICY IF EXISTS inspection_templates_read ON public.inspection_templates;
CREATE POLICY inspection_templates_read ON public.inspection_templates
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  );

DROP POLICY IF EXISTS inspection_template_items_read ON public.inspection_template_items;
CREATE POLICY inspection_template_items_read ON public.inspection_template_items
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  );

-- ============================================================
-- 3) permissions / roles / role_permissions: authenticated only
-- ============================================================
DROP POLICY IF EXISTS "Everyone can view permissions" ON public.permissions;
CREATE POLICY "Authenticated can view permissions" ON public.permissions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Everyone can view roles" ON public.roles;
CREATE POLICY "Authenticated can view roles" ON public.roles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Everyone can view role permissions" ON public.role_permissions;
CREATE POLICY "Authenticated can view role permissions" ON public.role_permissions
  FOR SELECT TO authenticated USING (true);

-- Revoke any lingering anon SELECT grants on these catalogs
REVOKE SELECT ON public.permissions FROM anon;
REVOKE SELECT ON public.roles FROM anon;
REVOKE SELECT ON public.role_permissions FROM anon;

-- ============================================================
-- 4) SECURITY DEFINER functions: remove anon/public EXECUTE
-- ============================================================
-- Trigger-only or internal helper functions: lock down entirely
REVOKE EXECUTE ON FUNCTION public.apply_supply_movement() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_device_tokens() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_profile_privileged_self_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_owner_profile() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_conversation_last_message() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_job_site_hours() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compute_inspection_score(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.initialize_monthly_budget(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_default_employee_permissions(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_default_manager_permissions(uuid) FROM PUBLIC, anon, authenticated;

-- Policy helper functions and user RPCs: remove anon/public, keep authenticated
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, app_permission) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_supply_manager(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_crm_user(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_job_site_sensitive_info(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_conversation_participant(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_message_user(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_all_permissions(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_own_account() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_or_create_conversation(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_conversations() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_conversation_read(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_group_conversation(text, text, uuid[], uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_announcement(text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_coworkers_at_shared_accounts() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_employee_managers(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_employee_department_managers(uuid) FROM PUBLIC, anon;
