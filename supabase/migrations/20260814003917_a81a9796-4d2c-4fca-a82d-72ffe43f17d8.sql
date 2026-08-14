REVOKE EXECUTE ON FUNCTION public.is_punched_in_at(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_punched_in_at(uuid, uuid) TO authenticated, service_role;