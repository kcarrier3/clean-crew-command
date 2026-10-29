-- Credit approval, supply price writes, and supply drop-offs to Ready to Bill.
-- Additive: no columns or rows are dropped. Existing unbilled drop-offs are not
-- backfilled; the office can still add those from Ready to Bill. New resale
-- drop-offs are queued by a trigger. Sales tax stays on the invoice trigger.

-- Misty Kelley (Office Manager) can issue and approve credits, including over
-- the self-approve limit. Same three titles as billing. Not the admin role.
CREATE OR REPLACE FUNCTION public.can_approve_credits(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _user_id
      AND p.job_title IN ('Owner', 'Office Manager', 'Operations Manager')
  );
$$;

CREATE OR REPLACE FUNCTION public.approve_customer_credit(_credit_id uuid)
RETURNS public.customer_credits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE c public.customer_credits;
BEGIN
  IF NOT can_approve_credits(auth.uid()) THEN
    RAISE EXCEPTION 'Only Owner, Office Manager, or Operations Manager can approve credits' USING ERRCODE = '42501';
  END IF;
  UPDATE customer_credits SET status = 'available', approved_by = auth.uid(), approved_at = now()
   WHERE id = _credit_id AND status = 'pending_approval' RETURNING * INTO c;
  IF NOT FOUND THEN RAISE EXCEPTION 'Credit not found or not pending approval'; END IF;
  IF c.auto_apply THEN PERFORM _credit_auto_apply_next(c.id); END IF;
  SELECT * INTO c FROM customer_credits WHERE id = _credit_id;
  RETURN c;
END $$;

