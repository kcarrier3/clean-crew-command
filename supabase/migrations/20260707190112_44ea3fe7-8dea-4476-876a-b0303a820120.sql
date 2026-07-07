
-- Porter assignments per job site
CREATE TABLE public.porter_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_site_id uuid NOT NULL REFERENCES public.job_sites(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_site_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.porter_assignments TO authenticated;
GRANT ALL ON public.porter_assignments TO service_role;
ALTER TABLE public.porter_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers manage porter assignments"
  ON public.porter_assignments FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Porters can view their assignments"
  ON public.porter_assignments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER porter_assignments_updated_at
  BEFORE UPDATE ON public.porter_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Porter reports (submitted via QR scan, anonymous allowed)
CREATE TABLE public.porter_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_site_id uuid NOT NULL REFERENCES public.job_sites(id) ON DELETE CASCADE,
  area_label text,
  issue_type text NOT NULL CHECK (issue_type IN ('cleaning','supply','other')),
  description text NOT NULL,
  reporter_name text,
  reporter_contact text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')),
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  resolved_by uuid,
  resolved_at timestamptz,
  notes_from_porter text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.porter_reports TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.porter_reports TO authenticated;
GRANT ALL ON public.porter_reports TO service_role;
ALTER TABLE public.porter_reports ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous QR scanners) may submit a report
CREATE POLICY "Public can submit porter reports"
  ON public.porter_reports FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only assigned porters + managers can read
CREATE POLICY "Managers view all porter reports"
  ON public.porter_reports FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Assigned porters view their reports"
  ON public.porter_reports FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.porter_assignments pa
    WHERE pa.job_site_id = porter_reports.job_site_id
      AND pa.user_id = auth.uid()
      AND pa.active = true
  ));

CREATE POLICY "Managers update porter reports"
  ON public.porter_reports FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Assigned porters update their reports"
  ON public.porter_reports FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.porter_assignments pa
    WHERE pa.job_site_id = porter_reports.job_site_id
      AND pa.user_id = auth.uid()
      AND pa.active = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.porter_assignments pa
    WHERE pa.job_site_id = porter_reports.job_site_id
      AND pa.user_id = auth.uid()
      AND pa.active = true
  ));

CREATE TRIGGER porter_reports_updated_at
  BEFORE UPDATE ON public.porter_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Public read for job_sites minimal info at the QR page (name only). Instead of loosening job_sites RLS,
-- create a security-definer helper to expose only name for a given id.
CREATE OR REPLACE FUNCTION public.get_job_site_public_name(_job_site_id uuid)
RETURNS TABLE(id uuid, name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name FROM public.job_sites WHERE id = _job_site_id AND active = true;
$$;
REVOKE EXECUTE ON FUNCTION public.get_job_site_public_name(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_job_site_public_name(uuid) TO anon, authenticated;

-- Realtime for porter_reports so managers/porters see live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.porter_reports;
