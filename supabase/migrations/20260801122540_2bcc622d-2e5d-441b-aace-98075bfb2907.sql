ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS schedule_id uuid REFERENCES public.employee_schedules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scheduled_start timestamp with time zone,
  ADD COLUMN IF NOT EXISTS scheduled_end timestamp with time zone,
  ADD COLUMN IF NOT EXISTS exceeded_scheduled boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS time_entries_schedule_id_idx ON public.time_entries(schedule_id);