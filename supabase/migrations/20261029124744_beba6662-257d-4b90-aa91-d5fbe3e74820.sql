DO $$
DECLARE
  r record;
  sid uuid;
  jan uuid := '45f372df-6797-479e-868b-9b96274bb4e1';
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('38c4df41-e3de-4ce3-8789-f97512185b45'::uuid, 'f72e2859-eb4e-4aad-83af-b4733cd4cd1c'::uuid, 2352.50::numeric),
      ('58445b95-cd15-4b8b-8e0d-13c60976ffcf'::uuid, 'b7b10611-8dc0-43fa-8c76-bedd64886672'::uuid, 3145.00::numeric),
      ('c3e31dd5-f4e6-49bc-adb7-562fad8df56b'::uuid, '2dda202a-969e-4676-809c-a8de8a5a6736'::uuid, 780.00::numeric),
      ('0bbf48b1-d3cc-4e78-8b30-224624f38bee'::uuid, '73502cf2-e701-4fea-887a-e8db4edbcea2'::uuid, 195.00::numeric),
      ('deee57d9-31c7-4861-9c12-b9466f82cd57'::uuid, '4565b929-ce51-4801-b4dc-af071b929903'::uuid, 510.00::numeric)
    ) AS v(prefill_id, site_id, rate)
  LOOP
    -- Skip if this suggestion was already confirmed
    IF EXISTS (SELECT 1 FROM public.qb_recurring_prefill p WHERE p.id = r.prefill_id AND p.status = 'confirmed') THEN
      CONTINUE;
    END IF;

    INSERT INTO public.recurring_billing_schedules (
      job_site_id, label, status, amount, frequency, billing_day_rule, billing_day,
      service_period, payment_terms, po_required, billing_email, cc_recipients,
      memo, consolidated, invoice_description, qb_last_sent_on, qb_last_email_status
    )
    SELECT r.site_id, p.qb_customer, 'inactive', r.rate, 'monthly', 'day_of_month',
           COALESCE(p.usual_day_of_month, 1), 'current', p.terms, false, p.bill_email, '{}',
           p.memo, false, NULL, p.latest_date, p.latest_email_status
    FROM public.qb_recurring_prefill p WHERE p.id = r.prefill_id
    RETURNING id INTO sid;

    INSERT INTO public.recurring_billing_lines (schedule_id, billing_item_id, description, quantity, rate, taxable, sort_order)
    VALUES (sid, jan, 'Janitorial Services', 1, r.rate, true, 0);

    UPDATE public.qb_recurring_prefill
    SET status = 'confirmed',
        job_site_id = r.site_id::text,
        confirmed_schedule_ids = confirmed_schedule_ids || sid
    WHERE id = r.prefill_id;
  END LOOP;
END $$;