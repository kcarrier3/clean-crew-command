
-- 1) Revoke anon EXECUTE on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.manager_can_view_profile(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.crm_lead_notes_set_updated_by() FROM anon, PUBLIC;

-- 2) Scope departments SELECT policies to relevant users
DROP POLICY IF EXISTS "Authenticated users can view departments" ON public.departments;
DROP POLICY IF EXISTS "Authenticated users can view department managers" ON public.department_managers;
DROP POLICY IF EXISTS "Authenticated users can view department employees" ON public.department_employees;

CREATE POLICY "Users can view relevant departments"
ON public.departments FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
  OR EXISTS (SELECT 1 FROM public.department_employees de WHERE de.department_id = departments.id AND de.employee_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.department_managers dm WHERE dm.department_id = departments.id AND dm.manager_id = auth.uid())
);

CREATE POLICY "Users can view relevant department managers"
ON public.department_managers FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
  OR manager_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.department_employees de WHERE de.department_id = department_managers.department_id AND de.employee_id = auth.uid())
);

CREATE POLICY "Users can view relevant department employees"
ON public.department_employees FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
  OR employee_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.department_managers dm WHERE dm.department_id = department_employees.department_id AND dm.manager_id = auth.uid())
);
