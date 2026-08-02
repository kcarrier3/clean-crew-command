ALTER TABLE public.job_sites
  ADD COLUMN IF NOT EXISTS nightly_hours numeric,
  ADD COLUMN IF NOT EXISTS service_days smallint[] NOT NULL DEFAULT '{}'::smallint[];

COMMENT ON COLUMN public.job_sites.nightly_hours IS 'Allowed hours per night of service for recurring janitorial accounts';
COMMENT ON COLUMN public.job_sites.service_days IS 'Days of week serviced, 0=Sunday .. 6=Saturday';

CREATE OR REPLACE FUNCTION public.monthly_hours_from_nightly(_nightly numeric, _service_days smallint[], _month date)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _nightly IS NULL OR _service_days IS NULL OR array_length(_service_days, 1) IS NULL THEN NULL
    ELSE _nightly * (
      SELECT COUNT(*)
      FROM generate_series(date_trunc('month', _month)::date,
                           (date_trunc('month', _month) + interval '1 month - 1 day')::date,
                           interval '1 day') d
      WHERE EXTRACT(DOW FROM d)::smallint = ANY (_service_days)
    )
  END
$$;

REVOKE ALL ON FUNCTION public.monthly_hours_from_nightly(numeric, smallint[], date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.monthly_hours_from_nightly(numeric, smallint[], date) TO authenticated, service_role;

-- Keep budgeted_hours in sync for recurring accounts that use a nightly allowance
CREATE OR REPLACE FUNCTION public.sync_job_site_budget_from_nightly()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_recurring_monthly AND NEW.nightly_hours IS NOT NULL
     AND array_length(NEW.service_days, 1) IS NOT NULL THEN
    NEW.budgeted_hours := public.monthly_hours_from_nightly(NEW.nightly_hours, NEW.service_days, CURRENT_DATE);
    NEW.remaining_hours := NEW.budgeted_hours - COALESCE(NEW.current_month_used_hours, 0);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_job_site_budget_from_nightly ON public.job_sites;
CREATE TRIGGER trg_sync_job_site_budget_from_nightly
BEFORE INSERT OR UPDATE OF nightly_hours, service_days, is_recurring_monthly ON public.job_sites
FOR EACH ROW EXECUTE FUNCTION public.sync_job_site_budget_from_nightly();