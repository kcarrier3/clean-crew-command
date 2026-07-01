
CREATE TABLE public.fixed_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  asset_tag TEXT UNIQUE,
  category TEXT,
  serial_number TEXT,
  condition TEXT NOT NULL DEFAULT 'good',
  quantity NUMERIC NOT NULL DEFAULT 1,
  purchase_date DATE,
  purchase_cost NUMERIC,
  location_kind TEXT NOT NULL DEFAULT 'warehouse',
  job_site_id UUID REFERENCES public.job_sites(id) ON DELETE SET NULL,
  supply_location_id UUID REFERENCES public.supply_locations(id) ON DELETE SET NULL,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  retired_at TIMESTAMPTZ,
  retired_reason TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fixed_assets TO authenticated;
GRANT ALL ON public.fixed_assets TO service_role;

ALTER TABLE public.fixed_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers manage fixed assets"
  ON public.fixed_assets
  FOR ALL
  TO authenticated
  USING (public.is_supply_manager(auth.uid()))
  WITH CHECK (public.is_supply_manager(auth.uid()));

CREATE POLICY "Employees view assets at their assigned accounts"
  ON public.fixed_assets
  FOR SELECT
  TO authenticated
  USING (
    job_site_id IS NOT NULL
    AND public.can_access_job_site_sensitive_info(auth.uid(), job_site_id)
  );

CREATE TRIGGER update_fixed_assets_updated_at
  BEFORE UPDATE ON public.fixed_assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_fixed_assets_job_site ON public.fixed_assets(job_site_id);
CREATE INDEX idx_fixed_assets_active ON public.fixed_assets(active);
