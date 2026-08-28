ALTER TABLE public.supply_movements
  ADD COLUMN IF NOT EXISTS billing_event_id uuid REFERENCES public.billing_events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS supply_movements_billing_event_idx
  ON public.supply_movements (billing_event_id);

ALTER TABLE public.billing_invoices
  ADD COLUMN IF NOT EXISTS online_payment_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_link_url text,
  ADD COLUMN IF NOT EXISTS payment_processor text,
  ADD COLUMN IF NOT EXISTS processor_invoice_id text,
  ADD COLUMN IF NOT EXISTS processor_status text,
  ADD COLUMN IF NOT EXISTS online_paid_at timestamptz;