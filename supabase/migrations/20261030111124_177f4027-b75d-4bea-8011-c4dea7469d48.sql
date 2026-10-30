UPDATE public.recurring_billing_schedules
   SET status = 'active',
       start_date = DATE '2026-12-01',
       next_invoice_date = DATE '2026-12-01'
 WHERE status = 'inactive'
   AND label NOT IN (
     'City of Avon monthly (combined) - Aquatic Facility (seasonal)',
     'City Wide - Westlake extras (QB 126)'
   );