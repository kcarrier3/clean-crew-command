-- New referral credits must name the customer who was referred.
-- customer_credits.referred_crm_company_id already exists (20261028120951) and
-- issue_customer_credit already accepts _referred_crm_company_id. This keeps that
-- signature so existing callers still work, and only rejects NEW referral issues
-- that omit it (or name the same customer who is receiving the credit).
-- No CHECK constraint: existing rows are not revalidated, and later updates
-- (approve, void, apply) of an older referral stay valid.

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
  IF _reason = 'referral' AND _referred_crm_company_id IS NULL THEN
    RAISE EXCEPTION 'A referral credit must name the customer who was referred';
  END IF;
  IF _reason = 'referral' AND _crm_company_id IS NOT NULL AND _referred_crm_company_id = _crm_company_id THEN
    RAISE EXCEPTION 'The referred customer must be someone other than the customer receiving the credit';
  END IF;
  IF _reason = 'referral' AND _crm_company_id IS NULL AND EXISTS (
    SELECT 1 FROM public.job_sites s
    WHERE s.id = _job_site_id AND s.crm_company_id = _referred_crm_company_id
  ) THEN
    RAISE EXCEPTION 'The referred customer must be someone other than the customer receiving the credit';
  END IF;
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

-- Same signature, so existing grants survive CREATE OR REPLACE. Restate them so a
-- re-apply stays authenticated-only and does not open the function to anon.
REVOKE ALL ON FUNCTION public.issue_customer_credit(numeric, text, uuid, uuid, text, boolean, boolean, uuid, uuid, uuid, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_customer_credit(numeric, text, uuid, uuid, text, boolean, boolean, uuid, uuid, uuid, date, uuid) TO authenticated;
