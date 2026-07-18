
ALTER TABLE public.supply_items
  ADD COLUMN IF NOT EXISTS markup_percent NUMERIC NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.supply_item_cost_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.supply_items(id) ON DELETE CASCADE,
  previous_unit_cost NUMERIC,
  new_unit_cost NUMERIC,
  previous_markup_percent NUMERIC,
  new_markup_percent NUMERIC,
  previous_sale_price NUMERIC,
  new_sale_price NUMERIC,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.supply_item_cost_history TO authenticated;
GRANT ALL ON public.supply_item_cost_history TO service_role;

ALTER TABLE public.supply_item_cost_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Supply managers view cost history"
  ON public.supply_item_cost_history
  FOR SELECT TO authenticated
  USING (public.is_supply_manager(auth.uid()));

CREATE POLICY "Supply managers insert cost history"
  ON public.supply_item_cost_history
  FOR INSERT TO authenticated
  WITH CHECK (public.is_supply_manager(auth.uid()));

CREATE INDEX IF NOT EXISTS supply_item_cost_history_item_idx
  ON public.supply_item_cost_history(item_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_supply_item_cost_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.unit_cost IS NOT NULL OR NEW.markup_percent IS NOT NULL OR NEW.sale_price IS NOT NULL THEN
      INSERT INTO public.supply_item_cost_history (
        item_id, previous_unit_cost, new_unit_cost,
        previous_markup_percent, new_markup_percent,
        previous_sale_price, new_sale_price, changed_by, note
      ) VALUES (
        NEW.id, NULL, NEW.unit_cost,
        NULL, NEW.markup_percent,
        NULL, NEW.sale_price, auth.uid(), 'Item created'
      );
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.unit_cost IS DISTINCT FROM OLD.unit_cost
     OR NEW.markup_percent IS DISTINCT FROM OLD.markup_percent
     OR NEW.sale_price IS DISTINCT FROM OLD.sale_price THEN
    INSERT INTO public.supply_item_cost_history (
      item_id, previous_unit_cost, new_unit_cost,
      previous_markup_percent, new_markup_percent,
      previous_sale_price, new_sale_price, changed_by
    ) VALUES (
      NEW.id, OLD.unit_cost, NEW.unit_cost,
      OLD.markup_percent, NEW.markup_percent,
      OLD.sale_price, NEW.sale_price, auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS supply_items_log_cost_change ON public.supply_items;
CREATE TRIGGER supply_items_log_cost_change
  AFTER INSERT OR UPDATE ON public.supply_items
  FOR EACH ROW EXECUTE FUNCTION public.log_supply_item_cost_change();
