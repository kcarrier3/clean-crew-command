CREATE OR REPLACE FUNCTION public.can_message_user(_sender_id uuid, _recipient_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    -- Managers and supply staff can message anyone
    WHEN public.has_role(_sender_id, 'admin'::app_role)
      OR public.has_role(_sender_id, 'manager'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = _sender_id
          AND job_title IN (
            'Owner','Office Manager','Operations Manager','Janitorial Manager',
            'Night Manager','Project Crew Lead','Supply Management','Supply'
          )
      ) THEN true

    -- Floaters can message managers or other Floaters
    WHEN EXISTS (
      SELECT 1 FROM public.profiles WHERE id = _sender_id AND job_title = 'Floaters'
    ) THEN EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = _recipient_id
        AND job_title IN (
          'Owner','Office Manager','Operations Manager','Janitorial Manager',
          'Night Manager','Project Crew Lead','Floaters'
        )
    )

    -- Everyone else can only message managers
    ELSE EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = _recipient_id
        AND job_title IN (
          'Owner','Office Manager','Operations Manager','Janitorial Manager',
          'Night Manager','Project Crew Lead'
        )
    )
  END
$function$;

REVOKE EXECUTE ON FUNCTION public.can_message_user(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_message_user(uuid, uuid) TO authenticated;