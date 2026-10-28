-- Server-side tax + totals for billing invoices
CREATE OR REPLACE FUNCTION public.billing_resolve_tax(_job_site_id uuid, _crm_company_id uuid, _on date)
RETURNS TABLE(tax_rate_id uuid, rate numeric, jurisdiction text, exempt boolean, exempt_reason text, needs_review boolean, review_reason text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_county text; v_state text; v_review boolean; v_site_exempt boolean; v_site_reason text; v_override uuid; v_site_company uuid;
  v_cid uuid; v_co_exempt boolean := false; v_co_reason text; v_co_expires date;
  v_rate_id uuid; v_rate numeric; v_label text;
BEGIN
  IF _job_site_id IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, 0::numeric, NULL::text, false, NULL::text, true, 'Invoice has no job site, so the tax county is unknown'; RETURN;
  END IF;
  SELECT j.county, upper(trim(j.state)), j.county_needs_review, j.tax_exempt, j.tax_exemption_reason, j.tax_rate_id, j.crm_company_id
    INTO v_county, v_state, v_review, v_site_exempt, v_site_reason, v_override, v_site_company
  FROM job_sites j WHERE j.id = _job_site_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, 0::numeric, NULL::text, false, NULL::text, true, 'Job site not found'; RETURN;
  END IF;

  v_cid := coalesce(_crm_company_id, v_site_company);
  IF v_cid IS NOT NULL THEN
    SELECT c.tax_exempt, c.tax_exemption_reason, c.tax_exempt_certificate_expires INTO v_co_exempt, v_co_reason, v_co_expires
    FROM crm_companies c WHERE c.id = v_cid;
    v_co_exempt := coalesce(v_co_exempt, false);
  END IF;

  IF v_site_exempt THEN
    RETURN QUERY SELECT NULL::uuid, 0::numeric, v_county, true, coalesce(v_site_reason, 'Job site is tax exempt'), false, NULL::text; RETURN;
  END IF;
  IF v_co_exempt THEN
    IF v_co_expires IS NOT NULL AND v_co_expires < _on THEN
      RETURN QUERY SELECT NULL::uuid, 0::numeric, v_county, true, v_co_reason, true, 'Customer tax-exemption certificate expired on ' || v_co_expires; RETURN;
    END IF;
    RETURN QUERY SELECT NULL::uuid, 0::numeric, v_county, true, coalesce(v_co_reason, 'Customer is tax exempt'), false, NULL::text; RETURN;
  END IF;

  IF v_override IS NOT NULL THEN
    SELECT t.id, t.rate, coalesce(t.label, t.county) INTO v_rate_id, v_rate, v_label FROM tax_rates t WHERE t.id = v_override AND t.active;
    IF FOUND THEN
      RETURN QUERY SELECT v_rate_id, v_rate, v_label, false, NULL::text, coalesce(v_review,false),
        CASE WHEN v_review THEN 'Job site county is unconfirmed' END; RETURN;
    END IF;
  END IF;

  IF v_state IS NOT NULL AND v_state <> 'OH' THEN
    RETURN QUERY SELECT NULL::uuid, 0::numeric, NULL::text, false, NULL::text, true, 'Job site is outside Ohio (' || v_state || '); no rate table'; RETURN;
  END IF;
  IF v_county IS NULL OR trim(v_county) = '' THEN
    RETURN QUERY SELECT NULL::uuid, 0::numeric, NULL::text, false, NULL::text, true, 'Job site has no county; set it to calculate sales tax'; RETURN;
  END IF;

  SELECT t.id, t.rate INTO v_rate_id, v_rate
  FROM tax_rates t
  WHERE t.active AND t.state = 'OH' AND lower(t.county) = lower(trim(v_county))
    AND t.city IS NULL AND t.zip IS NULL AND t.transit_area IS NULL
    AND t.effective_from <= _on AND (t.effective_to IS NULL OR t.effective_to >= _on)
  ORDER BY t.effective_from DESC LIMIT 1;
  IF v_rate_id IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, 0::numeric, v_county, false, NULL::text, true, 'No active tax rate for ' || v_county || ' County on ' || _on; RETURN;
  END IF;
  RETURN QUERY SELECT v_rate_id, v_rate, v_county || ' County, OH', false, NULL::text, coalesce(v_review,false),
    CASE WHEN v_review THEN 'Job site county is unconfirmed - verify with tax.ohio.gov The Finder' END;
END $$;
REVOKE ALL ON FUNCTION public.billing_resolve_tax(uuid, uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.billing_resolve_tax(uuid, uuid, date) TO authenticated, service_role;

-- BEFORE INSERT/UPDATE on billing_invoices: recompute totals for draft/ready invoices (overrides client-sent values)
CREATE OR REPLACE FUNCTION public.billing_invoice_compute_totals()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_charges numeric; v_credits numeric; v_taxable numeric; r record;
BEGIN
  IF NEW.status NOT IN ('draft','ready') THEN RETURN NEW; END IF;
  SELECT coalesce(sum(i.line_total) FILTER (WHERE i.line_type = 'charge'), 0),
         coalesce(-sum(i.line_total) FILTER (WHERE i.line_type = 'credit'), 0),
         greatest(coalesce(sum(i.line_total) FILTER (WHERE coalesce(i.taxable, true)), 0), 0)
    INTO v_charges, v_credits, v_taxable
  FROM billing_invoice_items i WHERE i.invoice_id = NEW.id;
  SELECT * INTO r FROM billing_resolve_tax(NEW.job_site_id, NEW.crm_company_id, coalesce(NEW.invoice_date, current_date));
  NEW.subtotal        := v_charges;
  NEW.credits_applied := v_credits;
  NEW.taxable_amount  := v_taxable;
  NEW.tax_rate        := coalesce(r.rate, 0);
  NEW.tax_rate_id     := r.tax_rate_id;
  NEW.tax_jurisdiction:= coalesce(r.jurisdiction, NEW.tax_jurisdiction);
  NEW.tax_exempt      := coalesce(r.exempt, false);
  NEW.tax_exemption_reason := r.exempt_reason;
  NEW.tax             := round(v_taxable * coalesce(r.rate, 0) / 100.0, 2);
  NEW.total           := greatest(v_charges - v_credits, 0) + NEW.tax;
  NEW.balance_due     := greatest(NEW.total - coalesce(NEW.amount_paid, 0), 0);
  NEW.tax_status      := CASE WHEN r.needs_review THEN 'needs_review' ELSE 'ok' END;
  NEW.tax_review_reason := r.review_reason;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_billing_invoice_compute_totals ON public.billing_invoices;
CREATE TRIGGER trg_billing_invoice_compute_totals
  BEFORE INSERT OR UPDATE ON public.billing_invoices
  FOR EACH ROW EXECUTE FUNCTION public.billing_invoice_compute_totals();

-- BEFORE row trigger on billing_invoice_items: lock + line_total + taxable default
CREATE OR REPLACE FUNCTION public.billing_invoice_item_before()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status text; v_item_taxable boolean; v_credit_ok boolean := coalesce(current_setting('billing.credit_writer', true), '') = 'on';
BEGIN
  SELECT status INTO v_status FROM billing_invoices WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.invoice_id ELSE NEW.invoice_id END;
  IF v_status IS NOT NULL AND v_status NOT IN ('draft','ready')
     AND coalesce(current_setting('billing.allow_locked_edit', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Invoice is %, so its lines can no longer change. Void it and issue a new invoice instead.', v_status
      USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.line_type = 'credit' AND NOT v_credit_ok AND v_status IS NOT NULL THEN
      RAISE EXCEPTION 'Credit lines are managed by credit functions; use reverse_credit_application()' USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.line_type = 'credit' AND NOT v_credit_ok THEN
    RAISE EXCEPTION 'Credit lines can only be added with apply_customer_credit()' USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.line_type = 'credit' AND NOT v_credit_ok THEN
    RAISE EXCEPTION 'Credit lines can only be changed with the credit functions' USING ERRCODE = 'check_violation';
  END IF;
  NEW.line_total := round(coalesce(NEW.quantity, 0) * coalesce(NEW.unit_price, 0), 2);
  IF NEW.taxable IS NULL THEN
    IF NEW.billing_item_id IS NOT NULL THEN
      SELECT b.taxable INTO v_item_taxable FROM billing_items b WHERE b.id = NEW.billing_item_id;
    END IF;
    NEW.taxable := coalesce(v_item_taxable, true);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_billing_invoice_item_before ON public.billing_invoice_items;
CREATE TRIGGER trg_billing_invoice_item_before
  BEFORE INSERT OR UPDATE OR DELETE ON public.billing_invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.billing_invoice_item_before();

-- Recalculate one invoice (callable by billing users, and by triggers)
CREATE OR REPLACE FUNCTION public.recalc_invoice_totals(_invoice_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status text;
BEGIN
  SELECT status INTO v_status FROM billing_invoices WHERE id = _invoice_id;
  IF NOT FOUND OR v_status NOT IN ('draft','ready') THEN RETURN; END IF;
  UPDATE billing_invoices SET updated_at = now() WHERE id = _invoice_id;  -- fires billing_invoice_compute_totals
  PERFORM recalc_invoice_balance(_invoice_id);
END $$;
REVOKE ALL ON FUNCTION public.recalc_invoice_totals(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recalc_invoice_totals(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.billing_invoice_item_after()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inv uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.invoice_id ELSE NEW.invoice_id END;
BEGIN
  PERFORM recalc_invoice_totals(v_inv);
  IF TG_OP = 'UPDATE' AND OLD.invoice_id IS DISTINCT FROM NEW.invoice_id THEN PERFORM recalc_invoice_totals(OLD.invoice_id); END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_billing_invoice_item_after ON public.billing_invoice_items;
CREATE TRIGGER trg_billing_invoice_item_after
  AFTER INSERT OR UPDATE OR DELETE ON public.billing_invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.billing_invoice_item_after();

-- Block sending an invoice whose tax needs review
CREATE OR REPLACE FUNCTION public.billing_block_send_needs_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ts text; v_reason text;
BEGIN
  IF TG_TABLE_NAME = 'billing_email_messages' THEN
    IF NEW.invoice_id IS NULL OR coalesce(NEW.message_kind, 'invoice') <> 'invoice' THEN RETURN NEW; END IF;
    SELECT tax_status, tax_review_reason INTO v_ts, v_reason FROM billing_invoices WHERE id = NEW.invoice_id;
  ELSE
    IF NOT (NEW.status = 'sent' AND OLD.status IN ('draft','ready')) THEN RETURN NEW; END IF;
    v_ts := OLD.tax_status; v_reason := OLD.tax_review_reason;
  END IF;
  IF v_ts = 'needs_review' THEN
    RAISE EXCEPTION 'Sales tax needs review before this invoice can be sent: %', coalesce(v_reason, 'see invoice') USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_billing_email_block_needs_review ON public.billing_email_messages;
CREATE TRIGGER trg_billing_email_block_needs_review
  BEFORE INSERT ON public.billing_email_messages
  FOR EACH ROW EXECUTE FUNCTION public.billing_block_send_needs_review();
DROP TRIGGER IF EXISTS trg_billing_invoice_block_send_needs_review ON public.billing_invoices;
CREATE TRIGGER trg_billing_invoice_block_send_needs_review
  BEFORE UPDATE OF status ON public.billing_invoices
  FOR EACH ROW EXECUTE FUNCTION public.billing_block_send_needs_review();

REVOKE ALL ON FUNCTION public.billing_invoice_compute_totals() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.billing_invoice_item_before() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.billing_invoice_item_after() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.billing_block_send_needs_review() FROM PUBLIC, anon, authenticated;
