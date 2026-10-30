-- Project Crew Leads may view schedules but never change them (overrides manager/admin role).
DROP POLICY IF EXISTS "No schedule inserts by project crew leads" ON public.employee_schedules;
DROP POLICY IF EXISTS "No schedule updates by project crew leads" ON public.employee_schedules;
DROP POLICY IF EXISTS "No schedule deletes by project crew leads" ON public.employee_schedules;
CREATE POLICY "No schedule inserts by project crew leads" ON public.employee_schedules
  AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.is_project_crew_lead(auth.uid()));
CREATE POLICY "No schedule updates by project crew leads" ON public.employee_schedules
  AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT public.is_project_crew_lead(auth.uid())) WITH CHECK (NOT public.is_project_crew_lead(auth.uid()));
CREATE POLICY "No schedule deletes by project crew leads" ON public.employee_schedules
  AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT public.is_project_crew_lead(auth.uid()));

DROP POLICY IF EXISTS "No schedule week inserts by project crew leads" ON public.schedule_weeks;
DROP POLICY IF EXISTS "No schedule week updates by project crew leads" ON public.schedule_weeks;
CREATE POLICY "No schedule week inserts by project crew leads" ON public.schedule_weeks
  AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.is_project_crew_lead(auth.uid()));
CREATE POLICY "No schedule week updates by project crew leads" ON public.schedule_weeks
  AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT public.is_project_crew_lead(auth.uid())) WITH CHECK (NOT public.is_project_crew_lead(auth.uid()));

-- Existing crew leads: drop schedule edit/publish grants; keep view_schedules.
DELETE FROM public.user_permissions up
USING public.profiles p
WHERE p.id = up.user_id
  AND p.job_title = 'Project Crew Lead'
  AND up.permission IN ('edit_schedules'::app_permission, 'publish_schedules'::app_permission);