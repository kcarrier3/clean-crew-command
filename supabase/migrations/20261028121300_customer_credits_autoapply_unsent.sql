-- The app creates invoices as 'ready' (never 'draft'), so auto-apply to any unsent draft/ready invoice
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
  IF inv.sent_at IS NOT NULL THEN RETURN 0; END IF;  -- auto-apply only to unsent draft/ready invoices
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

CREATE OR REPLACE FUNCTION public._credit_auto_apply_next(_credit_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.customer_credits; inv public.billing_invoices;
BEGIN
  SELECT * INTO c FROM customer_credits WHERE id = _credit_id;
  IF c.status <> 'available' OR NOT c.auto_apply THEN RETURN; END IF;
  FOR inv IN SELECT * FROM billing_invoices i WHERE i.status IN ('draft','ready') AND i.sent_at IS NULL ORDER BY i.invoice_date NULLS LAST, i.created_at LOOP
    IF credit_matches_invoice(c, inv) THEN
      PERFORM sync_invoice_credits(inv.id);
      SELECT * INTO c FROM customer_credits WHERE id = _credit_id;
      EXIT WHEN c.status <> 'available';
    END IF;
  END LOOP;
END $$;
