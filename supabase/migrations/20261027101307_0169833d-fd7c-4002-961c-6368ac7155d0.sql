UPDATE public.supply_movements
SET occurred_at = (to_date(substring(notes from '(\d{1,2}/\d{1,2}/\d{4})'), 'MM/DD/YYYY') + time '12:00') AT TIME ZONE 'America/New_York'
WHERE movement_type IN ('sell', 'receive')
  AND notes ~ '\d{1,2}/\d{1,2}/\d{4}'
  AND billing_event_id IS NULL;