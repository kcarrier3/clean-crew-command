-- A) Direct Waypoint deal (opportunity) linkage, additive alongside crm_lead_id
ALTER TABLE public.billing_invoices
  ADD COLUMN IF NOT EXISTS crm_deal_id uuid REFERENCES public.crm_deals(id) ON DELETE SET NULL;
ALTER TABLE public.billing_events
  ADD COLUMN IF NOT EXISTS crm_deal_id uuid REFERENCES public.crm_deals(id) ON DELETE SET NULL;
ALTER TABLE public.job_sites
  ADD COLUMN IF NOT EXISTS crm_deal_id uuid REFERENCES public.crm_deals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_billing_invoices_crm_deal ON public.billing_invoices(crm_deal_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_crm_deal ON public.billing_events(crm_deal_id);
CREATE INDEX IF NOT EXISTS idx_job_sites_crm_deal ON public.job_sites(crm_deal_id);

-- B) Recurring invoicing support on invoices
ALTER TABLE public.billing_invoices
  ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurring_period_start date,
  ADD COLUMN IF NOT EXISTS recurring_period_end date;

-- one live invoice per account per billing period
CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_invoice_recurring_period
  ON public.billing_invoices(job_site_id, recurring_period_start)
  WHERE recurring_period_start IS NOT NULL AND status <> 'void';

-- C) Recurring billing schedules
CREATE TABLE IF NOT EXISTS public.recurring_billing_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_site_id uuid NOT NULL UNIQUE REFERENCES public.job_sites(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  amount numeric NOT NULL DEFAULT 0,
  frequency text NOT NULL DEFAULT 'monthly'
    CHECK (frequency IN ('monthly','quarterly','semiannual','annual')),
  billing_day_rule text NOT NULL DEFAULT 'day_of_month'
    CHECK (billing_day_rule IN ('day_of_month','last_day')),
  billing_day smallint NOT NULL DEFAULT 1 CHECK (billing_day BETWEEN 1 AND 28),
  service_period text NOT NULL DEFAULT 'current'
    CHECK (service_period IN ('current','prior')),
  payment_terms text DEFAULT 'Net 30',
  po_number text,
  po_required boolean NOT NULL DEFAULT false,
  billing_contact_name text,
  billing_email text,
  tax_rate numeric NOT NULL DEFAULT 0,
  invoice_description text DEFAULT 'Janitorial Services — {{period}}',
  notes text,
  crm_company_id uuid REFERENCES public.crm_companies(id) ON DELETE SET NULL,
  crm_deal_id uuid REFERENCES public.crm_deals(id) ON DELETE SET NULL,
  next_invoice_date date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_billing_schedules TO authenticated;
GRANT ALL ON public.recurring_billing_schedules TO service_role;
ALTER TABLE public.recurring_billing_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "billing staff manage recurring schedules" ON public.recurring_billing_schedules;
CREATE POLICY "billing staff manage recurring schedules"
  ON public.recurring_billing_schedules FOR ALL TO authenticated
  USING (public.can_manage_billing(auth.uid()))
  WITH CHECK (public.can_manage_billing(auth.uid()));

DROP TRIGGER IF EXISTS trg_recurring_schedules_updated_at ON public.recurring_billing_schedules;
CREATE TRIGGER trg_recurring_schedules_updated_at
  BEFORE UPDATE ON public.recurring_billing_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_recurring_schedules_active
  ON public.recurring_billing_schedules(active, next_invoice_date);

-- D) Per-period status tracking
CREATE TABLE IF NOT EXISTS public.recurring_billing_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.recurring_billing_schedules(id) ON DELETE CASCADE,
  job_site_id uuid NOT NULL REFERENCES public.job_sites(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','ready','generated','held','skipped')),
  reason text,
  amount numeric,
  invoice_id uuid REFERENCES public.billing_invoices(id) ON DELETE SET NULL,
  generated_at timestamptz,
  generated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (schedule_id, period_start)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_billing_periods TO authenticated;
GRANT ALL ON public.recurring_billing_periods TO service_role;
ALTER TABLE public.recurring_billing_periods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "billing staff manage recurring periods" ON public.recurring_billing_periods;
CREATE POLICY "billing staff manage recurring periods"
  ON public.recurring_billing_periods FOR ALL TO authenticated
  USING (public.can_manage_billing(auth.uid()))
  WITH CHECK (public.can_manage_billing(auth.uid()));

DROP TRIGGER IF EXISTS trg_recurring_periods_updated_at ON public.recurring_billing_periods;
CREATE TRIGGER trg_recurring_periods_updated_at
  BEFORE UPDATE ON public.recurring_billing_periods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_recurring_periods_period
  ON public.recurring_billing_periods(period_start, status);