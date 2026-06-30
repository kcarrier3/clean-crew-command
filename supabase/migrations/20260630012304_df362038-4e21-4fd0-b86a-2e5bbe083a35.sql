-- Enum for draft kinds
DO $$ BEGIN
  CREATE TYPE public.calendar_draft_kind AS ENUM ('shift_draft', 'event', 'holiday', 'note');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Table
CREATE TABLE public.calendar_drafts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  notes text,
  kind public.calendar_draft_kind NOT NULL DEFAULT 'shift_draft',
  start_at timestamptz NOT NULL,
  end_at timestamptz,
  all_day boolean NOT NULL DEFAULT false,
  employee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  job_site_id uuid REFERENCES public.job_sites(id) ON DELETE SET NULL,
  color text,
  promoted_schedule_id uuid REFERENCES public.employee_schedules(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_calendar_drafts_start_at ON public.calendar_drafts (start_at);
CREATE INDEX idx_calendar_drafts_employee ON public.calendar_drafts (employee_id);
CREATE INDEX idx_calendar_drafts_job_site ON public.calendar_drafts (job_site_id);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_drafts TO authenticated;
GRANT ALL ON public.calendar_drafts TO service_role;

-- RLS
ALTER TABLE public.calendar_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers and admins can view calendar drafts"
ON public.calendar_drafts
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'manager'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Managers and admins can insert calendar drafts"
ON public.calendar_drafts
FOR INSERT
TO authenticated
WITH CHECK (
  (public.has_role(auth.uid(), 'manager'::app_role)
   OR public.has_role(auth.uid(), 'admin'::app_role))
  AND created_by = auth.uid()
);

CREATE POLICY "Managers and admins can update calendar drafts"
ON public.calendar_drafts
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'manager'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'manager'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Managers and admins can delete calendar drafts"
ON public.calendar_drafts
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'manager'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- updated_at trigger (reuses existing helper)
CREATE TRIGGER update_calendar_drafts_updated_at
BEFORE UPDATE ON public.calendar_drafts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();