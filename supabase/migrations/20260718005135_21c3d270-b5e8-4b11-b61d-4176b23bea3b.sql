
CREATE TABLE public.excused_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES public.employee_schedules(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL,
  excused_date DATE NOT NULL,
  reason TEXT,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, excused_date, schedule_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.excused_shifts TO authenticated;
GRANT ALL ON public.excused_shifts TO service_role;

ALTER TABLE public.excused_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers manage excused shifts"
  ON public.excused_shifts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Employees view own excused shifts"
  ON public.excused_shifts FOR SELECT TO authenticated
  USING (employee_id = auth.uid());

CREATE INDEX excused_shifts_emp_date_idx ON public.excused_shifts(employee_id, excused_date);

CREATE TRIGGER excused_shifts_updated_at
  BEFORE UPDATE ON public.excused_shifts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
