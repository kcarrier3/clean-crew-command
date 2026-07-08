
REVOKE EXECUTE ON FUNCTION public.get_job_site_public_name(uuid) FROM anon, PUBLIC;
DROP POLICY IF EXISTS "Public can submit porter reports" ON public.porter_reports;
REVOKE INSERT ON public.porter_reports FROM anon;