-- Supply price-list writes. Separate from can_manage_billing and from the
-- generic manager role. Nikki Adkins is Supply Management, so she keeps this
-- without billing access. Inventory operations stay on is_supply_manager.
CREATE OR REPLACE FUNCTION public.can_manage_supply_pricing(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _user_id
      AND p.job_title IN (
        'Supply Management', 'Owner', 'Office Manager', 'Operations Manager'
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_manage_supply_pricing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_supply_pricing(uuid) TO authenticated, service_role;

-- Same people who can operate supplies today. The four pricing titles come
-- from can_manage_supply_pricing so Supply Management does not need the
-- manager role. can_manage_billing is not consulted.
CREATE OR REPLACE FUNCTION public.is_supply_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_manage_supply_pricing(_user_id)
      OR public.has_role(_user_id, 'admin'::app_role)
      OR public.has_role(_user_id, 'manager'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = _user_id
          AND job_title IN ('Administrator', 'Janitorial Manager', 'Project Crew Lead', 'Supply')
      );
$$;

CREATE OR REPLACE FUNCTION public.guard_supply_item_prices()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Inside this security-definer trigger current_user is the owner, so the
  -- JWT role claim is what distinguishes a signed-in API call from service_role
  -- or a direct SQL session. A signed-in user with no auth.uid() cannot set prices.
  IF auth.uid() IS NULL THEN
    IF coalesce(
      nullif(current_setting('request.jwt.claim.role', true), ''),
      CASE
        WHEN nullif(current_setting('request.jwt.claims', true), '') IS NULL THEN NULL
        ELSE nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
      END,
      ''
    ) IN ('authenticated', 'anon') THEN
      RAISE EXCEPTION 'Not authorized to set supply prices' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF (NEW.unit_cost IS NOT NULL OR NEW.sale_price IS NOT NULL OR COALESCE(NEW.markup_percent, 0) <> 0)
       AND NOT public.can_manage_supply_pricing(auth.uid()) THEN
      RAISE EXCEPTION 'Not authorized to set supply prices' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF (NEW.unit_cost IS DISTINCT FROM OLD.unit_cost
      OR NEW.sale_price IS DISTINCT FROM OLD.sale_price
      OR NEW.markup_percent IS DISTINCT FROM OLD.markup_percent)
     AND NOT public.can_manage_supply_pricing(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to change supply prices' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.guard_supply_item_prices() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_supply_item_prices ON public.supply_items;
CREATE TRIGGER trg_guard_supply_item_prices
  BEFORE INSERT OR UPDATE ON public.supply_items
  FOR EACH ROW EXECUTE FUNCTION public.guard_supply_item_prices();

DROP POLICY IF EXISTS "Supply managers view cost history" ON public.supply_item_cost_history;
DROP POLICY IF EXISTS "Supply pricing roles view cost history" ON public.supply_item_cost_history;
CREATE POLICY "Supply pricing roles view cost history"
  ON public.supply_item_cost_history
  FOR SELECT TO authenticated
  USING (public.can_manage_supply_pricing(auth.uid()));

DROP POLICY IF EXISTS "Supply managers insert cost history" ON public.supply_item_cost_history;
DROP POLICY IF EXISTS "Supply pricing roles insert cost history" ON public.supply_item_cost_history;
CREATE POLICY "Supply pricing roles insert cost history"
  ON public.supply_item_cost_history
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_supply_pricing(auth.uid()));

-- Resale sell at an account is the supply drop. Price comes from the movement
-- (recorded from the item's sale price) and is pre-tax. The invoice trigger
-- adds sales tax when the office bills it.
CREATE OR REPLACE FUNCTION public.supply_movement_bill_amount(m public.supply_movements)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN m.movement_type IS DISTINCT FROM 'sell' OR m.job_site_id IS NULL THEN 0
    WHEN NOT EXISTS (
      SELECT 1 FROM public.supply_items i
      WHERE i.id = m.item_id AND i.kind = 'resale'
    ) THEN 0
    ELSE round(COALESCE(
      m.total_value,
      m.unit_price * m.quantity,
      (SELECT i.sale_price * m.quantity FROM public.supply_items i WHERE i.id = m.item_id),
      0
    ), 2)
  END;
$$;

CREATE OR REPLACE FUNCTION public.supply_movement_bill_line(m public.supply_movements)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT format(
    '%s %s %s @ $%s = $%s',
    trim(to_char(m.quantity, 'FM999999990.99')),
    coalesce(i.unit, 'ea'),
    i.name,
    to_char(round(coalesce(m.unit_price, i.sale_price, 0), 2), 'FM999999990.00'),
    to_char(public.supply_movement_bill_amount(m), 'FM999999990.00')
  )
  || CASE
    WHEN m.notes IS NOT NULL AND btrim(m.notes) <> '' THEN E'\n' || m.notes
    ELSE ''
  END
  FROM public.supply_items i
  WHERE i.id = m.item_id;
$$;

REVOKE ALL ON FUNCTION public.supply_movement_bill_amount(public.supply_movements) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.supply_movement_bill_line(public.supply_movements) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.guard_invoiced_supply_drop()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.billing_event_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.billing_events e
    WHERE e.id = OLD.billing_event_id
      AND (e.invoice_id IS NOT NULL OR e.status = 'invoiced')
  ) THEN
    RAISE EXCEPTION 'This drop-off is already on an invoice and cannot be removed.';
  END IF;
  RETURN OLD;
END $$;

REVOKE ALL ON FUNCTION public.guard_invoiced_supply_drop() FROM PUBLIC, anon, authenticated;

-- Uninvoiced drop-offs can still be corrected. The Ready to Bill amount follows.
-- Once the event is on an invoice, quantity, item, price, and account stay locked.
CREATE OR REPLACE FUNCTION public.reapply_supply_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.billing_event_id IS NOT NULL AND (
       NEW.job_site_id IS DISTINCT FROM OLD.job_site_id
    OR NEW.quantity <> OLD.quantity
    OR NEW.item_id <> OLD.item_id
    OR NEW.unit_price IS DISTINCT FROM OLD.unit_price) THEN
    IF EXISTS (
      SELECT 1 FROM public.billing_events e
      WHERE e.id = OLD.billing_event_id
        AND (e.invoice_id IS NOT NULL OR e.status = 'invoiced')
    ) THEN
      RAISE EXCEPTION 'This drop-off is already on an invoice; only the date, reference and notes can be changed.';
    END IF;
  END IF;

  IF NEW.item_id = OLD.item_id AND NEW.quantity = OLD.quantity
     AND NEW.from_location_id IS NOT DISTINCT FROM OLD.from_location_id
     AND NEW.to_location_id IS NOT DISTINCT FROM OLD.to_location_id THEN
    RETURN NEW;
  END IF;

  IF OLD.from_location_id IS NOT NULL THEN
    UPDATE public.supply_stock SET quantity = quantity + OLD.quantity, updated_at = now()
     WHERE item_id = OLD.item_id AND location_id = OLD.from_location_id;
  END IF;
  IF OLD.to_location_id IS NOT NULL THEN
    UPDATE public.supply_stock SET quantity = quantity - OLD.quantity, updated_at = now()
     WHERE item_id = OLD.item_id AND location_id = OLD.to_location_id;
  END IF;
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
END $$;

REVOKE ALL ON FUNCTION public.reapply_supply_movement() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_supply_drop_billing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m public.supply_movements;
  v_event_id uuid;
  v_invoiced boolean;
  v_status text;
  v_amount numeric;
  v_count integer;
  v_desc text;
  v_earliest timestamptz;
  v_latest timestamptz;
  v_job_site_id uuid;
  v_new_status text;
  v_period text;
  v_label text;
  v_site record;
  v_new_id uuid;
BEGIN
  IF coalesce(current_setting('app.supply_billing_sync', true), '') = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  PERFORM set_config('app.supply_billing_sync', 'on', true);

  m := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  v_event_id := m.billing_event_id;

  IF v_event_id IS NOT NULL THEN
    SELECT (e.invoice_id IS NOT NULL OR e.status = 'invoiced'), e.status
      INTO v_invoiced, v_status
    FROM public.billing_events e
    WHERE e.id = v_event_id;
    IF NOT FOUND THEN
      v_event_id := NULL;
    ELSIF coalesce(v_invoiced, false) THEN
      PERFORM set_config('app.supply_billing_sync', '', true);
      IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END IF;
  END IF;

  IF v_event_id IS NULL THEN
    IF TG_OP <> 'DELETE' AND public.supply_movement_bill_amount(NEW) > 0 THEN
      SELECT s.name, s.crm_company_id, s.crm_lead_id, s.crm_deal_id, s.billing_email, s.billing_po_number
        INTO v_site
      FROM public.job_sites s
      WHERE s.id = NEW.job_site_id;
      IF NOT FOUND THEN
        PERFORM set_config('app.supply_billing_sync', '', true);
        RETURN NEW;
      END IF;

      v_period := to_char(NEW.occurred_at AT TIME ZONE 'America/New_York', 'YYYY-MM-DD');
      v_label := format('Supplies delivered — %s (%s)', coalesce(v_site.name, 'Account'), v_period);

      INSERT INTO public.billing_events (
        job_site_id, crm_company_id, crm_lead_id, crm_deal_id, source, label, description,
        amount, po_number, billing_email, notes, status, completed_at, ready_at, created_by
      ) VALUES (
        NEW.job_site_id, v_site.crm_company_id, v_site.crm_lead_id, v_site.crm_deal_id,
        'supply_usage', v_label, public.supply_movement_bill_line(NEW),
        public.supply_movement_bill_amount(NEW), v_site.billing_po_number, v_site.billing_email,
        NULL, 'ready', NEW.occurred_at, now(), NEW.created_by
      ) RETURNING id INTO v_new_id;

      UPDATE public.supply_movements
         SET billing_event_id = v_new_id
       WHERE id = NEW.id;
    END IF;

    PERFORM set_config('app.supply_billing_sync', '', true);
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  SELECT
    coalesce(sum(public.supply_movement_bill_amount(sm)), 0),
    count(*) FILTER (WHERE public.supply_movement_bill_amount(sm) > 0),
    string_agg(public.supply_movement_bill_line(sm), E'\n' ORDER BY sm.occurred_at, sm.id)
      FILTER (WHERE public.supply_movement_bill_amount(sm) > 0),
    min(sm.occurred_at) FILTER (WHERE public.supply_movement_bill_amount(sm) > 0),
    max(sm.occurred_at) FILTER (WHERE public.supply_movement_bill_amount(sm) > 0),
    (array_agg(sm.job_site_id ORDER BY sm.occurred_at DESC)
      FILTER (WHERE public.supply_movement_bill_amount(sm) > 0))[1]
    INTO v_amount, v_count, v_desc, v_earliest, v_latest, v_job_site_id
  FROM public.supply_movements sm
  WHERE sm.billing_event_id = v_event_id;

  IF coalesce(v_count, 0) = 0 OR coalesce(v_amount, 0) <= 0 THEN
    UPDATE public.billing_events
       SET status = 'cancelled',
           amount = 0,
           description = 'Supply drop-off was removed before it was invoiced.'
     WHERE id = v_event_id
       AND invoice_id IS NULL
       AND status IS DISTINCT FROM 'invoiced';
  ELSE
    SELECT s.name, s.crm_company_id, s.crm_lead_id, s.crm_deal_id, s.billing_email, s.billing_po_number
      INTO v_site
    FROM public.job_sites s
    WHERE s.id = v_job_site_id;
    IF NOT FOUND THEN
      UPDATE public.billing_events
         SET status = 'cancelled',
             amount = 0,
             description = 'Supply drop-off was removed before it was invoiced.'
       WHERE id = v_event_id
         AND invoice_id IS NULL
         AND status IS DISTINCT FROM 'invoiced';
      PERFORM set_config('app.supply_billing_sync', '', true);
      IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END IF;

    v_period := to_char(v_earliest AT TIME ZONE 'America/New_York', 'YYYY-MM-DD');
    IF (v_latest AT TIME ZONE 'America/New_York')::date
       IS DISTINCT FROM (v_earliest AT TIME ZONE 'America/New_York')::date THEN
      v_period := v_period || ' – ' || to_char(v_latest AT TIME ZONE 'America/New_York', 'YYYY-MM-DD');
    END IF;
    v_label := format('Supplies delivered — %s (%s)', coalesce(v_site.name, 'Account'), v_period);
    v_new_status := CASE
      WHEN v_status = 'hold' THEN 'hold'
      ELSE 'ready'
    END;

    UPDATE public.billing_events
       SET job_site_id = v_job_site_id,
           crm_company_id = v_site.crm_company_id,
           crm_lead_id = v_site.crm_lead_id,
           crm_deal_id = v_site.crm_deal_id,
           label = v_label,
           description = v_desc,
           amount = v_amount,
           po_number = v_site.billing_po_number,
           billing_email = v_site.billing_email,
           status = v_new_status,
           completed_at = v_latest,
           ready_at = CASE WHEN v_new_status = 'ready' AND status IS DISTINCT FROM 'ready' THEN now() ELSE ready_at END
     WHERE id = v_event_id
       AND invoice_id IS NULL
       AND status IS DISTINCT FROM 'invoiced';
  END IF;

  PERFORM set_config('app.supply_billing_sync', '', true);
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;

REVOKE ALL ON FUNCTION public.sync_supply_drop_billing() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_invoiced_supply_drop ON public.supply_movements;
CREATE TRIGGER trg_guard_invoiced_supply_drop
  BEFORE DELETE ON public.supply_movements
  FOR EACH ROW EXECUTE FUNCTION public.guard_invoiced_supply_drop();

DROP TRIGGER IF EXISTS trg_sync_supply_drop_billing ON public.supply_movements;
CREATE TRIGGER trg_sync_supply_drop_billing
  AFTER INSERT OR UPDATE OR DELETE ON public.supply_movements
  FOR EACH ROW EXECUTE FUNCTION public.sync_supply_drop_billing();

-- Undo (do not run as part of this migration):
--   DROP TRIGGER trg_sync_supply_drop_billing ON public.supply_movements;
--   DROP TRIGGER trg_guard_invoiced_supply_drop ON public.supply_movements;
--   DROP TRIGGER trg_guard_supply_item_prices ON public.supply_items;
--   Restore public.reapply_supply_movement so any quantity, item, price, or
--     account change is rejected once billing_event_id is set.
--   Restore supply_item_cost_history policies to is_supply_manager.
--   Restore is_supply_manager to: admin role OR manager role OR job title in
--     Owner, Administrator, Office Manager, Operations Manager, Janitorial
--     Manager, Project Crew Lead, Supply Management, Supply.
--   DROP FUNCTION public.can_manage_supply_pricing(uuid);
--   Restore approve_customer_credit's exception to the Owner-or-admin text,
--     and can_approve_credits to admin role OR job title Owner.
--   Events this trigger created can stay. Delete only rows with
--     source = 'supply_usage', invoice_id IS NULL, and no remaining
--     supply_movements.billing_event_id pointing at them. Do not delete
--     invoiced events.
