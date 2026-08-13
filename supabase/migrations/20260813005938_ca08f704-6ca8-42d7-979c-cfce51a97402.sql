ALTER TABLE public.billing_check_intakes
  ADD COLUMN IF NOT EXISTS apply_mode text,
  ADD COLUMN IF NOT EXISTS auto_eligible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS confidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS blocked_reasons jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.billing_payments
  ADD COLUMN IF NOT EXISTS entry_source text NOT NULL DEFAULT 'manual';