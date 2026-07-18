
-- 1) directory_access_rules: restrict SELECT to managers/admins
DROP POLICY IF EXISTS "Authenticated can view directory rules" ON public.directory_access_rules;
CREATE POLICY "Managers and admins can view directory rules"
ON public.directory_access_rules
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- 2) onboarding_documents: employees only see required/auto-assigned active docs
DROP POLICY IF EXISTS "onboarding_docs_read" ON public.onboarding_documents;
CREATE POLICY "onboarding_docs_read"
ON public.onboarding_documents
FOR SELECT
TO authenticated
USING (
  is_crm_user(auth.uid())
  OR (active = true AND (is_required = true OR auto_assign = true))
);

-- 3) profiles: scope manager visibility to their departments
CREATE OR REPLACE FUNCTION public.manager_can_view_profile(_manager_id uuid, _employee_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _manager_id = _employee_id
    OR EXISTS (
      SELECT 1
      FROM public.department_managers dm
      JOIN public.department_employees de ON de.department_id = dm.department_id
      WHERE dm.manager_id = _manager_id
        AND de.employee_id = _employee_id
    );
$$;

DROP POLICY IF EXISTS "Managers can view all profiles" ON public.profiles;
CREATE POLICY "Managers can view profiles in their departments"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'manager'::app_role)
  AND public.manager_can_view_profile(auth.uid(), id)
);

-- 4) work-order-photos storage: exact path equality only (no LIKE fallback)
DROP POLICY IF EXISTS "View work order photos by access" ON storage.objects;
CREATE POLICY "View work order photos by access"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'work-order-photos'
  AND (
    has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.work_order_photos wop
      JOIN public.work_orders wo ON wo.id = wop.work_order_id
      WHERE wop.photo_url = storage.objects.name
        AND (wo.assigned_to = auth.uid() OR wo.created_by = auth.uid() OR wop.uploaded_by = auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "Owners or managers delete work order photos" ON storage.objects;
CREATE POLICY "Owners or managers delete work order photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'work-order-photos'
  AND (
    has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.work_order_photos wop
      WHERE wop.photo_url = storage.objects.name
        AND wop.uploaded_by = auth.uid()
    )
  )
);

-- 5) Revoke anon/authenticated EXECUTE on internal trigger function
REVOKE ALL ON FUNCTION public.log_supply_item_cost_change() FROM PUBLIC, anon, authenticated;
