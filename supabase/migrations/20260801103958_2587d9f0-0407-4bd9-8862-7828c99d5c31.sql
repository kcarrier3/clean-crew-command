ALTER TABLE public.employee_schedules
  ADD COLUMN IF NOT EXISTS week_interval integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS recurrence_anchor_date date;

UPDATE public.employee_schedules SET recurrence_anchor_date = start_date WHERE recurrence_anchor_date IS NULL;