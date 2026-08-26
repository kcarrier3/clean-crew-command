CREATE TABLE public.assistant_api_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  actor_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.assistant_api_clients TO service_role;
ALTER TABLE public.assistant_api_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages assistant clients"
  ON public.assistant_api_clients FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TABLE public.assistant_request_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.assistant_api_clients(id) ON DELETE SET NULL,
  actor_user_id uuid,
  source text NOT NULL DEFAULT 'chatgpt_assistant',
  action text NOT NULL,
  idempotency_key text,
  status text NOT NULL DEFAULT 'succeeded',
  request_payload jsonb,
  response_payload jsonb,
  created_record_ids jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX assistant_request_log_idem_uniq
  ON public.assistant_request_log (client_id, action, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

GRANT SELECT ON public.assistant_request_log TO authenticated;
GRANT ALL ON public.assistant_request_log TO service_role;
ALTER TABLE public.assistant_request_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view assistant request log"
  ON public.assistant_request_log FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.job_title IN ('Owner','Office Manager','Operations Manager'))
  );

CREATE POLICY "Service role manages assistant request log"
  ON public.assistant_request_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER assistant_api_clients_updated_at
  BEFORE UPDATE ON public.assistant_api_clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS source_metadata jsonb;