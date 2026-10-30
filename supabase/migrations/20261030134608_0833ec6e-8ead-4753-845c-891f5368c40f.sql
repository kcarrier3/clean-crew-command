CREATE OR REPLACE FUNCTION public.can_estimate(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    -- Admin role is the only override for a Project Crew Lead.
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _user_id AND ur.role = 'admin')
    OR (
      NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _user_id AND p.job_title = 'Project Crew Lead')
      AND (
        EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _user_id AND ur.role = 'manager')
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = _user_id
            AND p.job_title IN ('Owner','Office Manager','Operations Manager','Janitorial Manager','Night Manager')
        )
      )
    )
$function$;