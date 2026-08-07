-- 1. ADP identifiers on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS adp_file_number text,
  ADD COLUMN IF NOT EXISTS adp_department_code text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_adp_file_number_key
  ON public.profiles (adp_file_number) WHERE adp_file_number IS NOT NULL;

-- 2. Job/location payroll attributes on job_sites
ALTER TABLE public.job_sites
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS tax_jurisdiction text,
  ADD COLUMN IF NOT EXISTS job_cost_code text,
  ADD COLUMN IF NOT EXISTS location_code text;

-- 3. Payroll role helper
CREATE OR REPLACE FUNCTION public.can_run_payroll(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.has_role(_user_id, 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = _user_id
          AND p.job_title IN ('Owner','Office Manager','Operations Manager')
      );
$$;

-- 4. Finalized payroll export batches (snapshot mechanism)
CREATE TABLE IF NOT EXISTS public.payroll_export_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start date NOT NULL,
  period_end date NOT NULL,
  exported_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  exported_at timestamptz NOT NULL DEFAULT now(),
  row_count integer NOT NULL DEFAULT 0,
  total_hours numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_export_batches TO authenticated;
GRANT ALL ON public.payroll_export_batches TO service_role;
ALTER TABLE public.payroll_export_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Payroll staff manage export batches"
ON public.payroll_export_batches FOR ALL TO authenticated
USING (public.can_run_payroll(auth.uid()))
WITH CHECK (public.can_run_payroll(auth.uid()));

CREATE TRIGGER update_payroll_export_batches_updated_at
BEFORE UPDATE ON public.payroll_export_batches
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Immutable snapshot rows
CREATE TABLE IF NOT EXISTS public.payroll_export_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.payroll_export_batches(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  crew_compass_employee_code text,
  adp_file_number text,
  employee_name text NOT NULL,
  work_date date NOT NULL,
  earnings_code text NOT NULL DEFAULT 'REG',
  regular_hours numeric NOT NULL DEFAULT 0,
  overtime_hours numeric NOT NULL DEFAULT 0,
  total_hours numeric NOT NULL DEFAULT 0,
  hourly_rate numeric,
  job_site_id uuid REFERENCES public.job_sites(id) ON DELETE SET NULL,
  job_name text,
  job_cost_code text,
  city text,
  state text,
  tax_jurisdiction text,
  location_code text,
  department_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payroll_export_rows_batch_idx ON public.payroll_export_rows (batch_id);

GRANT SELECT, INSERT ON public.payroll_export_rows TO authenticated;
GRANT ALL ON public.payroll_export_rows TO service_role;
ALTER TABLE public.payroll_export_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Payroll staff read export rows"
ON public.payroll_export_rows FOR SELECT TO authenticated
USING (public.can_run_payroll(auth.uid()));

CREATE POLICY "Payroll staff create export rows"
ON public.payroll_export_rows FOR INSERT TO authenticated
WITH CHECK (public.can_run_payroll(auth.uid()));

-- 6. ADP CSV column mapping settings
CREATE TABLE IF NOT EXISTS public.adp_export_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  columns jsonb NOT NULL DEFAULT '[]'::jsonb,
  regular_code text NOT NULL DEFAULT 'REG',
  overtime_code text NOT NULL DEFAULT 'OT',
  date_format text NOT NULL DEFAULT 'MM/DD/YYYY',
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.adp_export_settings TO authenticated;
GRANT ALL ON public.adp_export_settings TO service_role;
ALTER TABLE public.adp_export_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Payroll staff read adp settings"
ON public.adp_export_settings FOR SELECT TO authenticated
USING (public.can_run_payroll(auth.uid()));

CREATE POLICY "Payroll staff write adp settings"
ON public.adp_export_settings FOR INSERT TO authenticated
WITH CHECK (public.can_run_payroll(auth.uid()));

CREATE POLICY "Payroll staff update adp settings"
ON public.adp_export_settings FOR UPDATE TO authenticated
USING (public.can_run_payroll(auth.uid()))
WITH CHECK (public.can_run_payroll(auth.uid()));

CREATE TRIGGER update_adp_export_settings_updated_at
BEFORE UPDATE ON public.adp_export_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.adp_export_settings (singleton) VALUES (true)
ON CONFLICT (singleton) DO NOTHING;