DO $$
DECLARE
  r record;
  sid uuid;
  jan uuid := '45f372df-6797-479e-868b-9b96274bb4e1';
  truck uuid := '374405e7-2aae-49f5-84bc-8284d207e6fe';
  v_site uuid := 'a719c564-b69c-46e4-b319-6cb5575d755c';
BEGIN
  SELECT * INTO r FROM public.qb_recurring_prefill
  WHERE id = 'cb3d65d0-f812-4bd3-9fac-acdb7bc6ffe6' AND status = 'pending';
  IF NOT FOUND THEN
    RETURN;
  END IF;

  INSERT INTO public.recurring_billing_schedules (
    job_site_id, label, status, amount, frequency, billing_day_rule, billing_day,
    service_period, payment_terms, po_required, billing_email, cc_recipients,
    memo, consolidated, invoice_description, qb_last_sent_on, qb_last_email_status
  ) VALUES (
    v_site, ltrim(r.qb_customer, '*'), 'inactive', 21994.00, 'monthly', 'day_of_month',
    COALESCE(r.usual_day_of_month, 1), 'current', r.terms, false, r.bill_email, '{}',
    r.memo, false, NULL, r.latest_date, r.latest_email_status
  ) RETURNING id INTO sid;

  INSERT INTO public.recurring_billing_lines (schedule_id, billing_item_id, description, quantity, rate, taxable, sort_order) VALUES
    (sid, jan,   'Janitorial Services',                  1, 17649.00, true, 0),
    (sid, truck, 'Truck Expenses',                       1,   340.00, true, 1),
    (sid, jan,   'Janitorial Services (Palmer Holland)', 1,  2630.00, true, 2),
    (sid, jan,   'Janitorial Services (CPL)',            1,  1375.00, true, 3);

  UPDATE public.qb_recurring_prefill
  SET status = 'confirmed',
      job_site_id = v_site,
      confirmed_schedule_ids = confirmed_schedule_ids || sid
  WHERE id = r.id;
END $$;