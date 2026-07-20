CREATE OR REPLACE FUNCTION public.is_supply_manager(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.has_role(_user_id, 'admin'::app_role)
      OR public.has_role(_user_id, 'manager'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = _user_id
          AND job_title IN ('Owner', 'Administrator', 'Office Manager', 'Operations Manager', 'Janitorial Manager', 'Project Crew Lead', 'Supply Management', 'Supply')
      );
$function$;