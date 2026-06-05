-- Migration: Departments, manager assignments, and geofencing controls
-- 1. Create departments table
-- 2. Create department_managers junction table (many-to-many)
-- 3. Create department_employees junction table (many-to-many)
-- 4. Add company-wide geofencing setting to app_settings
-- 5. Add missed_punch_notifications table
-- 6. RLS policies for all new tables

-- ============================================================
-- 1. Departments table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  color text DEFAULT '#6366f1',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- Managers and admins can view all departments
CREATE POLICY "Authenticated users can view departments"
  ON public.departments FOR SELECT
  TO authenticated
  USING (true);

-- Only admins/owners can create/update/delete departments
CREATE POLICY "Admins can manage departments"
  ON public.departments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- ============================================================
-- 2. Department managers junction table (many-to-many)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.department_managers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  manager_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(department_id, manager_id)
);

ALTER TABLE public.department_managers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view department managers"
  ON public.department_managers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage department managers"
  ON public.department_managers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- ============================================================
-- 3. Department employees junction table (many-to-many)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.department_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(department_id, employee_id)
);

ALTER TABLE public.department_employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view department employees"
  ON public.department_employees FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and managers can manage department employees"
  ON public.department_employees FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- ============================================================
-- 4. App settings table (for company-wide toggles)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id)
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read settings
CREATE POLICY "Authenticated users can view app settings"
  ON public.app_settings FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can change settings
CREATE POLICY "Admins can manage app settings"
  ON public.app_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Insert default settings
INSERT INTO public.app_settings (key, value, description)
VALUES
  ('geofencing_enabled', 'true', 'Company-wide geofencing toggle. When false, geofencing is disabled for all employees regardless of individual settings.'),
  ('missed_punch_grace_minutes', '15', 'Number of minutes after scheduled start time before a missed punch notification is sent to managers.'),
  ('late_punch_grace_minutes', '5', 'Number of minutes of grace period before an employee is considered late.')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 5. Missed punch notifications table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.missed_punch_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  schedule_id uuid REFERENCES public.employee_schedules(id) ON DELETE SET NULL,
  scheduled_start_time timestamptz NOT NULL,
  notification_sent_at timestamptz NOT NULL DEFAULT now(),
  notification_type text NOT NULL DEFAULT 'missed_punch', -- 'missed_punch' | 'late_punch'
  minutes_late integer,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.profiles(id),
  notes text
);

ALTER TABLE public.missed_punch_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view missed punch notifications"
  ON public.missed_punch_notifications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "System can insert missed punch notifications"
  ON public.missed_punch_notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Managers can update missed punch notifications"
  ON public.missed_punch_notifications FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- ============================================================
-- 6. Add manager_override column to time_entries
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'time_entries'
    AND column_name = 'manager_override'
  ) THEN
    ALTER TABLE public.time_entries
    ADD COLUMN manager_override boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'time_entries'
    AND column_name = 'override_by'
  ) THEN
    ALTER TABLE public.time_entries
    ADD COLUMN override_by uuid REFERENCES public.profiles(id);
  END IF;
END $$;

-- ============================================================
-- 7. Function: get_employee_department_managers
-- Returns manager profile IDs for a given employee's departments
-- Used by notification system to route alerts to correct managers
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_employee_department_managers(p_employee_id uuid)
RETURNS TABLE(manager_id uuid, manager_email text, manager_first_name text, manager_last_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    p.id AS manager_id,
    p.email AS manager_email,
    p.first_name AS manager_first_name,
    p.last_name AS manager_last_name
  FROM public.department_employees de
  JOIN public.department_managers dm ON dm.department_id = de.department_id
  JOIN public.profiles p ON p.id = dm.manager_id
  WHERE de.employee_id = p_employee_id
    AND p.active = true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_employee_department_managers(uuid) TO authenticated;

-- ============================================================
-- 8. Updated timestamps trigger for departments
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_departments_updated_at'
  ) THEN
    CREATE TRIGGER set_departments_updated_at
      BEFORE UPDATE ON public.departments
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;
