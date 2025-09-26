-- Fix function security by setting search path
CREATE OR REPLACE FUNCTION public.update_job_site_hours()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only update used hours for non-recurring accounts
  UPDATE public.job_sites 
  SET used_hours = (
    SELECT COALESCE(SUM(
      CASE 
        WHEN te.clock_out IS NOT NULL THEN 
          EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600
        ELSE 0
      END
    ), 0)
    FROM public.time_entries te 
    WHERE te.job_site_id = NEW.job_site_id
  )
  WHERE id = NEW.job_site_id 
    AND is_recurring_monthly = false
    AND budgeted_hours IS NOT NULL;
  
  RETURN NEW;
END;
$$;