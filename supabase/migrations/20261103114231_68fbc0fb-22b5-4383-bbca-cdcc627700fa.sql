-- Per-night hour allowance for recurring accounts (index 1 = Sunday .. 7 = Saturday)
ALTER TABLE public.job_sites
  ADD COLUMN IF NOT EXISTS nightly_hours_by_day numeric[];

ALTER TABLE public.job_sites
  ADD CONSTRAINT job_sites_nightly_hours_by_day_shape
  CHECK (nightly_hours_by_day IS NULL
         OR (array_length(nightly_hours_by_day, 1) = 7 AND 0 <= ALL (nightly_hours_by_day)));

COMMENT ON COLUMN public.job_sites.nightly_hours_by_day IS
  'Variable hours per night, 7 entries Sunday..Saturday. When set, overrides nightly_hours.';

-- New columns on job_sites need explicit per-column grants
GRANT SELECT (nightly_hours_by_day), INSERT (nightly_hours_by_day), UPDATE (nightly_hours_by_day)
  ON TABLE public.job_sites TO authenticated;

-- Restore the documented rule: contract/billing amount columns are not readable
-- through the API; every other column keeps its per-column grant.
REVOKE SELECT, INSERT, UPDATE ON TABLE public.job_sites FROM PUBLIC, anon, authenticated;
REVOKE SELECT, INSERT, UPDATE ON TABLE public.project_phases FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.monthly_hours_for_schedule(
  _nightly numeric, _by_day numeric[], _service_days smallint[], _month date)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN (_nightly IS NULL AND _by_day IS NULL)
      OR _service_days IS NULL OR array_length(_service_days, 1) IS NULL THEN NULL
    ELSE (
      SELECT COALESCE(SUM(
        CASE WHEN _by_day IS NOT NULL
             THEN COALESCE(_by_day[EXTRACT(DOW FROM d)::int + 1], 0)
             ELSE _nightly END), 0)
      FROM generate_series(date_trunc('month', _month)::date,
                           (date_trunc('month', _month) + interval '1 month - 1 day')::date,
                           interval '1 day') d
      WHERE EXTRACT(DOW FROM d)::smallint = ANY (_service_days)
    )
  END
$$;

REVOKE ALL ON FUNCTION public.monthly_hours_for_schedule(numeric, numeric[], smallint[], date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.monthly_hours_for_schedule(numeric, numeric[], smallint[], date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.sync_job_site_budget_from_nightly()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_recurring_monthly
     AND (NEW.nightly_hours IS NOT NULL OR NEW.nightly_hours_by_day IS NOT NULL)
     AND array_length(NEW.service_days, 1) IS NOT NULL THEN
    NEW.budgeted_hours := public.monthly_hours_for_schedule(
      NEW.nightly_hours, NEW.nightly_hours_by_day, NEW.service_days, CURRENT_DATE);
    NEW.remaining_hours := NEW.budgeted_hours - COALESCE(NEW.current_month_used_hours, 0);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_job_site_budget_from_nightly ON public.job_sites;
CREATE TRIGGER trg_sync_job_site_budget_from_nightly
BEFORE INSERT OR UPDATE OF nightly_hours, nightly_hours_by_day, service_days, is_recurring_monthly ON public.job_sites
FOR EACH ROW EXECUTE FUNCTION public.sync_job_site_budget_from_nightly();

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

      -- Recalculate the month's allowance from the nightly (or per-night) rate when configured
      _new_budget := COALESCE(
        public.monthly_hours_for_schedule(_job_site.nightly_hours, _job_site.nightly_hours_by_day,
                                          _job_site.service_days, CURRENT_DATE),
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