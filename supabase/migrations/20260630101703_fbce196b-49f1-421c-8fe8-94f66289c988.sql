
ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS source_metadata jsonb;

CREATE TABLE IF NOT EXISTS public.crm_lead_submission_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash text NOT NULL,
  submission_count integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_lead_submission_log_ip_idx
  ON public.crm_lead_submission_log (ip_hash, window_start);

GRANT ALL ON public.crm_lead_submission_log TO service_role;

ALTER TABLE public.crm_lead_submission_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only"
  ON public.crm_lead_submission_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
