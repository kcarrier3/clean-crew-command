ALTER TABLE public.supply_movements ADD COLUMN occurred_at timestamptz;
UPDATE public.supply_movements SET occurred_at = created_at WHERE occurred_at IS NULL;
ALTER TABLE public.supply_movements ALTER COLUMN occurred_at SET DEFAULT now(), ALTER COLUMN occurred_at SET NOT NULL;
CREATE INDEX IF NOT EXISTS supply_movements_occurred_at_idx ON public.supply_movements (occurred_at);

-- Keep stock correct when a movement is corrected after the fact.
CREATE OR REPLACE FUNCTION public.reapply_supply_movement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF OLD.billing_event_id IS NOT NULL AND (
       NEW.job_site_id IS DISTINCT FROM OLD.job_site_id
    OR NEW.quantity <> OLD.quantity
    OR NEW.item_id <> OLD.item_id
    OR NEW.unit_price IS DISTINCT FROM OLD.unit_price) THEN
    RAISE EXCEPTION 'This drop-off has already been sent to billing; only the date, reference and notes can be changed.';
  END IF;

  IF NEW.item_id = OLD.item_id AND NEW.quantity = OLD.quantity
     AND NEW.from_location_id IS NOT DISTINCT FROM OLD.from_location_id
     AND NEW.to_location_id IS NOT DISTINCT FROM OLD.to_location_id THEN
    RETURN NEW;
  END IF;

  -- Undo the old movement
  IF OLD.from_location_id IS NOT NULL THEN
    UPDATE public.supply_stock SET quantity = quantity + OLD.quantity, updated_at = now()
     WHERE item_id = OLD.item_id AND location_id = OLD.from_location_id;
  END IF;
  IF OLD.to_location_id IS NOT NULL THEN
    UPDATE public.supply_stock SET quantity = quantity - OLD.quantity, updated_at = now()
     WHERE item_id = OLD.item_id AND location_id = OLD.to_location_id;
  END IF;
  -- Apply the new one
  IF NEW.from_location_id IS NOT NULL THEN
    INSERT INTO public.supply_stock (item_id, location_id, quantity)
      VALUES (NEW.item_id, NEW.from_location_id, -NEW.quantity)
    ON CONFLICT (item_id, location_id)
    DO UPDATE SET quantity = public.supply_stock.quantity - NEW.quantity, updated_at = now();
  END IF;
  IF NEW.to_location_id IS NOT NULL THEN
    INSERT INTO public.supply_stock (item_id, location_id, quantity)
      VALUES (NEW.item_id, NEW.to_location_id, NEW.quantity)
    ON CONFLICT (item_id, location_id)
    DO UPDATE SET quantity = public.supply_stock.quantity + NEW.quantity, updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reapply_supply_movement() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_reapply_supply_movement BEFORE UPDATE ON public.supply_movements
  FOR EACH ROW EXECUTE FUNCTION public.reapply_supply_movement();

-- Correct the Oct 7 multifold drop-off that was logged without a customer.
UPDATE public.supply_movements SET job_site_id = 'eb51714c-7bfe-42b3-a672-62a8f483c182'
 WHERE id = '9188a4ba-7709-4bd0-87c7-a6d5be040345' AND job_site_id IS NULL;