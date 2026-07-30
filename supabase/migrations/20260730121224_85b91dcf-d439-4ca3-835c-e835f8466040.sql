REVOKE ALL ON FUNCTION public.lock_completed_estimate() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lock_completed_estimate_revision() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lock_completed_estimate() TO service_role;
GRANT EXECUTE ON FUNCTION public.lock_completed_estimate_revision() TO service_role;