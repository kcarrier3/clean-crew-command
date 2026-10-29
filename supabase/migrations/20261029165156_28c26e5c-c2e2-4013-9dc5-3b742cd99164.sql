DO $$
DECLARE
  v_city uuid := '9d442251-5137-4642-80d2-79ca602aa99d';
  v_parks uuid := '68448b73-6c51-4108-b7e7-fcf420f400d5';
  v_aquatic_site uuid := '06d19359-bde5-4c9e-bae4-c8673f116c97';
  jan uuid := '45f372df-6797-479e-868b-9b96274bb4e1';
  v_memo text := E'REVISED \nCurrent Month Services\nParks & Rec PO #2025-00976';
  sid uuid;
BEGIN
  -- Parks & Rec joins the city's single combined invoice (stays off)
  UPDATE public.recurring_billing_schedules
  SET consolidated = true,
      billing_email = 'financedept@cityofavon.com',
      label = 'City of Avon monthly (combined) - Parks & Rec',
      notes = 'QB 86 template 53 (inv 3749, $1,595 = all park restrooms open). Combined onto the City of Avon invoice per Kennedy 2026-10-29. Amount changes when parks close restrooms; adjust lines before each invoice as needed.'
  WHERE id = v_parks AND crm_company_id = v_city;

  -- Seasonal Avon Aquatic Facility, loaded but off
  IF NOT EXISTS (
    SELECT 1 FROM public.recurring_billing_schedules WHERE job_site_id = v_aquatic_site
  ) THEN
    INSERT INTO public.recurring_billing_schedules (
      job_site_id, crm_company_id, label, status, amount, frequency, billing_day_rule, billing_day,
      service_period, payment_terms, po_required, billing_email, cc_recipients,
      memo, consolidated, invoice_description, tax_rate, notes
    ) VALUES (
      v_aquatic_site, v_city, 'City of Avon monthly (combined) - Aquatic Facility (seasonal)', 'inactive', 2300.00,
      'monthly', 'day_of_month', 1, 'current', 'Net 30', false, 'financedept@cityofavon.com', '{}',
      v_memo, true, 'Janitorial Services — {{period}}', 0,
      'Seasonal. $2,300 inferred from summer QB template 21 invoices ($7,503.75 / $7,380 vs $5,203.75 / $5,080); confirm before turning on.'
    ) RETURNING id INTO sid;

    INSERT INTO public.recurring_billing_lines (schedule_id, billing_item_id, description, quantity, rate, taxable, sort_order)
    VALUES (sid, jan, 'Janitorial Services (Avon Aquatic Facility)', 1, 2300.00, false, 0);
  END IF;

  -- Same memo on every city schedule so the PO survives consolidation
  UPDATE public.recurring_billing_schedules
  SET memo = v_memo
  WHERE crm_company_id = v_city;
END $$;