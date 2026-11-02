ALTER TABLE public.billing_invoices ADD COLUMN IF NOT EXISTS created_via text;

-- Supply drop-offs (ready or on hold) delivered in one Sunday-Saturday week, Eastern time.
CREATE OR REPLACE FUNCTION public.supply_billing_week_events(_week_start date)
RETURNS SETOF public.billing_events
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT e.*
  FROM public.billing_events e
  WHERE e.source = 'supply_usage'
    AND e.status IN ('ready', 'hold')
    AND e.invoice_id IS NULL
    AND (e.completed_at AT TIME ZONE 'America/New_York')::date BETWEEN _week_start AND _week_start + 6
  ORDER BY e.job_site_id, e.completed_at;
$$;

-- Turns one account's ready supply drop-offs into a single invoice, atomically.
-- Locks the events first, so a second click or a second person never bills them twice.
CREATE OR REPLACE FUNCTION public.create_supply_week_invoice(
  _job_site_id uuid, _event_ids uuid[], _invoice_date date, _note text, _created_by uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ids uuid[];
  v_site record;
  v_co record;
  v_prefs record;
  v_terms text;
  v_days int;
  v_email text;
  v_po text;
  v_inv uuid;
  v_earliest timestamptz;
  v_first_email text;
  v_first_po text;
BEGIN
  IF _job_site_id IS NULL OR _event_ids IS NULL OR cardinality(_event_ids) = 0 THEN
    RETURN NULL;
  END IF;

  PERFORM 1 FROM public.billing_events
  WHERE id = ANY(_event_ids) FOR UPDATE;

  SELECT array_agg(id ORDER BY completed_at), min(completed_at)
    INTO v_ids, v_earliest
  FROM public.billing_events
  WHERE id = ANY(_event_ids)
    AND job_site_id = _job_site_id
    AND source = 'supply_usage'
    AND status = 'ready'
    AND invoice_id IS NULL;

  IF v_ids IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT billing_email, po_number INTO v_first_email, v_first_po
  FROM public.billing_events WHERE id = v_ids[1];

  SELECT s.name, s.client_name, s.billing_terms, s.billing_contact_name, s.billing_email,
         s.billing_po_number, s.address, s.city, s.state, s.crm_company_id, s.crm_lead_id, s.crm_deal_id
    INTO v_site
  FROM public.job_sites s WHERE s.id = _job_site_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found';
  END IF;

  IF v_site.crm_company_id IS NOT NULL THEN
    SELECT c.name, c.address, c.city, c.state, c.zip INTO v_co
    FROM public.crm_companies c WHERE c.id = v_site.crm_company_id;
    SELECT p.primary_billing_email, p.default_terms, p.billing_contact_name, p.default_po_number INTO v_prefs
    FROM public.billing_account_preferences p WHERE p.crm_company_id = v_site.crm_company_id;
  END IF;

  v_terms := coalesce(nullif(v_prefs.default_terms, ''), nullif(v_site.billing_terms, ''), 'Net 30');
  v_days := coalesce((regexp_match(v_terms, 'net\s*(\d+)', 'i'))[1]::int, 30);
  v_email := coalesce(nullif(v_prefs.primary_billing_email, ''), nullif(v_first_email, ''), nullif(v_site.billing_email, ''));
  v_po := coalesce(nullif(v_first_po, ''), nullif(v_site.billing_po_number, ''), nullif(v_prefs.default_po_number, ''));

  INSERT INTO public.billing_invoices (
    invoice_number, job_site_id, crm_company_id, crm_lead_id, crm_deal_id,
    customer_name, billing_contact_name, billing_email, po_number,
    status, invoice_date, due_date, payment_terms,
    bill_to_name, bill_to_address, bill_to_city, bill_to_state, bill_to_zip,
    ship_to_name, ship_to_address, ship_to_city, ship_to_state,
    notes, earliest_completed_at, created_by, created_via
  ) VALUES (
    public.next_invoice_number(), _job_site_id, v_site.crm_company_id, v_site.crm_lead_id, v_site.crm_deal_id,
    coalesce(v_co.name, v_site.client_name, v_site.name),
    coalesce(nullif(v_prefs.billing_contact_name, ''), v_site.billing_contact_name),
    v_email, v_po,
    'ready', _invoice_date, _invoice_date + v_days, v_terms,
    v_co.name, v_co.address, v_co.city, v_co.state, v_co.zip,
    coalesce(v_site.client_name, v_site.name), v_site.address, v_site.city, v_site.state,
    _note, v_earliest, _created_by, 'supply_week'
  ) RETURNING id INTO v_inv;

  INSERT INTO public.billing_invoice_items (invoice_id, description, quantity, unit_price, sort_order)
  SELECT v_inv,
         CASE WHEN e.description IS NOT NULL AND btrim(e.description) <> ''
              THEN e.label || E'\n' || e.description ELSE e.label END,
         1, coalesce(e.amount, 0), t.ord - 1
  FROM unnest(v_ids) WITH ORDINALITY AS t(id, ord)
  JOIN public.billing_events e ON e.id = t.id;

  UPDATE public.billing_events
     SET status = 'invoiced', invoice_id = v_inv, invoiced_at = now()
   WHERE id = ANY(v_ids);

  RETURN v_inv;
END $$;

REVOKE EXECUTE ON FUNCTION public.supply_billing_week_events(date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_supply_week_invoice(uuid, uuid[], date, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.supply_billing_week_events(date) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_supply_week_invoice(uuid, uuid[], date, text, uuid) TO service_role;