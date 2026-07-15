
-- 1) Prevent non-admins from changing their own job_title
CREATE OR REPLACE FUNCTION public.prevent_job_title_self_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.job_title IS DISTINCT FROM OLD.job_title
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only administrators can change job_title';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_job_title_self_escalation ON public.profiles;
CREATE TRIGGER prevent_job_title_self_escalation
BEFORE UPDATE OF job_title ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_job_title_self_escalation();

-- 2) Restrict broad reads on supply tables
-- Movements, stock, locations, categories: supply managers only
DROP POLICY IF EXISTS "authenticated read movements" ON public.supply_movements;
CREATE POLICY "supply managers read movements" ON public.supply_movements
  FOR SELECT USING (public.is_supply_manager(auth.uid()));

DROP POLICY IF EXISTS "authenticated read stock" ON public.supply_stock;
CREATE POLICY "supply managers read stock" ON public.supply_stock
  FOR SELECT USING (public.is_supply_manager(auth.uid()));

DROP POLICY IF EXISTS "authenticated read locations" ON public.supply_locations;
CREATE POLICY "supply managers read locations" ON public.supply_locations
  FOR SELECT USING (public.is_supply_manager(auth.uid()));

DROP POLICY IF EXISTS "authenticated read categories" ON public.supply_categories;
CREATE POLICY "supply managers read categories" ON public.supply_categories
  FOR SELECT USING (public.is_supply_manager(auth.uid()));

-- supply_items: keep broad row access (needed for request dropdowns) but hide cost columns
REVOKE SELECT (unit_cost, sale_price) ON public.supply_items FROM authenticated, anon;
GRANT SELECT (unit_cost, sale_price) ON public.supply_items TO service_role;

-- 3) Storage: strengthen work-order-photos UPDATE policy WITH CHECK
DROP POLICY IF EXISTS "Owners or managers update work order photos" ON storage.objects;
CREATE POLICY "Owners or managers update work order photos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'work-order-photos'
  AND (
    owner = auth.uid()
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
)
WITH CHECK (
  bucket_id = 'work-order-photos'
  AND (
    owner = auth.uid()
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);
