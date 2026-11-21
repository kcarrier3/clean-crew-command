DROP POLICY "Managers read position permissions" ON public.job_title_permissions;
DROP POLICY "Admins manage position permissions" ON public.job_title_permissions;
CREATE POLICY "Managers read position permissions" ON public.job_title_permissions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "Admins add position permissions" ON public.job_title_permissions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') AND NOT (job_title = 'Project Crew Lead' AND permission = 'edit_schedules'));
CREATE POLICY "Admins remove position permissions" ON public.job_title_permissions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.apply_job_title_permissions(_job_title text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Only admins can apply position permissions'; END IF;
  DELETE FROM user_permissions up USING profiles p
   WHERE up.user_id = p.id AND p.job_title = _job_title AND up.permission <> 'approve_supply_billing';
  INSERT INTO user_permissions (user_id, permission, granted_by)
  SELECT p.id, j.permission, auth.uid() FROM profiles p JOIN job_title_permissions j ON j.job_title = p.job_title
   WHERE p.job_title = _job_title AND j.permission <> 'approve_supply_billing'
     AND NOT (_job_title = 'Project Crew Lead' AND j.permission = 'edit_schedules')
  ON CONFLICT DO NOTHING;
  SELECT count(*) INTO n FROM profiles WHERE job_title = _job_title;
  RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.apply_job_title_permissions(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_job_title_permissions(text) TO authenticated, service_role;