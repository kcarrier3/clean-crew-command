-- Remove leftover demo employee records (no linked account, no schedules/time data)
DELETE FROM public.employees WHERE user_id IS NULL;

-- Repoint child tables from the legacy employees table to the real roster (profiles)
ALTER TABLE public.employee_schedules DROP CONSTRAINT IF EXISTS employee_schedules_employee_id_fkey;
ALTER TABLE public.employee_schedules
  ADD CONSTRAINT employee_schedules_employee_id_fkey
  FOREIGN KEY (employee_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.time_entries DROP CONSTRAINT IF EXISTS time_entries_employee_id_fkey;
ALTER TABLE public.time_entries
  ADD CONSTRAINT time_entries_employee_id_fkey
  FOREIGN KEY (employee_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.attendance_points DROP CONSTRAINT IF EXISTS attendance_points_employee_id_fkey;
ALTER TABLE public.attendance_points
  ADD CONSTRAINT attendance_points_employee_id_fkey
  FOREIGN KEY (employee_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.shift_call_offs DROP CONSTRAINT IF EXISTS shift_call_offs_employee_id_fkey;
ALTER TABLE public.shift_call_offs
  ADD CONSTRAINT shift_call_offs_employee_id_fkey
  FOREIGN KEY (employee_id) REFERENCES public.profiles(id) ON DELETE CASCADE;