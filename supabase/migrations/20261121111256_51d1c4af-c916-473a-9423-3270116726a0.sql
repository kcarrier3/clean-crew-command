CREATE OR REPLACE FUNCTION public.get_chain_directory()
RETURNS TABLE(id uuid, first_name text, last_name text, email text, phone text, job_title text, employee_id text, active boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH RECURSIVE me AS (
    SELECT p.job_title FROM profiles p WHERE p.id = auth.uid()
  ),
  up AS (
    SELECT r.reports_to_title AS t, 1 AS d FROM job_title_reporting r, me WHERE r.job_title = me.job_title AND r.reports_to_title IS NOT NULL
    UNION
    SELECT r.reports_to_title, up.d + 1 FROM job_title_reporting r JOIN up ON r.job_title = up.t WHERE r.reports_to_title IS NOT NULL AND up.d < 20
  ),
  down AS (
    SELECT r.job_title AS t, 1 AS d FROM job_title_reporting r, me WHERE r.reports_to_title = me.job_title
    UNION
    SELECT r.job_title, down.d + 1 FROM job_title_reporting r JOIN down ON r.reports_to_title = down.t WHERE down.d < 20
  )
  SELECT p.id, p.first_name, p.last_name, NULL::text, p.phone, p.job_title, p.employee_id::text, p.active
  FROM profiles p
  WHERE p.active IS TRUE AND p.id <> auth.uid()
    AND p.job_title IS DISTINCT FROM 'Owner'
    AND (p.job_title IN (SELECT t FROM up) OR p.job_title IN (SELECT t FROM down));
$$;
REVOKE EXECUTE ON FUNCTION public.get_chain_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_chain_directory() TO authenticated, service_role;