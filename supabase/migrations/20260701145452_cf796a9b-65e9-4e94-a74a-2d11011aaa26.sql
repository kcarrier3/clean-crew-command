
-- Helper: is user a manager/admin/owner
CREATE OR REPLACE FUNCTION public.is_supply_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::app_role)
      OR public.has_role(_user_id, 'manager'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = _user_id
          AND job_title IN ('Owner', 'Administrator', 'Janitorial Manager', 'Project Crew Lead')
      );
$$;
GRANT EXECUTE ON FUNCTION public.is_supply_manager(uuid) TO authenticated;

-- Categories
CREATE TABLE public.supply_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'resale' CHECK (kind IN ('resale','cleaning')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.supply_categories TO authenticated;
GRANT ALL ON public.supply_categories TO service_role;
ALTER TABLE public.supply_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read categories" ON public.supply_categories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "managers manage categories" ON public.supply_categories
  FOR ALL TO authenticated
  USING (public.is_supply_manager(auth.uid()))
  WITH CHECK (public.is_supply_manager(auth.uid()));

-- Items
CREATE TABLE public.supply_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text UNIQUE,
  name text NOT NULL,
  description text,
  category_id uuid REFERENCES public.supply_categories(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'resale' CHECK (kind IN ('resale','cleaning')),
  unit text NOT NULL DEFAULT 'ea',
  unit_cost numeric(12,2),
  sale_price numeric(12,2),
  reorder_point numeric(12,2) DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.supply_items TO authenticated;
GRANT ALL ON public.supply_items TO service_role;
ALTER TABLE public.supply_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read items" ON public.supply_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "managers manage items" ON public.supply_items
  FOR ALL TO authenticated
  USING (public.is_supply_manager(auth.uid()))
  WITH CHECK (public.is_supply_manager(auth.uid()));

-- Locations
CREATE TABLE public.supply_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('warehouse','truck','account')),
  job_site_id uuid REFERENCES public.job_sites(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.supply_locations TO authenticated;
GRANT ALL ON public.supply_locations TO service_role;
ALTER TABLE public.supply_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read locations" ON public.supply_locations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "managers manage locations" ON public.supply_locations
  FOR ALL TO authenticated
  USING (public.is_supply_manager(auth.uid()))
  WITH CHECK (public.is_supply_manager(auth.uid()));

INSERT INTO public.supply_locations (name, kind) VALUES ('Main Warehouse', 'warehouse');

-- Stock (denormalized quantity per item per location)
CREATE TABLE public.supply_stock (
  item_id uuid NOT NULL REFERENCES public.supply_items(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.supply_locations(id) ON DELETE CASCADE,
  quantity numeric(14,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (item_id, location_id)
);
GRANT SELECT ON public.supply_stock TO authenticated;
GRANT ALL ON public.supply_stock TO service_role;
ALTER TABLE public.supply_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read stock" ON public.supply_stock
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "managers manage stock" ON public.supply_stock
  FOR ALL TO authenticated
  USING (public.is_supply_manager(auth.uid()))
  WITH CHECK (public.is_supply_manager(auth.uid()));

-- Movements
CREATE TABLE public.supply_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.supply_items(id) ON DELETE RESTRICT,
  from_location_id uuid REFERENCES public.supply_locations(id) ON DELETE SET NULL,
  to_location_id uuid REFERENCES public.supply_locations(id) ON DELETE SET NULL,
  movement_type text NOT NULL CHECK (movement_type IN ('receive','transfer','sell','adjust')),
  quantity numeric(14,2) NOT NULL CHECK (quantity > 0),
  job_site_id uuid REFERENCES public.job_sites(id) ON DELETE SET NULL,
  unit_price numeric(12,2),
  total_value numeric(14,2),
  reference text,
  notes text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.supply_movements TO authenticated;
GRANT ALL ON public.supply_movements TO service_role;
ALTER TABLE public.supply_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read movements" ON public.supply_movements
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "managers insert movements" ON public.supply_movements
  FOR INSERT TO authenticated WITH CHECK (public.is_supply_manager(auth.uid()));
CREATE POLICY "managers update movements" ON public.supply_movements
  FOR UPDATE TO authenticated USING (public.is_supply_manager(auth.uid()));
CREATE POLICY "managers delete movements" ON public.supply_movements
  FOR DELETE TO authenticated USING (public.is_supply_manager(auth.uid()));

-- Trigger to update supply_stock from movements
CREATE OR REPLACE FUNCTION public.apply_supply_movement()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Deduct from source
  IF NEW.from_location_id IS NOT NULL THEN
    INSERT INTO public.supply_stock (item_id, location_id, quantity)
      VALUES (NEW.item_id, NEW.from_location_id, -NEW.quantity)
    ON CONFLICT (item_id, location_id)
    DO UPDATE SET quantity = public.supply_stock.quantity - NEW.quantity,
                  updated_at = now();
  END IF;
  -- Add to destination
  IF NEW.to_location_id IS NOT NULL THEN
    INSERT INTO public.supply_stock (item_id, location_id, quantity)
      VALUES (NEW.item_id, NEW.to_location_id, NEW.quantity)
    ON CONFLICT (item_id, location_id)
    DO UPDATE SET quantity = public.supply_stock.quantity + NEW.quantity,
                  updated_at = now();
  END IF;
  -- Adjust movement: if to_location is null and from_location is null, treat as absolute adjust noop
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_apply_supply_movement
  AFTER INSERT ON public.supply_movements
  FOR EACH ROW EXECUTE FUNCTION public.apply_supply_movement();

-- Requests (worker-facing)
CREATE TABLE public.supply_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.supply_items(id) ON DELETE SET NULL,
  item_name_free_text text,
  quantity numeric(14,2) NOT NULL DEFAULT 1,
  unit text,
  kind text NOT NULL DEFAULT 'cleaning' CHECK (kind IN ('resale','cleaning')),
  job_site_id uuid REFERENCES public.job_sites(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','fulfilled','cancelled')),
  notes text,
  fulfilled_at timestamptz,
  fulfilled_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.supply_requests TO authenticated;
GRANT ALL ON public.supply_requests TO service_role;
ALTER TABLE public.supply_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own or manager" ON public.supply_requests
  FOR SELECT TO authenticated
  USING (requested_by = auth.uid() OR public.is_supply_manager(auth.uid()));
CREATE POLICY "insert own request" ON public.supply_requests
  FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid());
CREATE POLICY "update own open or manager" ON public.supply_requests
  FOR UPDATE TO authenticated
  USING (
    (requested_by = auth.uid() AND status = 'open')
    OR public.is_supply_manager(auth.uid())
  )
  WITH CHECK (
    (requested_by = auth.uid() AND status IN ('open','cancelled'))
    OR public.is_supply_manager(auth.uid())
  );

-- updated_at triggers
CREATE TRIGGER trg_supply_categories_updated BEFORE UPDATE ON public.supply_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_supply_items_updated BEFORE UPDATE ON public.supply_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_supply_locations_updated BEFORE UPDATE ON public.supply_locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_supply_requests_updated BEFORE UPDATE ON public.supply_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
