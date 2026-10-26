CREATE TABLE public.billing_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text,
  unit text NOT NULL DEFAULT 'each',
  default_unit_price numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX billing_items_name_unique ON public.billing_items (lower(name));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_items TO authenticated;
GRANT ALL ON public.billing_items TO service_role;
ALTER TABLE public.billing_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Billing users manage billable items" ON public.billing_items
  FOR ALL TO authenticated
  USING (public.can_manage_billing(auth.uid()))
  WITH CHECK (public.can_manage_billing(auth.uid()));
CREATE TRIGGER update_billing_items_updated_at BEFORE UPDATE ON public.billing_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.billing_invoice_items
  ADD COLUMN billing_item_id uuid REFERENCES public.billing_items(id) ON DELETE SET NULL;
CREATE INDEX billing_invoice_items_item_idx ON public.billing_invoice_items (billing_item_id);