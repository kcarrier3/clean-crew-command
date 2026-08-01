ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'publish_schedules';

CREATE TABLE IF NOT EXISTS public.schedule_weeks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date NOT NULL UNIQUE,
  published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  published_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.schedule_weeks TO authenticated;
GRANT ALL ON public.schedule_weeks TO service_role;

ALTER TABLE public.schedule_weeks ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_publish_schedules(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN public.has_role(_user_id, 'admin'::app_role)
      OR public.has_permission(_user_id, 'publish_schedules'::app_permission);
END;
$$;

REVOKE ALL ON FUNCTION public.can_publish_schedules(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_publish_schedules(uuid) TO authenticated, service_role;

CREATE POLICY "Authenticated users can view schedule weeks"
ON public.schedule_weeks FOR SELECT TO authenticated USING (true);

CREATE POLICY "Publishers can create schedule weeks"
ON public.schedule_weeks FOR INSERT TO authenticated
WITH CHECK (public.can_publish_schedules(auth.uid()));

CREATE POLICY "Publishers can update schedule weeks"
ON public.schedule_weeks FOR UPDATE TO authenticated
USING (public.can_publish_schedules(auth.uid()))
WITH CHECK (public.can_publish_schedules(auth.uid()));

CREATE TRIGGER update_schedule_weeks_updated_at
BEFORE UPDATE ON public.schedule_weeks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();