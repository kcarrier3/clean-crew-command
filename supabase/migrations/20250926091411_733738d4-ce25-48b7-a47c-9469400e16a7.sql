-- Update the job site hours function to handle monthly budgets
CREATE OR REPLACE FUNCTION public.update_job_site_hours()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _job_site RECORD;
  _total_hours NUMERIC;
  _current_month TEXT;
  _current_month_hours NUMERIC;
BEGIN
  -- Get job site details
  SELECT * INTO _job_site FROM public.job_sites WHERE id = NEW.job_site_id;
  
  -- Calculate total hours for this job site
  SELECT COALESCE(SUM(
    CASE 
      WHEN te.clock_out IS NOT NULL THEN 
        EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600
      ELSE 0
    END
  ), 0) INTO _total_hours
  FROM public.time_entries te 
  WHERE te.job_site_id = NEW.job_site_id;
  
  IF _job_site.is_recurring_monthly = true AND _job_site.budgeted_hours IS NOT NULL THEN
    -- Handle recurring monthly accounts
    _current_month := to_char(now(), 'YYYY-MM');
    
    -- Initialize monthly budget if needed
    PERFORM public.initialize_monthly_budget(NEW.job_site_id);
    
    -- Calculate current month's hours
    SELECT COALESCE(SUM(
      CASE 
        WHEN te.clock_out IS NOT NULL THEN 
          EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600
        ELSE 0
      END
    ), 0) INTO _current_month_hours
    FROM public.time_entries te 
    WHERE te.job_site_id = NEW.job_site_id
      AND to_char(te.clock_in, 'YYYY-MM') = _current_month;
    
    -- Update current month's used hours and remaining hours
    UPDATE public.job_sites 
    SET 
      current_month_used_hours = _current_month_hours,
      used_hours = _total_hours,
      remaining_hours = budgeted_hours - _current_month_hours,
      updated_at = now()
    WHERE id = NEW.job_site_id;
    
  ELSE
    -- Handle non-recurring accounts (existing logic)
    UPDATE public.job_sites 
    SET used_hours = _total_hours
    WHERE id = NEW.job_site_id 
      AND is_recurring_monthly = false
      AND budgeted_hours IS NOT NULL;
  END IF;
  
  RETURN NEW;
END;
$$;