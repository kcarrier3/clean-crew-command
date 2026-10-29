UPDATE public.qb_recurring_prefill
SET status = 'dismissed'
WHERE pattern IS DISTINCT FROM 'qb_recurring_template'
  AND status = 'pending';