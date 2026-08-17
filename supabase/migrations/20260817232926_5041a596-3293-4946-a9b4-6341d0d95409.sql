CREATE OR REPLACE FUNCTION public.get_pto_summary(_employee_id uuid, _as_of date DEFAULT CURRENT_DATE)
 RETURNS TABLE(employee_id uuid, hire_date date, years_of_service integer, eligible boolean, weeks numeric, avg_weekly_hours numeric, entitled_hours numeric, used_hours numeric, adjustment_hours numeric, remaining_hours numeric, year_start date, year_end date)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_profile record;
  v_years integer;
  v_weeks numeric := 0;
  v_avg numeric := 0;
  v_eff numeric := 0;
  v_ft_threshold numeric := 35;
  v_hours numeric := 0;
  v_lookback_start date;
  v_span_weeks numeric := 52;
  v_start date;
  v_end date;
  v_used numeric := 0;
  v_adj numeric := 0;
BEGIN
  SELECT p.id, p.hire_date, p.job_title INTO v_profile FROM public.profiles p WHERE p.id = _employee_id;
  IF NOT FOUND OR v_profile.hire_date IS NULL THEN
    RETURN;
  END IF;

  v_years := EXTRACT(YEAR FROM age(_as_of, v_profile.hire_date))::int;

  v_start := (v_profile.hire_date + make_interval(years => v_years))::date;
  v_end := (v_start + interval '1 year - 1 day')::date;

  IF public.is_pto_manager_title(v_profile.job_title) THEN
    v_weeks := COALESCE((SELECT value::numeric FROM public.app_settings WHERE key = 'pto_manager_weeks'), 2);
  ELSE
    SELECT COALESCE(MAX(t.weeks), 0) INTO v_weeks
    FROM public.pto_tiers t WHERE t.years_of_service <= v_years;
  END IF;

  v_lookback_start := GREATEST((_as_of - interval '52 weeks')::date, v_profile.hire_date);
  v_span_weeks := GREATEST((_as_of - v_lookback_start)::numeric / 7.0, 1);
  IF v_span_weeks > 52 THEN v_span_weeks := 52; END IF;

  SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600.0), 0)
  INTO v_hours
  FROM public.time_entries te
  WHERE te.employee_id = _employee_id
    AND te.clock_out IS NOT NULL
    AND te.clock_in >= v_lookback_start;

  v_avg := v_hours / v_span_weeks;

  v_ft_threshold := COALESCE((SELECT value::numeric FROM public.app_settings WHERE key = 'pto_fulltime_threshold_hours'), 35);

  -- full-time employees accrue on a standard 40-hour week; part-timers on their true average
  IF v_avg >= v_ft_threshold THEN
    v_eff := 40;
  ELSE
    v_eff := v_avg;
  END IF;

  SELECT COALESCE(SUM(r.pto_hours), 0) INTO v_used
  FROM public.time_off_requests r
  WHERE r.employee_id = _employee_id
    AND r.use_pto
    AND r.status = 'approved'::time_off_status
    AND r.start_date BETWEEN v_start AND v_end;

  SELECT COALESCE(SUM(a.hours), 0) INTO v_adj
  FROM public.pto_adjustments a
  WHERE a.employee_id = _employee_id
    AND a.effective_date BETWEEN v_start AND v_end;

  RETURN QUERY SELECT
    _employee_id,
    v_profile.hire_date,
    v_years,
    (v_years >= 1),
    v_weeks,
    ROUND(v_avg, 2),
    ROUND(CASE WHEN v_years >= 1 THEN v_weeks * v_eff ELSE 0 END, 2),
    ROUND(v_used, 2),
    ROUND(v_adj, 2),
    ROUND(CASE WHEN v_years >= 1 THEN v_weeks * v_eff ELSE 0 END + v_adj - v_used, 2),
    v_start,
    v_end;
END;
$function$;