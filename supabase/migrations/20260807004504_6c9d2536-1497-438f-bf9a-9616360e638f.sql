CREATE OR REPLACE FUNCTION public.can_approve_tm_tickets(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.has_role(_user_id,'admin'::app_role)
      OR public.has_role(_user_id,'manager'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = _user_id AND p.job_title IN ('Owner','Operations Manager','Office Manager','Project Crew Lead','Night Manager','Janitorial Manager')
      );
$function$;

REVOKE EXECUTE ON FUNCTION public.can_approve_tm_tickets(uuid) FROM anon;