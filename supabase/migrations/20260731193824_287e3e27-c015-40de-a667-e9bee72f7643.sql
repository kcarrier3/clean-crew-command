CREATE TABLE public.attendance_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  schedule_id uuid REFERENCES public.employee_schedules(id) ON DELETE SET NULL,
  occurred_on date NOT NULL,
  point_type text NOT NULL CHECK (point_type IN ('call_off','missed_punch','late_punch','manual')),
  points numeric NOT NULL DEFAULT 0,
  notes text,
  recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_attendance_points_emp_date ON public.attendance_points (employee_id, occurred_on);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_points TO authenticated;
GRANT ALL ON public.attendance_points TO service_role;
ALTER TABLE public.attendance_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers manage attendance points"
ON public.attendance_points FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role))
WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));

CREATE POLICY "Employees view own attendance points"
ON public.attendance_points FOR SELECT TO authenticated
USING (employee_id = auth.uid());

CREATE TRIGGER trg_attendance_points_updated_at
BEFORE UPDATE ON public.attendance_points
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.shift_call_offs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.employee_schedules(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  call_off_date date NOT NULL,
  reason text,
  recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  point_id uuid REFERENCES public.attendance_points(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (schedule_id, call_off_date)
);

CREATE INDEX idx_shift_call_offs_date ON public.shift_call_offs (call_off_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_call_offs TO authenticated;
GRANT ALL ON public.shift_call_offs TO service_role;
ALTER TABLE public.shift_call_offs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers manage call offs"
ON public.shift_call_offs FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role))
WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));

CREATE POLICY "Employees view own call offs"
ON public.shift_call_offs FOR SELECT TO authenticated
USING (employee_id = auth.uid());

CREATE TRIGGER trg_shift_call_offs_updated_at
BEFORE UPDATE ON public.shift_call_offs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();