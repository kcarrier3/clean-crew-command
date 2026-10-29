DO $$
DECLARE
  r record;
  sid uuid;
  jan uuid := '45f372df-6797-479e-868b-9b96274bb4e1';
  v_site uuid;
  v_desc text;
  v_rate numeric;
BEGIN
  FOR r IN
    SELECT p.* FROM public.qb_recurring_prefill p
    WHERE p.id IN ('69597281-c0c4-4cd1-886c-3bcbc89a2016', '8419dab3-4802-44af-a8fe-95d937d5fe06')
      AND p.status = 'pending'
  LOOP
    IF r.id = '69597281-c0c4-4cd1-886c-3bcbc89a2016' THEN
      v_site := 'f6ec31ef-830d-46de-9c44-50fac463ab35'; v_desc := 'Janitorial Services'; v_rate := 400.00;
    ELSE
      v_site := 'b5342255-4cbf-41d2-b473-82c52aaabe92'; v_desc := 'Janitorial Services (Elevator Cleaning)'; v_rate := 90.00;
    END IF;

    INSERT INTO public.recurring_billing_schedules (
      job_site_id, label, status, amount, frequency, billing_day_rule, billing_day,
      service_period, payment_terms, po_required, billing_email, cc_recipients,
      memo, consolidated, invoice_description, qb_last_sent_on, qb_last_email_status
    ) VALUES (
      v_site, ltrim(r.qb_customer, '*'), 'inactive', v_rate, 'monthly', 'day_of_month',
      COALESCE(r.usual_day_of_month, 1), 'current', r.terms, false, r.bill_email, '{}',
      r.memo, false, NULL, r.latest_date, r.latest_email_status
    ) RETURNING id INTO sid;

    INSERT INTO public.recurring_billing_lines (schedule_id, billing_item_id, description, quantity, rate, taxable, sort_order)
    VALUES (sid, jan, v_desc, 1, v_rate, true, 0);

    UPDATE public.qb_recurring_prefill
    SET status = 'confirmed',
        job_site_id = v_site,
        confirmed_schedule_ids = confirmed_schedule_ids || sid
    WHERE id = r.id;
  END LOOP;
END $$;