REVOKE EXECUTE ON FUNCTION public.enforce_estimate_approval_rights() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.enforce_estimate_approval_rights() TO service_role;