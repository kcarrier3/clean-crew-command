
-- Assignment table
CREATE TABLE public.company_contact_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.company_contacts(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (contact_id, employee_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_contact_assignments TO authenticated;
GRANT ALL ON public.company_contact_assignments TO service_role;

ALTER TABLE public.company_contact_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees can view their own assignments"
  ON public.company_contact_assignments FOR SELECT
  TO authenticated
  USING (
    employee_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  );

CREATE POLICY "Managers and admins can manage assignments"
  ON public.company_contact_assignments FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

CREATE INDEX company_contact_assignments_employee_idx
  ON public.company_contact_assignments(employee_id);
CREATE INDEX company_contact_assignments_contact_idx
  ON public.company_contact_assignments(contact_id);

-- Replace the admin-only SELECT policy so non-managers see contacts assigned to them
DROP POLICY IF EXISTS "Managers and admins can view company contacts" ON public.company_contacts;
CREATE POLICY "View company contacts (managers see all, staff see assigned)"
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
  );
