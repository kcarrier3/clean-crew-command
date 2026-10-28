-- Customer credits (referral / dissatisfaction / goodwill / other) with auto-apply to draft invoices
CREATE TABLE IF NOT EXISTS public.customer_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crm_company_id uuid REFERENCES public.crm_companies(id) ON DELETE SET NULL,
  job_site_id uuid REFERENCES public.job_sites(id) ON DELETE SET NULL,
  reason text NOT NULL CHECK (reason IN ('referral','dissatisfaction','goodwill','other')),
  referred_crm_company_id uuid REFERENCES public.crm_companies(id) ON DELETE SET NULL,
  referred_crm_lead_id uuid REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  related_invoice_id uuid REFERENCES public.billing_invoices(id) ON DELETE SET NULL,
  billing_item_id uuid REFERENCES public.billing_items(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  remaining_amount numeric(12,2) NOT NULL CHECK (remaining_amount >= 0),
  reduces_taxable_amount boolean NOT NULL DEFAULT true,
  auto_apply boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('pending_approval','available','fully_applied','voided')),
  notes text,
  expires_on date,
  issued_by uuid DEFAULT auth.uid(),
  issued_at timestamptz NOT NULL DEFAULT now(),
  approved_by uuid,
  approved_at timestamptz,
  voided_by uuid,
  voided_at timestamptz,
  void_reason text,
  qb_credit_memo_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_credits_remaining_le_amount CHECK (remaining_amount <= amount)
);
CREATE INDEX IF NOT EXISTS idx_customer_credits_company ON public.customer_credits (crm_company_id) WHERE status = 'available';
CREATE INDEX IF NOT EXISTS idx_customer_credits_site ON public.customer_credits (job_site_id) WHERE status = 'available';

CREATE TABLE IF NOT EXISTS public.customer_credit_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_id uuid NOT NULL REFERENCES public.customer_credits(id) ON DELETE RESTRICT,
  invoice_id uuid REFERENCES public.billing_invoices(id) ON DELETE SET NULL,
  invoice_item_id uuid REFERENCES public.billing_invoice_items(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  auto_applied boolean NOT NULL DEFAULT false,
  applied_by uuid DEFAULT auth.uid(),
  applied_at timestamptz NOT NULL DEFAULT now(),
  reversed_at timestamptz,
  reversed_by uuid,
  reversal_reason text
);
CREATE INDEX IF NOT EXISTS idx_credit_apps_credit ON public.customer_credit_applications (credit_id);
CREATE INDEX IF NOT EXISTS idx_credit_apps_invoice ON public.customer_credit_applications (invoice_id) WHERE reversed_at IS NULL;

ALTER TABLE public.billing_invoice_items
  ADD COLUMN IF NOT EXISTS credit_application_id uuid REFERENCES public.customer_credit_applications(id) ON DELETE SET NULL;

DROP TRIGGER IF EXISTS set_updated_at ON public.customer_credits;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.customer_credits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.customer_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_credit_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Billing managers can view credits" ON public.customer_credits;
CREATE POLICY "Billing managers can view credits" ON public.customer_credits FOR SELECT TO authenticated USING (public.can_manage_billing(auth.uid()));
DROP POLICY IF EXISTS "Billing managers can view credit applications" ON public.customer_credit_applications;
CREATE POLICY "Billing managers can view credit applications" ON public.customer_credit_applications FOR SELECT TO authenticated USING (public.can_manage_billing(auth.uid()));
-- No INSERT/UPDATE/DELETE policies: all writes go through the SECURITY DEFINER functions below.
REVOKE INSERT, UPDATE, DELETE ON public.customer_credits, public.customer_credit_applications FROM anon, authenticated;
GRANT SELECT ON public.customer_credits, public.customer_credit_applications TO authenticated;

INSERT INTO public.app_settings (key, value, description) VALUES
  ('credit_self_approve_limit', '250', 'Credits above this amount issued by non-Owner/non-admin billing users need Owner/admin approval'),
  ('credit_referral_reduces_tax', 'true', 'Default for whether referral credits reduce the taxable amount (matches current QuickBooks practice; confirm with CPA)')
