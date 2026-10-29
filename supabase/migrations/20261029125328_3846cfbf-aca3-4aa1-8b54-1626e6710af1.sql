DO $$
DECLARE
  r record;
  l record;
  sid uuid;
  total numeric;
  jan uuid := '45f372df-6797-479e-868b-9b96274bb4e1';
BEGIN
  CREATE TEMP TABLE _qb_lines (prefill_id uuid, sort_order int, description text, rate numeric) ON COMMIT DROP;
  INSERT INTO _qb_lines VALUES
    ('1000eaca-21f7-44e7-b79e-f71ccb1e210c', 0, 'Janitorial Services', 325.00),
    ('072b054f-4d89-4ad2-a40c-1fcb8ada9f0f', 0, 'Janitorial Services', 1420.00),
    ('072b054f-4d89-4ad2-a40c-1fcb8ada9f0f', 1, 'Janitorial Services (Engineering Office)', 70.00),
    ('23420b28-2b84-494a-9bc5-318e1edeb2aa', 0, 'Janitorial Services', 475.00),
    ('5c7ac3b4-c2bb-4ec4-b9aa-c47ec0584a8c', 0, 'Janitorial Services', 650.00),
    ('75d011b3-60c2-4fff-8960-4428690b86db', 0, 'Janitorial Services', 257.04),
    ('0a66bb08-d442-48d6-baac-f6b000a2f4ec', 0, 'Janitorial Services', 275.00),
    ('f85cd849-982f-4c19-98e1-336de7fb4e8e', 0, 'Janitorial Services', 1599.00),
    ('5b70e60c-220a-4620-a118-2dcb02e268e1', 0, 'Janitorial Services', 8570.00),
    ('a1584dce-c922-42fd-9e76-87f254fa2fda', 0, 'Janitorial Services (3 days of service)', 1250.00),
    ('468d4c71-347b-4f51-abd9-f16565c79613', 0, 'Janitorial Services', 4500.00),
    ('f2a3c356-9cd3-4e4b-8752-fd4a33cd536c', 0, 'Janitorial Services', 315.00),
    ('866e4f74-cd02-4290-9a58-940e44208018', 0, 'Janitorial Services', 530.00),
    ('5811acbe-31d6-4248-b8d6-6c9998e33e80', 0, 'Janitorial Services', 1400.00),
    ('37cfba5e-5937-4984-945f-e7f012a1992a', 0, 'Janitorial Services', 245.00),
    ('fb684187-611a-4bca-b9ea-5338d2c0a7ed', 0, 'Janitorial Services', 430.00);

  FOR r IN
    SELECT p.* FROM public.qb_recurring_prefill p
    WHERE p.id IN (SELECT DISTINCT prefill_id FROM _qb_lines)
      AND p.status = 'pending'
      AND p.job_site_match = 'exact'
  LOOP
    SELECT sum(rate) INTO total FROM _qb_lines WHERE prefill_id = r.id;

    INSERT INTO public.recurring_billing_schedules (
      job_site_id, label, status, amount, frequency, billing_day_rule, billing_day,
      service_period, payment_terms, po_required, billing_email, cc_recipients,
      memo, consolidated, invoice_description, qb_last_sent_on, qb_last_email_status
    ) VALUES (
      r.job_site_id::uuid, ltrim(r.qb_customer, '*'), 'inactive', total, 'monthly', 'day_of_month',
      COALESCE(r.usual_day_of_month, 1), 'current', r.terms, false, r.bill_email, '{}',
      r.memo, false, NULL, r.latest_date, r.latest_email_status
    ) RETURNING id INTO sid;

    FOR l IN SELECT * FROM _qb_lines WHERE prefill_id = r.id ORDER BY sort_order LOOP
      INSERT INTO public.recurring_billing_lines (schedule_id, billing_item_id, description, quantity, rate, taxable, sort_order)
      VALUES (sid, jan, l.description, 1, l.rate, true, l.sort_order);
    END LOOP;

    UPDATE public.qb_recurring_prefill
    SET status = 'confirmed',
        confirmed_schedule_ids = confirmed_schedule_ids || sid
    WHERE id = r.id;
  END LOOP;
END $$;