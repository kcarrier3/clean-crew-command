-- Helper: who may create/edit estimates
CREATE OR REPLACE FUNCTION public.can_estimate(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id AND ur.role IN ('admin','manager')
  ) OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _user_id
      AND p.job_title IN ('Owner','Office Manager','Operations Manager','Janitorial Manager','Night Manager','Project Crew Lead')
  )
$$;

-- Helper: who may approve estimates / administer estimator settings
CREATE OR REPLACE FUNCTION public.can_approve_estimate(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id AND ur.role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _user_id AND p.job_title = 'Owner'
  )
$$;

REVOKE EXECUTE ON FUNCTION public.can_estimate(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_approve_estimate(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_estimate(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_approve_estimate(uuid) TO authenticated, service_role;

-- 1. Estimator settings (org defaults)
CREATE TABLE public.estimate_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  base_wage numeric NOT NULL DEFAULT 15.00,
  labor_burden_percent numeric NOT NULL DEFAULT 20,
  supply_low numeric NOT NULL DEFAULT 0.40,
  supply_standard numeric NOT NULL DEFAULT 0.55,
  supply_high numeric NOT NULL DEFAULT 0.85,
  default_production_rate integer NOT NULL DEFAULT 3500,
  weeks_per_month numeric NOT NULL DEFAULT 4.33,
  default_overhead_percent numeric NOT NULL DEFAULT 15,
  default_target_margin_percent numeric NOT NULL DEFAULT 25,
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estimate_settings TO authenticated;
GRANT ALL ON public.estimate_settings TO service_role;
ALTER TABLE public.estimate_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Estimators can read settings" ON public.estimate_settings
  FOR SELECT TO authenticated USING (public.can_estimate(auth.uid()));
CREATE POLICY "Owners can insert settings" ON public.estimate_settings
  FOR INSERT TO authenticated WITH CHECK (public.can_approve_estimate(auth.uid()));
CREATE POLICY "Owners can update settings" ON public.estimate_settings
  FOR UPDATE TO authenticated USING (public.can_approve_estimate(auth.uid())) WITH CHECK (public.can_approve_estimate(auth.uid()));
CREATE POLICY "Owners can delete settings" ON public.estimate_settings
  FOR DELETE TO authenticated USING (public.can_approve_estimate(auth.uid()));

CREATE TRIGGER update_estimate_settings_updated_at
  BEFORE UPDATE ON public.estimate_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.estimate_settings DEFAULT VALUES;

-- 2. Production rate lookup
CREATE TABLE public.estimate_production_rates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  building_type text NOT NULL DEFAULT 'General',
  area_type text NOT NULL DEFAULT 'Open floor',
  sqft_per_hour integer NOT NULL DEFAULT 3500,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estimate_production_rates TO authenticated;
GRANT ALL ON public.estimate_production_rates TO service_role;
ALTER TABLE public.estimate_production_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Estimators can read production rates" ON public.estimate_production_rates
  FOR SELECT TO authenticated USING (public.can_estimate(auth.uid()));
CREATE POLICY "Owners can manage production rates" ON public.estimate_production_rates
  FOR ALL TO authenticated USING (public.can_approve_estimate(auth.uid())) WITH CHECK (public.can_approve_estimate(auth.uid()));

CREATE TRIGGER update_estimate_production_rates_updated_at
  BEFORE UPDATE ON public.estimate_production_rates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.estimate_production_rates (building_type, area_type, sqft_per_hour) VALUES
  ('General', 'Open floor', 3500),
  ('Office', 'Open floor', 3800),
  ('Office', 'Private offices', 2800),
  ('Medical', 'Open floor', 2500),
  ('Medical', 'Exam rooms', 1800),
  ('Retail', 'Sales floor', 4500),
  ('Industrial / Warehouse', 'Warehouse floor', 6000),
  ('School', 'Classrooms', 3000),
  ('Bank / Financial', 'Open floor', 3200),
  ('Church', 'Sanctuary', 4000),
  ('Restaurant', 'Dining', 2200),
  ('General', 'Restrooms', 900),
  ('General', 'Hard floor', 4000),
  ('General', 'Carpet', 4500);

-- 3. Estimates header
CREATE TABLE public.estimates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  company_id uuid REFERENCES public.crm_companies(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  job_site_id uuid REFERENCES public.job_sites(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft',
  current_revision_id uuid,
  owner_id uuid,
  created_by uuid,
  approved_by uuid,
  approved_at timestamp with time zone,
  rejection_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estimates TO authenticated;
GRANT ALL ON public.estimates TO service_role;
ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Estimators can view estimates" ON public.estimates
  FOR SELECT TO authenticated
  USING (public.can_estimate(auth.uid()) OR created_by = auth.uid() OR owner_id = auth.uid());
CREATE POLICY "Estimators can create estimates" ON public.estimates
  FOR INSERT TO authenticated WITH CHECK (public.can_estimate(auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Estimators can update estimates" ON public.estimates
  FOR UPDATE TO authenticated
  USING (public.can_estimate(auth.uid()) OR created_by = auth.uid())
  WITH CHECK (public.can_estimate(auth.uid()) OR created_by = auth.uid());
CREATE POLICY "Owners can delete estimates" ON public.estimates
  FOR DELETE TO authenticated USING (public.can_approve_estimate(auth.uid()));

CREATE TRIGGER update_estimates_updated_at
  BEFORE UPDATE ON public.estimates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_estimates_company ON public.estimates(company_id);
CREATE INDEX idx_estimates_lead ON public.estimates(lead_id);
CREATE INDEX idx_estimates_status ON public.estimates(status);

-- Guard: only approvers may set approval fields
CREATE OR REPLACE FUNCTION public.enforce_estimate_approval_rights()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.status IN ('approved','rejected') AND COALESCE(OLD.status,'') IS DISTINCT FROM NEW.status)
     OR (NEW.approved_by IS DISTINCT FROM OLD.approved_by)
     OR (NEW.approved_at IS DISTINCT FROM OLD.approved_at) THEN
    IF NOT public.can_approve_estimate(auth.uid()) THEN
      RAISE EXCEPTION 'Only an owner or admin can approve or reject an estimate';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_estimate_approval
  BEFORE UPDATE ON public.estimates
  FOR EACH ROW EXECUTE FUNCTION public.enforce_estimate_approval_rights();

-- 4. Estimate revisions (immutable snapshots)
CREATE TABLE public.estimate_revisions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  estimate_id uuid NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  revision_number integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft',
  -- inputs
  square_feet numeric NOT NULL DEFAULT 0,
  building_type text,
  cleanings_per_week numeric NOT NULL DEFAULT 5,
  weeks_per_month numeric NOT NULL DEFAULT 4.33,
  production_rate_sqft_hour numeric NOT NULL DEFAULT 3500,
  restroom_count integer NOT NULL DEFAULT 0,
  fixture_count integer NOT NULL DEFAULT 0,
  floor_mix jsonb NOT NULL DEFAULT '{}'::jsonb,
  occupancy_level text,
  traffic_level text,
  service_window text NOT NULL DEFAULT 'night',
  day_porter_hours_per_week numeric NOT NULL DEFAULT 0,
  windows_hours_per_month numeric NOT NULL DEFAULT 0,
  periodic_floor_care jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- rates snapshot
  base_wage numeric NOT NULL DEFAULT 15.00,
  labor_burden_percent numeric NOT NULL DEFAULT 20,
  supply_rate_per_hour numeric NOT NULL DEFAULT 0.55,
  supply_preset text NOT NULL DEFAULT 'standard',
  overhead_percent numeric NOT NULL DEFAULT 15,
  target_margin_percent numeric NOT NULL DEFAULT 25,
  pricing_mode text NOT NULL DEFAULT 'margin',
  -- outputs snapshot
  labor_hours_per_visit numeric NOT NULL DEFAULT 0,
  monthly_labor_hours numeric NOT NULL DEFAULT 0,
  loaded_labor_rate numeric NOT NULL DEFAULT 0,
  monthly_labor_cost numeric NOT NULL DEFAULT 0,
  monthly_supply_cost numeric NOT NULL DEFAULT 0,
  total_direct_cost numeric NOT NULL DEFAULT 0,
  overhead_amount numeric NOT NULL DEFAULT 0,
  price_per_visit numeric NOT NULL DEFAULT 0,
  monthly_price numeric NOT NULL DEFAULT 0,
  annual_price numeric NOT NULL DEFAULT 0,
  price_per_sqft numeric NOT NULL DEFAULT 0,
  gross_margin_percent numeric NOT NULL DEFAULT 0,
  markup_percent numeric NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (estimate_id, revision_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estimate_revisions TO authenticated;
GRANT ALL ON public.estimate_revisions TO service_role;
ALTER TABLE public.estimate_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Estimators can view revisions" ON public.estimate_revisions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.estimates e WHERE e.id = estimate_id
    AND (public.can_estimate(auth.uid()) OR e.created_by = auth.uid() OR e.owner_id = auth.uid())));
CREATE POLICY "Estimators can create revisions" ON public.estimate_revisions
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.estimates e WHERE e.id = estimate_id
    AND (public.can_estimate(auth.uid()) OR e.created_by = auth.uid())));
CREATE POLICY "Estimators can update revisions" ON public.estimate_revisions
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.estimates e WHERE e.id = estimate_id
    AND (public.can_estimate(auth.uid()) OR e.created_by = auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.estimates e WHERE e.id = estimate_id
    AND (public.can_estimate(auth.uid()) OR e.created_by = auth.uid())));
CREATE POLICY "Owners can delete revisions" ON public.estimate_revisions
  FOR DELETE TO authenticated USING (public.can_approve_estimate(auth.uid()));

CREATE TRIGGER update_estimate_revisions_updated_at
  BEFORE UPDATE ON public.estimate_revisions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_estimate_revisions_estimate ON public.estimate_revisions(estimate_id);

ALTER TABLE public.estimates
  ADD CONSTRAINT estimates_current_revision_fk
  FOREIGN KEY (current_revision_id) REFERENCES public.estimate_revisions(id) ON DELETE SET NULL;

-- 5. Adders
CREATE TABLE public.estimate_line_adders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  revision_id uuid NOT NULL REFERENCES public.estimate_revisions(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'custom',
  description text NOT NULL,
  hours numeric NOT NULL DEFAULT 0,
  cost numeric NOT NULL DEFAULT 0,
  price numeric NOT NULL DEFAULT 0,
  frequency text NOT NULL DEFAULT 'monthly',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estimate_line_adders TO authenticated;
GRANT ALL ON public.estimate_line_adders TO service_role;
ALTER TABLE public.estimate_line_adders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Estimators can view adders" ON public.estimate_line_adders
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.estimate_revisions r JOIN public.estimates e ON e.id = r.estimate_id
    WHERE r.id = revision_id AND (public.can_estimate(auth.uid()) OR e.created_by = auth.uid() OR e.owner_id = auth.uid())));
CREATE POLICY "Estimators can manage adders" ON public.estimate_line_adders
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.estimate_revisions r JOIN public.estimates e ON e.id = r.estimate_id
    WHERE r.id = revision_id AND (public.can_estimate(auth.uid()) OR e.created_by = auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.estimate_revisions r JOIN public.estimates e ON e.id = r.estimate_id
    WHERE r.id = revision_id AND (public.can_estimate(auth.uid()) OR e.created_by = auth.uid())));

CREATE TRIGGER update_estimate_line_adders_updated_at
  BEFORE UPDATE ON public.estimate_line_adders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_estimate_line_adders_revision ON public.estimate_line_adders(revision_id);