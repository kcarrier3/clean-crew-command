-- 1. Position defaults: only Owner, Office Manager, Operations Manager keep edit_time_tracking
DELETE FROM public.job_title_permissions
WHERE permission = 'edit_time_tracking'
  AND job_title NOT IN ('Owner', 'Office Manager', 'Operations Manager');

-- 2. Individuals: strip edit_time_tracking from anyone not in those three titles
DELETE FROM public.user_permissions
WHERE permission = 'edit_time_tracking'
  AND user_id NOT IN (
    SELECT id FROM public.profiles
    WHERE job_title IN ('Owner', 'Office Manager', 'Operations Manager')
  );

-- 3. Individuals: make sure everyone in those three titles has it
INSERT INTO public.user_permissions (user_id, permission)
SELECT p.id, 'edit_time_tracking'
FROM public.profiles p
WHERE p.job_title IN ('Owner', 'Office Manager', 'Operations Manager')
  AND NOT EXISTS (
    SELECT 1 FROM public.user_permissions up
    WHERE up.user_id = p.id AND up.permission = 'edit_time_tracking'
  );

-- 4. Enforce in the database: managing others' time entries requires the permission.
--    Workers keep access to their own entries (punch in/out, viewing).
DROP POLICY "Insert own time entries" ON public.time_entries;
CREATE POLICY "Insert own time entries" ON public.time_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    employee_id = auth.uid()
    OR public.has_permission(auth.uid(), 'edit_time_tracking')
  );

DROP POLICY "Update own or managed time entries" ON public.time_entries;
CREATE POLICY "Update own or managed time entries" ON public.time_entries
  FOR UPDATE TO authenticated
  USING (
    employee_id = auth.uid()
    OR public.has_permission(auth.uid(), 'edit_time_tracking')
  )
  WITH CHECK (
    employee_id = auth.uid()
    OR public.has_permission(auth.uid(), 'edit_time_tracking')
  );

DROP POLICY "Managers delete time entries" ON public.time_entries;
CREATE POLICY "Managers delete time entries" ON public.time_entries
  FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'edit_time_tracking'));