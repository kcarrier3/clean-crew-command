CREATE OR REPLACE FUNCTION public.initialize_monthly_budget(_job_site_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _current_month TEXT;
  _job_site RECORD;
  _new_budget NUMERIC;
BEGIN
  _current_month := to_char(now(), 'YYYY-MM');

  SELECT * INTO _job_site FROM public.job_sites WHERE id = _job_site_id;

  IF _job_site.is_recurring_monthly = true AND _job_site.budgeted_hours IS NOT NULL THEN
    IF _job_site.current_month_year IS NULL OR _job_site.current_month_year != _current_month THEN
      IF _job_site.current_month_year IS NOT NULL AND _job_site.current_month_used_hours IS NOT NULL THEN
        INSERT INTO public.monthly_budget_history (job_site_id, month_year, budgeted_hours, used_hours)
        VALUES (_job_site_id, _job_site.current_month_year, _job_site.budgeted_hours, _job_site.current_month_used_hours)
        ON CONFLICT (job_site_id, month_year)
        DO UPDATE SET used_hours = EXCLUDED.used_hours, updated_at = now();
      END IF;

      -- Recalculate the month's allowance from the nightly rate when configured
      _new_budget := COALESCE(
        public.monthly_hours_from_nightly(_job_site.nightly_hours, _job_site.service_days, CURRENT_DATE),
        _job_site.budgeted_hours
      );

      UPDATE public.job_sites
      SET
        budgeted_hours = _new_budget,
        current_month_year = _current_month,
        current_month_used_hours = 0,
        remaining_hours = _new_budget,
        last_reset_date = CURRENT_DATE,
        updated_at = now()
      WHERE id = _job_site_id;
    END IF;
  END IF;
END;
$function$;