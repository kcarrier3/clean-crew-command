REVOKE EXECUTE ON FUNCTION public.next_proposal_number() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_proposal_number() TO authenticated, service_role;