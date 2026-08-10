ALTER TABLE public.job_sites
  ADD COLUMN IF NOT EXISTS is_phased boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS completion_status text NOT NULL DEFAULT 'in_progress',
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by uuid,
  ADD COLUMN IF NOT EXISTS completion_notes text,
  ADD COLUMN IF NOT EXISTS billing_acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS billing_acknowledged_by uuid;

CREATE TABLE IF NOT EXISTS public.project_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_site_id uuid NOT NULL REFERENCES public.job_sites(id) ON DELETE CASCADE,
  name text NOT NULL,
  sequence integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'in_progress',
  completed_at timestamptz,
  completed_by uuid,
  completion_notes text,
  billing_acknowledged_at timestamptz,
  billing_acknowledged_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_phases TO authenticated;
GRANT ALL ON public.project_phases TO service_role;

ALTER TABLE public.project_phases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view project phases"
  ON public.project_phases FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers can update project phases"
  ON public.project_phases FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Managers can create project phases"
  ON public.project_phases FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Managers can delete project phases"
  ON public.project_phases FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TRIGGER update_project_phases_updated_at
  BEFORE UPDATE ON public.project_phases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_project_phases_job_site ON public.project_phases(job_site_id, sequence);