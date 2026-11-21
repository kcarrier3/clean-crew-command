DROP POLICY IF EXISTS "Signed-in users read chain" ON public.job_title_reporting;
CREATE POLICY "Managers read chain" ON public.job_title_reporting FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));