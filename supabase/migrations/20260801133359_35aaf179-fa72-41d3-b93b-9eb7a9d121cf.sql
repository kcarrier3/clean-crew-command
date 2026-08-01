
-- ============ time off requests: link to profiles, PTO fields ============
ALTER TABLE public.time_off_requests
  DROP CONSTRAINT IF EXISTS time_off_requests_employee_id_fkey;
ALTER TABLE public.time_off_requests
  ADD CONSTRAINT time_off_requests_employee_id_fkey
  FOREIGN KEY (employee_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.time_off_requests
  ADD COLUMN IF NOT EXISTS use_pto boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pto_hours numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_approved boolean NOT NULL DEFAULT false;

-- ============ time off policies ============
CREATE TABLE IF NOT EXISTS public.time_off_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department text NOT NULL UNIQUE,
  max_off_per_day integer NOT NULL DEFAULT 1,
  auto_approve boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.time_off_policies TO authenticated;
GRANT ALL ON public.time_off_policies TO service_role;
ALTER TABLE public.time_off_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view time off policies" ON public.time_off_policies
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers manage time off policies" ON public.time_off_policies
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));
GRANT INSERT, UPDATE, DELETE ON public.time_off_policies TO authenticated;
CREATE TRIGGER update_time_off_policies_updated_at BEFORE UPDATE ON public.time_off_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.time_off_policies (department, max_off_per_day, auto_approve) VALUES
  ('janitorial', 2, true),
  ('project', 1, true),
  ('management', 1, true),
  ('other', 2, true)
ON CONFLICT (department) DO NOTHING;

-- ============ PTO tiers ============
CREATE TABLE IF NOT EXISTS public.pto_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  years_of_service integer NOT NULL UNIQUE,
  weeks numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pto_tiers TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.pto_tiers TO authenticated;
GRANT ALL ON public.pto_tiers TO service_role;
ALTER TABLE public.pto_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view pto tiers" ON public.pto_tiers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage pto tiers" ON public.pto_tiers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));
CREATE TRIGGER update_pto_tiers_updated_at BEFORE UPDATE ON public.pto_tiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.pto_tiers (years_of_service, weeks) VALUES (1,1),(3,2),(5,3)
ON CONFLICT (years_of_service) DO NOTHING;

INSERT INTO public.app_settings (key, value, description)
VALUES ('pto_manager_weeks','2','Weeks of PTO granted to managers regardless of tenure')
ON CONFLICT (key) DO NOTHING;

-- ============ paid holidays ============
CREATE TABLE IF NOT EXISTS public.paid_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  rule text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  paid_only_if_scheduled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.paid_holidays TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.paid_holidays TO authenticated;
GRANT ALL ON public.paid_holidays TO service_role;
ALTER TABLE public.paid_holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view paid holidays" ON public.paid_holidays
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers manage paid holidays" ON public.paid_holidays
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));
CREATE TRIGGER update_paid_holidays_updated_at BEFORE UPDATE ON public.paid_holidays
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.paid_holidays (name, rule) VALUES
  ('New Year''s Day','01-01'),
  ('Memorial Day','last-monday-may'),
  ('Independence Day','07-04'),
  ('Labor Day','first-monday-september'),
  ('Thanksgiving Day','fourth-thursday-november'),
  ('Christmas Day','12-25')
ON CONFLICT DO NOTHING;

-- ============ PTO adjustments ============
CREATE TABLE IF NOT EXISTS public.pto_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  hours numeric NOT NULL,
  note text,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pto_adjustments TO authenticated;
GRANT ALL ON public.pto_adjustments TO service_role;
ALTER TABLE public.pto_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own pto adjustments" ON public.pto_adjustments
  FOR SELECT TO authenticated
  USING (employee_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));
