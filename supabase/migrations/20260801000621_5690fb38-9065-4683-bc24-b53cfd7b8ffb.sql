ALTER TABLE public.attendance_points DROP CONSTRAINT attendance_points_employee_id_fkey;
ALTER TABLE public.attendance_points ADD CONSTRAINT attendance_points_employee_id_fkey
  FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;

ALTER TABLE public.shift_call_offs DROP CONSTRAINT shift_call_offs_employee_id_fkey;
ALTER TABLE public.shift_call_offs ADD CONSTRAINT shift_call_offs_employee_id_fkey
  FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;

DROP POLICY "Employees view own attendance points" ON public.attendance_points;
CREATE POLICY "Employees view own attendance points"
ON public.attendance_points FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.employees e WHERE e.id = attendance_points.employee_id AND e.user_id = auth.uid()));

DROP POLICY "Employees view own call offs" ON public.shift_call_offs;
CREATE POLICY "Employees view own call offs"
ON public.shift_call_offs FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.employees e WHERE e.id = shift_call_offs.employee_id AND e.user_id = auth.uid()));