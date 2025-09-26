-- Create function to initialize monthly budget for recurring accounts
CREATE OR REPLACE FUNCTION public.initialize_monthly_budget(_job_site_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _current_month TEXT;
  _job_site RECORD;
BEGIN
  -- Get current month in YYYY-MM format
  _current_month := to_char(now(), 'YYYY-MM');
  
  -- Get job site details
  SELECT * INTO _job_site FROM public.job_sites WHERE id = _job_site_id;
  
  -- Only process recurring monthly accounts with budgeted hours
  IF _job_site.is_recurring_monthly = true AND _job_site.budgeted_hours IS NOT NULL THEN
    -- Check if we need to reset for new month
    IF _job_site.current_month_year IS NULL OR _job_site.current_month_year != _current_month THEN
      -- Save previous month's data to history if it exists
      IF _job_site.current_month_year IS NOT NULL AND _job_site.current_month_used_hours IS NOT NULL THEN
        INSERT INTO public.monthly_budget_history (job_site_id, month_year, budgeted_hours, used_hours)
        VALUES (_job_site_id, _job_site.current_month_year, _job_site.budgeted_hours, _job_site.current_month_used_hours)
        ON CONFLICT (job_site_id, month_year) 
        DO UPDATE SET used_hours = EXCLUDED.used_hours, updated_at = now();
      END IF;
      
      -- Reset for new month
      UPDATE public.job_sites 
      SET 
        current_month_year = _current_month,
        current_month_used_hours = 0,
        last_reset_date = CURRENT_DATE,
        updated_at = now()
      WHERE id = _job_site_id;
    END IF;
  END IF;
END;
$$;