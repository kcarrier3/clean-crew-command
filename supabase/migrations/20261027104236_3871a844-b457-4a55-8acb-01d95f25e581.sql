CREATE TABLE public.account_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  provider_message_id text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.account_deletion_requests TO service_role;
ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;
-- No policies: only the server (service role) reads or writes deletion requests.
CREATE INDEX account_deletion_requests_user_idx ON public.account_deletion_requests (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.delete_account_for_user(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'User required';
  END IF;

  UPDATE public.profiles
  SET active = false, first_name = 'Deleted', last_name = 'User', phone = NULL, email = NULL
  WHERE id = _user_id;

  DELETE FROM public.user_permissions WHERE user_id = _user_id;
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  DELETE FROM public.user_custom_roles WHERE user_id = _user_id;

  DELETE FROM auth.users WHERE id = _user_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.delete_account_for_user(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_account_for_user(uuid) TO service_role;

-- Deleting must go through the password + email confirmation path.
REVOKE EXECUTE ON FUNCTION public.delete_own_account() FROM PUBLIC, anon, authenticated;