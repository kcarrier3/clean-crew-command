REVOKE EXECUTE ON FUNCTION public.can_manage_training(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_manage_training(uuid) TO authenticated, service_role;