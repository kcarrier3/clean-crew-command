-- Waypoint access is now title/permission based instead of "any manager".
CREATE OR REPLACE FUNCTION public.is_crm_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin'::app_role)
    OR public.has_permission(_user_id, 'view_crm'::app_permission)
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = _user_id
        AND job_title IN ('Owner', 'Office Manager', 'Sales Rep')
    )
$$;

REVOKE EXECUTE ON FUNCTION public.is_crm_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_crm_user(uuid) TO authenticated, service_role;

-- Sales goal setting: readable by all signed-in users, editable by managers/admins.
DROP POLICY IF EXISTS "Authenticated users can view sales goals" ON public.app_settings;
CREATE POLICY "Authenticated users can view sales goals"
ON public.app_settings FOR SELECT TO authenticated
USING (key = 'sales_goals');

DROP POLICY IF EXISTS "Managers can manage sales goals" ON public.app_settings;
CREATE POLICY "Managers can manage sales goals"
ON public.app_settings FOR ALL TO authenticated
USING (key = 'sales_goals' AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role)))
WITH CHECK (key = 'sales_goals' AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role)));