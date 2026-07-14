
-- 1. Category column on company_contacts
ALTER TABLE public.company_contacts
  ADD COLUMN IF NOT EXISTS category text;

-- 2. Rules table
CREATE TABLE public.directory_access_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_job_title text NOT NULL,
  visible_category text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (viewer_job_title, visible_category)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.directory_access_rules TO authenticated;
GRANT ALL ON public.directory_access_rules TO service_role;

ALTER TABLE public.directory_access_rules ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read the rules that affect them; but to keep this simple and
-- because rules themselves are not sensitive (they don't include contact data), allow all
-- authenticated to read. Only managers/admins can modify.
CREATE POLICY "Authenticated can view directory rules"
  ON public.directory_access_rules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers and admins can manage directory rules"
  ON public.directory_access_rules FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

-- 3. Update SELECT policy on company_contacts to include rule-based visibility
DROP POLICY IF EXISTS "View company contacts (managers see all, staff see assigned)" ON public.company_contacts;
CREATE POLICY "View company contacts (managers see all, rules + assignments for staff)"
  ON public.company_contacts FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.company_contact_assignments a
      WHERE a.contact_id = public.company_contacts.id
        AND a.employee_id = auth.uid()
    )
    OR (
      public.company_contacts.category IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.directory_access_rules r
        JOIN public.profiles p ON p.job_title = r.viewer_job_title
        WHERE p.id = auth.uid()
          AND r.visible_category = public.company_contacts.category
      )
    )
  );

-- 4. Seed the default rules the user specified
INSERT INTO public.directory_access_rules (viewer_job_title, visible_category) VALUES
  ('Janitorial Staff',   'supply_manager'),
  ('Janitorial Staff',   'night_manager'),
  ('Janitorial Staff',   'office_manager'),
  ('Project Worker',     'construction_manager'),
  ('Project Worker',     'office_manager'),
  ('Project Crew Lead',  'construction_manager'),
  ('Project Crew Lead',  'office_manager'),
  ('Project Crew Lead',  'supply_manager'),
  ('Project Crew Lead',  'construction_staff'),
  ('Janitorial Manager', 'janitorial_staff'),
  ('Janitorial Manager', 'supply_manager'),
  ('Janitorial Manager', 'office_manager'),
  ('Floaters',           'janitorial_manager'),
  ('Floaters',           'office_manager'),
  ('Floaters',           'supply_manager')
ON CONFLICT (viewer_job_title, visible_category) DO NOTHING;