ON CONFLICT (key) DO NOTHING;

-- helpers
CREATE OR REPLACE FUNCTION public.can_approve_credits(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin'::app_role)
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _user_id AND lower(coalesce(p.job_title,'')) = 'owner');
$$;

CREATE OR REPLACE FUNCTION public.credit_default_item_id(_reason text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.billing_items WHERE qb_item_id = CASE _reason WHEN 'referral' THEN '317' WHEN 'dissatisfaction' THEN '315' ELSE '143' END LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.credit_matches_invoice(_credit public.customer_credits, _inv public.billing_invoices)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (_credit.job_site_id IS NOT NULL AND _credit.job_site_id = _inv.job_site_id)
      OR (_credit.crm_company_id IS NOT NULL AND _credit.crm_company_id =
            coalesce(_inv.crm_company_id, (SELECT j.crm_company_id FROM public.job_sites j WHERE j.id = _inv.job_site_id)));
$$;

-- internal: write the credit line + application (no permission check; callers check)
CREATE OR REPLACE FUNCTION public._credit_apply_internal(_credit_id uuid, _invoice_id uuid, _amount numeric, _auto boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.customer_credits; v_app uuid; v_item uuid; v_prev text := coalesce(current_setting('billing.credit_writer', true), '');
  v_label text;
BEGIN
  SELECT * INTO c FROM customer_credits WHERE id = _credit_id FOR UPDATE;
  _amount := round(least(_amount, c.remaining_amount), 2);
  IF _amount <= 0 THEN RETURN NULL; END IF;
  v_label := CASE c.reason WHEN 'referral' THEN 'Referral credit' WHEN 'dissatisfaction' THEN 'Service credit' WHEN 'goodwill' THEN 'Goodwill credit' ELSE 'Credit' END
             || coalesce(' - ' || nullif(c.notes, ''), '');
  INSERT INTO customer_credit_applications (credit_id, invoice_id, amount, auto_applied) VALUES (c.id, _invoice_id, _amount, _auto) RETURNING id INTO v_app;
  PERFORM set_config('billing.credit_writer', 'on', true);
  INSERT INTO billing_invoice_items (invoice_id, description, quantity, unit_price, billing_item_id, taxable, line_type, credit_application_id, sort_order)
  VALUES (_invoice_id, left(v_label, 500), 1, -_amount, coalesce(c.billing_item_id, credit_default_item_id(c.reason)), c.reduces_taxable_amount, 'credit', v_app, 9000)
  RETURNING id INTO v_item;
  PERFORM set_config('billing.credit_writer', v_prev, true);
  UPDATE customer_credit_applications SET invoice_item_id = v_item WHERE id = v_app;
  UPDATE customer_credits SET remaining_amount = remaining_amount - _amount,
         status = CASE WHEN remaining_amount - _amount <= 0 THEN 'fully_applied' ELSE status END
   WHERE id = c.id;
  RETURN v_app;
END $$;

-- internal: undo an application (or part of it)
CREATE OR REPLACE FUNCTION public._credit_reverse_internal(_application_id uuid, _reason text, _partial numeric DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.customer_credit_applications; v_back numeric; v_prev text := coalesce(current_setting('billing.credit_writer', true), '');
BEGIN
  SELECT * INTO a FROM customer_credit_applications WHERE id = _application_id AND reversed_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  v_back := CASE WHEN _partial IS NULL OR _partial >= a.amount THEN a.amount ELSE round(_partial, 2) END;
  PERFORM set_config('billing.credit_writer', 'on', true);
  IF v_back >= a.amount THEN
    DELETE FROM billing_invoice_items WHERE id = a.invoice_item_id;
    UPDATE customer_credit_applications SET reversed_at = now(), reversed_by = auth.uid(), reversal_reason = _reason WHERE id = a.id;
  ELSE
    UPDATE billing_invoice_items SET unit_price = -(a.amount - v_back) WHERE id = a.invoice_item_id;
    UPDATE customer_credit_applications SET amount = a.amount - v_back WHERE id = a.id;
  END IF;
  PERFORM set_config('billing.credit_writer', v_prev, true);
  UPDATE customer_credits SET remaining_amount = remaining_amount + v_back,
         status = CASE WHEN status = 'voided' THEN status ELSE 'available' END
   WHERE id = a.credit_id;
END $$;

-- Keep credits consistent on a draft/ready invoice: trim over-applied credits, then auto-apply available ones (draft only)
CREATE OR REPLACE FUNCTION public.sync_invoice_credits(_invoice_id uuid)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv public.billing_invoices; v_charges numeric; v_credits numeric; v_head numeric; v_excess numeric; a record; c public.customer_credits; v_take numeric; v_applied numeric := 0;
BEGIN
  SELECT * INTO inv FROM billing_invoices WHERE id = _invoice_id;
  IF NOT FOUND OR inv.status NOT IN ('draft','ready') THEN RETURN 0; END IF;
  SELECT coalesce(sum(line_total) FILTER (WHERE line_type='charge'),0), coalesce(-sum(line_total) FILTER (WHERE line_type='credit'),0)
    INTO v_charges, v_credits FROM billing_invoice_items WHERE invoice_id = _invoice_id;
  v_excess := v_credits - greatest(v_charges, 0);
  IF v_excess > 0 THEN
    FOR a IN SELECT * FROM customer_credit_applications WHERE invoice_id = _invoice_id AND reversed_at IS NULL ORDER BY applied_at DESC LOOP
      EXIT WHEN v_excess <= 0;
      PERFORM _credit_reverse_internal(a.id, 'Trimmed: invoice charges decreased', least(a.amount, v_excess));
      v_excess := v_excess - least(a.amount, v_excess);
    END LOOP;
    RETURN 0;
  END IF;
  IF inv.status <> 'draft' THEN RETURN 0; END IF;
  v_head := greatest(v_charges, 0) - v_credits;
  FOR c IN SELECT * FROM customer_credits cc
            WHERE cc.status = 'available' AND cc.auto_apply AND cc.remaining_amount > 0
              AND (cc.expires_on IS NULL OR cc.expires_on >= coalesce(inv.invoice_date, current_date))
              AND credit_matches_invoice(cc, inv)
            ORDER BY cc.issued_at, cc.id LOOP
    EXIT WHEN v_head <= 0;
    v_take := least(c.remaining_amount, v_head);
    IF _credit_apply_internal(c.id, _invoice_id, v_take, true) IS NOT NULL THEN
      v_head := v_head - v_take; v_applied := v_applied + v_take;
    END IF;
  END LOOP;
  RETURN v_applied;
END $$;

-- Apply a credit to the customer's next (oldest) draft invoice that has room
CREATE OR REPLACE FUNCTION public._credit_auto_apply_next(_credit_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.customer_credits; inv public.billing_invoices;
BEGIN
  SELECT * INTO c FROM customer_credits WHERE id = _credit_id;
  IF c.status <> 'available' OR NOT c.auto_apply THEN RETURN; END IF;
  FOR inv IN SELECT * FROM billing_invoices i WHERE i.status = 'draft' ORDER BY i.invoice_date NULLS LAST, i.created_at LOOP
    IF credit_matches_invoice(c, inv) THEN
      PERFORM sync_invoice_credits(inv.id);
      SELECT * INTO c FROM customer_credits WHERE id = _credit_id;
      EXIT WHEN c.status <> 'available';
    END IF;
  END LOOP;
END $$;

-- ===== Public RPCs =====
CREATE OR REPLACE FUNCTION public.issue_customer_credit(
  _amount numeric, _reason text, _crm_company_id uuid DEFAULT NULL, _job_site_id uuid DEFAULT NULL,
  _notes text DEFAULT NULL, _reduces_taxable_amount boolean DEFAULT NULL, _auto_apply boolean DEFAULT true,
  _related_invoice_id uuid DEFAULT NULL, _referred_crm_company_id uuid DEFAULT NULL, _referred_crm_lead_id uuid DEFAULT NULL,
  _expires_on date DEFAULT NULL, _billing_item_id uuid DEFAULT NULL)
RETURNS public.customer_credits LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_limit numeric; v_reduces boolean; v_status text; c public.customer_credits;
BEGIN
  IF NOT can_manage_billing(v_uid) THEN RAISE EXCEPTION 'Not authorized to manage billing' USING ERRCODE = '42501'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Credit amount must be greater than 0'; END IF;
  IF _crm_company_id IS NULL AND _job_site_id IS NULL THEN RAISE EXCEPTION 'Choose a customer or a job site for the credit'; END IF;
  IF _reason NOT IN ('referral','dissatisfaction','goodwill','other') THEN RAISE EXCEPTION 'Invalid credit reason %', _reason; END IF;
  SELECT nullif(value,'')::numeric INTO v_limit FROM app_settings WHERE key = 'credit_self_approve_limit';
  v_limit := coalesce(v_limit, 250);
  v_reduces := coalesce(_reduces_taxable_amount,
                 CASE WHEN _reason = 'referral' THEN coalesce((SELECT lower(value) = 'true' FROM app_settings WHERE key = 'credit_referral_reduces_tax'), true) ELSE true END);
  v_status := CASE WHEN can_approve_credits(v_uid) OR round(_amount,2) <= v_limit THEN 'available' ELSE 'pending_approval' END;
  INSERT INTO customer_credits (crm_company_id, job_site_id, reason, referred_crm_company_id, referred_crm_lead_id, related_invoice_id,
      billing_item_id, amount, remaining_amount, reduces_taxable_amount, auto_apply, status, notes, expires_on, issued_by, approved_by, approved_at)
  VALUES (_crm_company_id, _job_site_id, _reason, _referred_crm_company_id, _referred_crm_lead_id, _related_invoice_id,
      coalesce(_billing_item_id, credit_default_item_id(_reason)), round(_amount,2), round(_amount,2), v_reduces, coalesce(_auto_apply, true), v_status, _notes, _expires_on, v_uid,
      CASE WHEN v_status = 'available' THEN v_uid END, CASE WHEN v_status = 'available' THEN now() END)
  RETURNING * INTO c;
  IF c.status = 'available' AND c.auto_apply THEN PERFORM _credit_auto_apply_next(c.id); END IF;
  SELECT * INTO c FROM customer_credits WHERE id = c.id;
  RETURN c;
END $$;

CREATE OR REPLACE FUNCTION public.approve_customer_credit(_credit_id uuid)
RETURNS public.customer_credits LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.customer_credits;
BEGIN
  IF NOT can_approve_credits(auth.uid()) THEN RAISE EXCEPTION 'Only the Owner or an admin can approve credits' USING ERRCODE = '42501'; END IF;
  UPDATE customer_credits SET status = 'available', approved_by = auth.uid(), approved_at = now()
   WHERE id = _credit_id AND status = 'pending_approval' RETURNING * INTO c;
  IF NOT FOUND THEN RAISE EXCEPTION 'Credit not found or not pending approval'; END IF;
  IF c.auto_apply THEN PERFORM _credit_auto_apply_next(c.id); END IF;
  SELECT * INTO c FROM customer_credits WHERE id = _credit_id;
  RETURN c;
END $$;

CREATE OR REPLACE FUNCTION public.void_customer_credit(_credit_id uuid, _reason text DEFAULT NULL)
RETURNS public.customer_credits LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.customer_credits; a record; v_locked text;
BEGIN
  IF NOT can_manage_billing(auth.uid()) THEN RAISE EXCEPTION 'Not authorized to manage billing' USING ERRCODE = '42501'; END IF;
  SELECT * INTO c FROM customer_credits WHERE id = _credit_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Credit not found'; END IF;
  IF c.status = 'voided' THEN RETURN c; END IF;
  SELECT string_agg(i.invoice_number, ', ') INTO v_locked
    FROM customer_credit_applications ap JOIN billing_invoices i ON i.id = ap.invoice_id
   WHERE ap.credit_id = c.id AND ap.reversed_at IS NULL AND i.status NOT IN ('draft','ready','void');
  IF v_locked IS NOT NULL THEN
    RAISE EXCEPTION 'Credit is already used on sent invoice(s) %; void those invoices first', v_locked;
  END IF;
  FOR a IN SELECT ap.id FROM customer_credit_applications ap LEFT JOIN billing_invoices i ON i.id = ap.invoice_id
            WHERE ap.credit_id = c.id AND ap.reversed_at IS NULL AND (i.status IN ('draft','ready') OR i.id IS NULL) LOOP
    PERFORM _credit_reverse_internal(a.id, coalesce('Credit voided: ' || _reason, 'Credit voided'));
  END LOOP;
  UPDATE customer_credits SET status = 'voided', remaining_amount = 0, voided_by = auth.uid(), voided_at = now(), void_reason = _reason
   WHERE id = c.id RETURNING * INTO c;
  RETURN c;
END $$;

CREATE OR REPLACE FUNCTION public.apply_customer_credit(_credit_id uuid, _invoice_id uuid, _amount numeric DEFAULT NULL)
RETURNS public.customer_credit_applications LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.customer_credits; inv public.billing_invoices; v_charges numeric; v_credits numeric; v_amt numeric; v_app uuid; r public.customer_credit_applications;
BEGIN
  IF NOT can_manage_billing(auth.uid()) THEN RAISE EXCEPTION 'Not authorized to manage billing' USING ERRCODE = '42501'; END IF;
  SELECT * INTO c FROM customer_credits WHERE id = _credit_id;
  IF NOT FOUND OR c.status <> 'available' THEN RAISE EXCEPTION 'Credit is not available (status %)', coalesce(c.status, 'missing'); END IF;
  SELECT * INTO inv FROM billing_invoices WHERE id = _invoice_id;
  IF NOT FOUND OR inv.status NOT IN ('draft','ready') THEN RAISE EXCEPTION 'Credits can only be applied to draft or ready invoices'; END IF;
  IF NOT credit_matches_invoice(c, inv) THEN RAISE EXCEPTION 'Credit belongs to a different customer/job site than this invoice'; END IF;
  SELECT coalesce(sum(line_total) FILTER (WHERE line_type='charge'),0), coalesce(-sum(line_total) FILTER (WHERE line_type='credit'),0)
    INTO v_charges, v_credits FROM billing_invoice_items WHERE invoice_id = _invoice_id;
  v_amt := least(coalesce(_amount, c.remaining_amount), c.remaining_amount, greatest(v_charges,0) - v_credits);
  IF v_amt IS NULL OR v_amt <= 0 THEN RAISE EXCEPTION 'Nothing to apply: invoice has no remaining charges or credit has no balance'; END IF;
  v_app := _credit_apply_internal(c.id, _invoice_id, v_amt, false);
  SELECT * INTO r FROM customer_credit_applications WHERE id = v_app;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.reverse_credit_application(_application_id uuid, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status text;
BEGIN
  IF NOT can_manage_billing(auth.uid()) THEN RAISE EXCEPTION 'Not authorized to manage billing' USING ERRCODE = '42501'; END IF;
  SELECT i.status INTO v_status FROM customer_credit_applications a LEFT JOIN billing_invoices i ON i.id = a.invoice_id WHERE a.id = _application_id;
  IF v_status IS NOT NULL AND v_status NOT IN ('draft','ready') THEN RAISE EXCEPTION 'Invoice is %, credit lines can no longer change. Void the invoice instead.', v_status; END IF;
  PERFORM _credit_reverse_internal(_application_id, coalesce(_reason, 'Removed by user'));
END $$;

CREATE OR REPLACE FUNCTION public.auto_apply_customer_credits(_invoice_id uuid)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT can_manage_billing(auth.uid()) THEN RAISE EXCEPTION 'Not authorized to manage billing' USING ERRCODE = '42501'; END IF;
  RETURN sync_invoice_credits(_invoice_id);
END $$;

-- Item AFTER trigger now also keeps credits in sync when charge lines change
CREATE OR REPLACE FUNCTION public.billing_invoice_item_after()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inv uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.invoice_id ELSE NEW.invoice_id END;
  v_type text := CASE WHEN TG_OP = 'DELETE' THEN OLD.line_type ELSE NEW.line_type END;
BEGIN
  IF v_type = 'charge' AND coalesce(current_setting('billing.credit_writer', true), '') <> 'on' THEN
    PERFORM sync_invoice_credits(v_inv);
  END IF;
  PERFORM recalc_invoice_totals(v_inv);
  IF TG_OP = 'UPDATE' AND OLD.invoice_id IS DISTINCT FROM NEW.invoice_id THEN PERFORM recalc_invoice_totals(OLD.invoice_id); END IF;
  RETURN NULL;
END $$;

-- When an invoice is voided, or a draft is deleted, give the credit back
CREATE OR REPLACE FUNCTION public.billing_invoice_release_credits()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a record; v_id uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
BEGIN
  IF TG_OP = 'UPDATE' AND NOT (NEW.status = 'void' AND OLD.status IS DISTINCT FROM 'void') THEN RETURN NEW; END IF;
  FOR a IN SELECT * FROM customer_credit_applications WHERE invoice_id = v_id AND reversed_at IS NULL LOOP
    UPDATE customer_credit_applications SET reversed_at = now(), reversed_by = auth.uid(),
           reversal_reason = CASE WHEN TG_OP = 'DELETE' THEN 'Draft invoice deleted' ELSE 'Invoice voided' END
     WHERE id = a.id;
    UPDATE customer_credits SET remaining_amount = least(amount, remaining_amount + a.amount),
           status = CASE WHEN status = 'voided' THEN status ELSE 'available' END
     WHERE id = a.credit_id;
  END LOOP;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_billing_invoice_release_credits_upd ON public.billing_invoices;
CREATE TRIGGER trg_billing_invoice_release_credits_upd AFTER UPDATE OF status ON public.billing_invoices
  FOR EACH ROW EXECUTE FUNCTION public.billing_invoice_release_credits();
DROP TRIGGER IF EXISTS trg_billing_invoice_release_credits_del ON public.billing_invoices;
CREATE TRIGGER trg_billing_invoice_release_credits_del BEFORE DELETE ON public.billing_invoices
  FOR EACH ROW EXECUTE FUNCTION public.billing_invoice_release_credits();

-- permissions
REVOKE ALL ON FUNCTION public._credit_apply_internal(uuid, uuid, numeric, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._credit_reverse_internal(uuid, text, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._credit_auto_apply_next(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_invoice_credits(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.billing_invoice_release_credits() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.billing_invoice_item_after() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.credit_matches_invoice(public.customer_credits, public.billing_invoices) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.credit_default_item_id(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_approve_credits(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_approve_credits(uuid), public.credit_default_item_id(text) TO authenticated;
REVOKE ALL ON FUNCTION public.issue_customer_credit(numeric, text, uuid, uuid, text, boolean, boolean, uuid, uuid, uuid, date, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_customer_credit(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.void_customer_credit(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.apply_customer_credit(uuid, uuid, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reverse_credit_application(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.auto_apply_customer_credits(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_customer_credit(numeric, text, uuid, uuid, text, boolean, boolean, uuid, uuid, uuid, date, uuid),
  public.approve_customer_credit(uuid), public.void_customer_credit(uuid, text), public.apply_customer_credit(uuid, uuid, numeric),
  public.reverse_credit_application(uuid, text), public.auto_apply_customer_credits(uuid) TO authenticated;
