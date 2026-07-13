
CREATE TABLE public.employee_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_site_id uuid NOT NULL REFERENCES public.job_sites(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, job_site_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_accounts TO authenticated;
GRANT ALL ON public.employee_accounts TO service_role;

ALTER TABLE public.employee_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers and admins can view employee accounts"
  ON public.employee_accounts FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR employee_id = auth.uid()
  );

CREATE POLICY "Managers and admins can manage employee accounts"
  ON public.employee_accounts FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  );

CREATE INDEX idx_employee_accounts_employee ON public.employee_accounts(employee_id);
CREATE INDEX idx_employee_accounts_job_site ON public.employee_accounts(job_site_id);