CREATE POLICY "Managers manage pto adjustments" ON public.pto_adjustments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));
CREATE TRIGGER update_pto_adjustments_updated_at BEFORE UPDATE ON public.pto_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ helpers ============
CREATE OR REPLACE FUNCTION public.time_off_department(_job_title text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN _job_title IN ('Janitorial Staff','Janitorial Manager','Floaters','Night Manager') THEN 'janitorial'
    WHEN _job_title IN ('Project Worker','Project Crew Lead') THEN 'project'
    WHEN _job_title IN ('Owner','Office Manager','Operations Manager') THEN 'management'
    ELSE 'other'
  END
$$;

CREATE OR REPLACE FUNCTION public.is_pto_manager_title(_job_title text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT _job_title IN ('Owner','Office Manager','Operations Manager','Janitorial Manager','Night Manager','Project Crew Lead','Supply Management')
$$;

-- Auto-approve / capacity check
CREATE OR REPLACE FUNCTION public.time_off_auto_approve()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_dept text;
  v_policy record;
  v_day date;
  v_count integer;
  v_conflict_day date;
  v_conflict_count integer;
BEGIN
  IF NEW.status IS DISTINCT FROM 'pending'::time_off_status THEN
    RETURN NEW;
  END IF;

  SELECT public.time_off_department(p.job_title) INTO v_dept
  FROM public.profiles p WHERE p.id = NEW.employee_id;

  IF v_dept IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_policy FROM public.time_off_policies WHERE department = v_dept;
  IF NOT FOUND OR NOT v_policy.auto_approve THEN
    RETURN NEW;
  END IF;

  v_day := NEW.start_date;
  WHILE v_day <= COALESCE(NEW.end_date, NEW.start_date) LOOP
    SELECT COUNT(*) INTO v_count
    FROM public.time_off_requests r
    JOIN public.profiles p ON p.id = r.employee_id
    WHERE r.status = 'approved'::time_off_status
      AND r.id IS DISTINCT FROM NEW.id
      AND r.employee_id <> NEW.employee_id
      AND public.time_off_department(p.job_title) = v_dept
      AND v_day BETWEEN r.start_date AND COALESCE(r.end_date, r.start_date);

    IF v_count + 1 > v_policy.max_off_per_day THEN
      v_conflict_day := v_day;
      v_conflict_count := v_count;
      EXIT;
    END IF;
    v_day := v_day + 1;
  END LOOP;

  IF v_conflict_day IS NULL THEN
    NEW.status := 'approved'::time_off_status;
    NEW.auto_approved := true;
    NEW.reviewed_at := now();
    NEW.manager_notes := COALESCE(NEW.manager_notes || E'\n','')
      || 'Auto-approved: within the ' || v_policy.max_off_per_day
      || ' per day limit for ' || v_dept || '.';
  ELSE
    NEW.manager_notes := COALESCE(NEW.manager_notes || E'\n','')
      || 'Needs manager override: ' || v_conflict_count || ' of ' || v_policy.max_off_per_day
      || ' ' || v_dept || ' staff already approved off on '
      || to_char(v_conflict_day,'Mon DD, YYYY') || '.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_time_off_zz_auto_approve ON public.time_off_requests;
CREATE TRIGGER trg_time_off_zz_auto_approve
  BEFORE INSERT ON public.time_off_requests
  FOR EACH ROW EXECUTE FUNCTION public.time_off_auto_approve();

-- ============ PTO summary ============
CREATE OR REPLACE FUNCTION public.get_pto_summary(_employee_id uuid, _as_of date DEFAULT CURRENT_DATE)
RETURNS TABLE(
  employee_id uuid,
  hire_date date,
  years_of_service integer,
  eligible boolean,
  weeks numeric,
  avg_weekly_hours numeric,
  entitled_hours numeric,
  used_hours numeric,
  adjustment_hours numeric,
  remaining_hours numeric,
  year_start date,
  year_end date
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_profile record;
  v_years integer;
  v_weeks numeric := 0;
  v_avg numeric := 0;
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

  -- anniversary window
  v_start := (v_profile.hire_date + make_interval(years => v_years))::date;
  v_end := (v_start + interval '1 year - 1 day')::date;

  IF public.is_pto_manager_title(v_profile.job_title) THEN
    v_weeks := COALESCE((SELECT value::numeric FROM public.app_settings WHERE key = 'pto_manager_weeks'), 2);
  ELSE
    SELECT COALESCE(MAX(t.weeks), 0) INTO v_weeks
    FROM public.pto_tiers t WHERE t.years_of_service <= v_years;
  END IF;

  -- average weekly hours over the trailing 52 weeks
  SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600.0), 0) / 52.0
  INTO v_avg
  FROM public.time_entries te
  WHERE te.employee_id = _employee_id
    AND te.clock_out IS NOT NULL
    AND te.clock_in >= (_as_of - interval '52 weeks');

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
    ROUND(CASE WHEN v_years >= 1 THEN v_weeks * v_avg ELSE 0 END, 2),
    ROUND(v_used, 2),
    ROUND(v_adj, 2),
    ROUND(CASE WHEN v_years >= 1 THEN v_weeks * v_avg ELSE 0 END + v_adj - v_used, 2),
    v_start,
    v_end;
END;
$$;

REVOKE ALL ON FUNCTION public.get_pto_summary(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_pto_summary(uuid, date) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.time_off_auto_approve() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.time_off_department(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.time_off_department(text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_pto_manager_title(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_pto_manager_title(text) TO authenticated, service_role;
