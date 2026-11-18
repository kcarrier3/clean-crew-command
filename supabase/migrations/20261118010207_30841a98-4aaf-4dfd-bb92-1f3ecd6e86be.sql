CREATE TABLE public.job_title_reporting (
  job_title text PRIMARY KEY,
  reports_to_title text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_title_reporting TO authenticated;
GRANT ALL ON public.job_title_reporting TO service_role;
ALTER TABLE public.job_title_reporting ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read chain" ON public.job_title_reporting FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage chain" ON public.job_title_reporting FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.job_title_reporting(job_title, reports_to_title) VALUES
 ('Janitorial Staff','Night Manager'),('Floaters','Night Manager'),('Supply','Supply Management'),
 ('Project Worker','Project Crew Lead'),('Night Manager','Operations Manager'),('Janitorial Manager','Operations Manager'),
 ('Project Crew Lead','Operations Manager'),('Supply Management','Operations Manager'),('Sales Rep','Office Manager'),
 ('Operations Manager','Owner'),('Office Manager','Owner');

CREATE OR REPLACE FUNCTION public.get_employee_managers(_employee_id uuid)
 RETURNS TABLE(manager_id uuid, manager_name text, manager_email text, manager_job_title text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _boss text;
BEGIN
  SELECT r.reports_to_title INTO _boss FROM profiles e JOIN job_title_reporting r ON r.job_title = e.job_title WHERE e.id = _employee_id;
  IF _boss IS NOT NULL AND EXISTS (SELECT 1 FROM profiles p WHERE p.job_title=_boss AND p.active AND p.id<>_employee_id) THEN
    RETURN QUERY SELECT p.id, p.first_name||' '||p.last_name, p.email, p.job_title
      FROM profiles p WHERE p.job_title=_boss AND p.active AND p.id<>_employee_id;
    RETURN;
  END IF;
  RETURN QUERY
  WITH ed AS (SELECT CASE WHEN job_title='Janitorial Staff' THEN 'janitorial' WHEN job_title='Project Worker' THEN 'construction' ELSE 'other' END d FROM profiles WHERE id=_employee_id)
  SELECT p.id, p.first_name||' '||p.last_name, p.email, p.job_title FROM profiles p CROSS JOIN ed
  WHERE p.job_title IN ('Owner','Administrator') OR (ed.d='janitorial' AND p.job_title='Janitorial Manager') OR (ed.d='construction' AND p.job_title='Project Crew Lead');
END $$;
REVOKE EXECUTE ON FUNCTION public.get_employee_managers(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_managers(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.get_my_manager_on_duty()
 RETURNS TABLE(manager_id uuid, full_name text, job_title text, phone text, job_site_name text, shift_date date, start_time time without time zone, is_current boolean)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid(); _title text; _boss text; _site uuid; _date date; _start time;
  _current boolean := false; _now timestamp := (now() AT TIME ZONE 'America/New_York');
BEGIN
  IF _uid IS NULL OR has_role(_uid,'admin') OR has_role(_uid,'manager') THEN RETURN; END IF;
  SELECT p.job_title INTO _title FROM profiles p WHERE p.id = _uid;
  SELECT r.reports_to_title INTO _boss FROM job_title_reporting r WHERE r.job_title = _title;

  SELECT t.job_site_id, (t.clock_in AT TIME ZONE 'America/New_York')::date, (t.clock_in AT TIME ZONE 'America/New_York')::time
    INTO _site, _date, _start
  FROM time_entries t WHERE t.employee_id = _uid AND t.clock_out IS NULL ORDER BY t.clock_in DESC LIMIT 1;

  IF _date IS NOT NULL THEN _current := true;
  ELSE
    SELECT s.job_site_id, d::date, s.start_time INTO _site, _date, _start
    FROM employee_schedules s CROSS JOIN generate_series(_now::date, _now::date + 14, interval '1 day') d
    WHERE s.employee_id = _uid AND s.active
      AND d::date >= s.start_date AND (s.end_date IS NULL OR d::date <= s.end_date)
      AND extract(dow FROM d)::int = ANY(s.days_of_week)
      AND ((d::date - coalesce(s.recurrence_anchor_date, s.start_date)) / 7) % greatest(coalesce(s.week_interval,1),1) = 0
      AND (d::date + s.start_time) > _now
    ORDER BY d::date + s.start_time LIMIT 1;
  END IF;

  IF _title = 'Project Worker' THEN
    IF _site IS NULL OR _date IS NULL THEN RETURN; END IF;
    RETURN QUERY
    SELECT DISTINCT p.id, trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')), p.job_title, p.phone,
      (SELECT j.name FROM job_sites j WHERE j.id=_site), _date, _start, _current
    FROM employee_schedules s JOIN profiles p ON p.id = s.employee_id
    WHERE s.job_site_id = _site AND s.active AND p.active AND p.id <> _uid
      AND (p.job_title = 'Project Crew Lead' OR has_role(p.id,'manager'))
      AND _date >= s.start_date AND (s.end_date IS NULL OR _date <= s.end_date)
      AND extract(dow FROM _date)::int = ANY(s.days_of_week)
      AND ((_date - coalesce(s.recurrence_anchor_date, s.start_date)) / 7) % greatest(coalesce(s.week_interval,1),1) = 0;
  ELSE
    RETURN QUERY
    SELECT p.id, trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')), p.job_title, p.phone,
      (SELECT j.name FROM job_sites j WHERE j.id=_site), _date, _start, _current
    FROM profiles p WHERE p.job_title = coalesce(_boss,'Night Manager') AND p.active AND p.id <> _uid
    ORDER BY 2;
  END IF;
END $function$;
REVOKE EXECUTE ON FUNCTION public.get_my_manager_on_duty() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_manager_on_duty() TO authenticated;