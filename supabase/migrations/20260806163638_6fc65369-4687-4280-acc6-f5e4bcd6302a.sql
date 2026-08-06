ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS service_type text NOT NULL DEFAULT 'janitorial';

ALTER TABLE public.estimate_revisions
  ADD COLUMN IF NOT EXISTS service_type text NOT NULL DEFAULT 'janitorial',
  ADD COLUMN IF NOT EXISTS specialty_inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS project_price numeric,
  ADD COLUMN IF NOT EXISTS project_labor_hours numeric,
  ADD COLUMN IF NOT EXISTS project_direct_cost numeric;

CREATE INDEX IF NOT EXISTS idx_estimates_service_type ON public.estimates (service_type);