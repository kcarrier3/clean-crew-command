INSERT INTO public.permissions (name, display_name, description, category)
SELECT 'view_calendar', 'Planning Calendar', 'Can open and edit the planning calendar', 'Scheduling'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE name = 'view_calendar');

INSERT INTO public.user_permissions (user_id, permission)
SELECT p.id, 'view_calendar'::public.app_permission
FROM public.profiles p
WHERE p.active
  AND (
    (p.first_name ILIKE 'Brianna%' AND p.last_name ILIKE 'Stewart%')
    OR (p.first_name ILIKE 'Angela%' AND p.last_name ILIKE 'Thomas%' AND p.job_title = 'Janitorial Manager')
    OR (p.first_name ILIKE 'Nikki%' AND p.last_name ILIKE 'Adkins%' AND p.job_title = 'Supply Management')
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.user_permissions up WHERE up.user_id = p.id AND up.permission = 'view_calendar'
  );

DROP POLICY IF EXISTS "Managers and admins can view calendar drafts" ON public.calendar_drafts;
DROP POLICY IF EXISTS "Managers and admins can insert calendar drafts" ON public.calendar_drafts;
DROP POLICY IF EXISTS "Managers and admins can update calendar drafts" ON public.calendar_drafts;
DROP POLICY IF EXISTS "Managers and admins can delete calendar drafts" ON public.calendar_drafts;

CREATE POLICY "Calendar users can view calendar drafts" ON public.calendar_drafts
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'view_calendar'));

CREATE POLICY "Calendar users can insert calendar drafts" ON public.calendar_drafts
  FOR INSERT TO authenticated
  WITH CHECK ((public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'view_calendar')) AND created_by = auth.uid());

CREATE POLICY "Calendar users can update calendar drafts" ON public.calendar_drafts
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'view_calendar'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'view_calendar'));

CREATE POLICY "Calendar users can delete calendar drafts" ON public.calendar_drafts
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'view_calendar'));