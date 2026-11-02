ALTER TABLE public.billing_events
  ADD COLUMN IF NOT EXISTS billed_externally boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS external_reference text,
  ADD COLUMN IF NOT EXISTS external_billed_by uuid;

COMMENT ON COLUMN public.billing_events.billed_externally IS 'Temporary: item was billed outside Crew Compass (QuickBooks) and marked billed by hand.';