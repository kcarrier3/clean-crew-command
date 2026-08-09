ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS converted_job_site_id uuid REFERENCES public.job_sites(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS converted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_estimates_converted_job_site ON public.estimates(converted_job_site_id);