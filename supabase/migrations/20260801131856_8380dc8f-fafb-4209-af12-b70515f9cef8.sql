CREATE OR REPLACE FUNCTION public.time_off_request_cutoff()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tz text := 'America/Chicago';
  v_local_now timestamp;
  v_week_start date;   -- Sunday of the requested work week
  v_cutoff timestamp;  -- Wednesday 12:00 of the prior week
BEGIN
  IF NEW.start_date IS NULL THEN
    RETURN NEW;
  END IF;

  -- Sunday that begins the work week containing start_date
  v_week_start := NEW.start_date - EXTRACT(DOW FROM NEW.start_date)::int;

  -- Wednesday 12:00 PM of the prior week = Sunday - 4 days at noon
  v_cutoff := (v_week_start - 4)::timestamp + interval '12 hours';

  v_local_now := (COALESCE(NEW.requested_at, now()) AT TIME ZONE v_tz);

  IF v_local_now > v_cutoff THEN
    NEW.status := 'declined'::time_off_status;
    NEW.reviewed_at := now();
    NEW.manager_notes := COALESCE(NEW.manager_notes || E'\n', '')
      || 'Auto-declined: requests must be submitted by 12:00 PM on '
      || to_char(v_cutoff, 'Mon DD, YYYY')
      || ' (Wednesday before the work week starting '
      || to_char(v_week_start, 'Mon DD, YYYY') || ').';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.time_off_request_cutoff() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_time_off_request_cutoff ON public.time_off_requests;
CREATE TRIGGER trg_time_off_request_cutoff
BEFORE INSERT ON public.time_off_requests
FOR EACH ROW EXECUTE FUNCTION public.time_off_request_cutoff();