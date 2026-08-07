ALTER TABLE public.estimate_revisions
  ADD COLUMN IF NOT EXISTS minimum_visit_minutes numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS supervision_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS supervision_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS periodic_floor_care_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS periodic_floor_care_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS base_monthly_price numeric NOT NULL DEFAULT 0;