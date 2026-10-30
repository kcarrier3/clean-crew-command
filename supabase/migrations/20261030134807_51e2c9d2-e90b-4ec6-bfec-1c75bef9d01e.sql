CREATE OR REPLACE FUNCTION public.is_project_crew_lead(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND job_title = 'Project Crew Lead') $$;
REVOKE EXECUTE ON FUNCTION public.is_project_crew_lead(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_project_crew_lead(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_estimate(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT NOT public.is_project_crew_lead(_user_id) AND (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _user_id AND ur.role IN ('admin','manager'))
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _user_id
      AND p.job_title IN ('Owner','Office Manager','Operations Manager','Janitorial Manager','Night Manager'))
  )
$$;

CREATE OR REPLACE FUNCTION public.can_approve_estimate(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT NOT public.is_project_crew_lead(_user_id) AND (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _user_id AND ur.role = 'admin')
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _user_id AND p.job_title = 'Owner')
  )
$$;

-- Blanket deny for crew leads on every estimating table, overriding creator/owner fallbacks.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['estimates','estimate_revisions','estimate_line_adders','estimate_production_rates','estimate_settings','estimate_proposals'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "No estimating for project crew leads" ON public.%I', t);
    EXECUTE format('CREATE POLICY "No estimating for project crew leads" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (NOT public.is_project_crew_lead(auth.uid())) WITH CHECK (NOT public.is_project_crew_lead(auth.uid()))', t);
  END LOOP;
END $$;