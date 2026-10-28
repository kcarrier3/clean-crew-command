-- Schedule of values for construction projects.
-- Checkpoints stay on project_phases (names and progress). Dollar amounts live
-- only in project_sov_lines, which billing roles can read. Additive: nothing
-- is dropped, and existing phase rows are left as they are.

CREATE OR REPLACE FUNCTION public.can_view_sov(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = _user_id
          AND p.job_title IN ('Owner', 'Office Manager')
      );
$$;

CREATE OR REPLACE FUNCTION public.can_mark_project_checkpoint(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::app_role)
      OR public.has_role(_user_id, 'manager'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = _user_id
          AND p.job_title IN ('Owner', 'Office Manager', 'Operations Manager')
      );
$$;

REVOKE ALL ON FUNCTION public.can_view_sov(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_mark_project_checkpoint(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_sov(uuid), public.can_mark_project_checkpoint(uuid) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.project_sov_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_site_id uuid NOT NULL REFERENCES public.job_sites(id) ON DELETE CASCADE,
  project_phase_id uuid NOT NULL UNIQUE REFERENCES public.project_phases(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_sov_lines_site ON public.project_sov_lines(job_site_id);

DROP TRIGGER IF EXISTS set_updated_at ON public.project_sov_lines;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.project_sov_lines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.project_sov_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Billing roles read schedule of values" ON public.project_sov_lines;
CREATE POLICY "Billing roles read schedule of values"
  ON public.project_sov_lines FOR SELECT TO authenticated
  USING (public.can_view_sov(auth.uid()));

DROP POLICY IF EXISTS "Billing roles insert schedule of values" ON public.project_sov_lines;
CREATE POLICY "Billing roles insert schedule of values"
  ON public.project_sov_lines FOR INSERT TO authenticated
  WITH CHECK (public.can_view_sov(auth.uid()));

DROP POLICY IF EXISTS "Billing roles update schedule of values" ON public.project_sov_lines;
CREATE POLICY "Billing roles update schedule of values"
  ON public.project_sov_lines FOR UPDATE TO authenticated
  USING (public.can_view_sov(auth.uid()))
  WITH CHECK (public.can_view_sov(auth.uid()));

DROP POLICY IF EXISTS "Billing roles delete schedule of values" ON public.project_sov_lines;
CREATE POLICY "Billing roles delete schedule of values"
  ON public.project_sov_lines FOR DELETE TO authenticated
  USING (public.can_view_sov(auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_sov_lines TO authenticated;
GRANT ALL ON public.project_sov_lines TO service_role;

-- Office / Owner can add checkpoints and the project itself when they do not also hold the manager role.
DROP POLICY IF EXISTS "Billing roles can create project phases" ON public.project_phases;
CREATE POLICY "Billing roles can create project phases"
  ON public.project_phases FOR INSERT TO authenticated
  WITH CHECK (public.can_view_sov(auth.uid()));

DROP POLICY IF EXISTS "Billing roles can delete project phases" ON public.project_phases;
CREATE POLICY "Billing roles can delete project phases"
  ON public.project_phases FOR DELETE TO authenticated
  USING (public.can_view_sov(auth.uid()));

DROP POLICY IF EXISTS "Billing roles can view job sites" ON public.job_sites;
CREATE POLICY "Billing roles can view job sites"
  ON public.job_sites FOR SELECT TO authenticated
  USING (public.can_view_sov(auth.uid()));

DROP POLICY IF EXISTS "Billing roles can create job sites" ON public.job_sites;
CREATE POLICY "Billing roles can create job sites"
  ON public.job_sites FOR INSERT TO authenticated
  WITH CHECK (public.can_view_sov(auth.uid()));

DROP POLICY IF EXISTS "Billing roles can update job sites" ON public.job_sites;
CREATE POLICY "Billing roles can update job sites"
  ON public.job_sites FOR UPDATE TO authenticated
  USING (public.can_view_sov(auth.uid()))
  WITH CHECK (public.can_view_sov(auth.uid()));

-- Operations Manager (by job title) can mark checkpoints, same as the manager role.
-- Employees are not included unless they already hold the manager or admin role.
DROP POLICY IF EXISTS "Checkpoint managers can update project phases" ON public.project_phases;
CREATE POLICY "Checkpoint managers can update project phases"
  ON public.project_phases FOR UPDATE TO authenticated
  USING (public.can_mark_project_checkpoint(auth.uid()))
  WITH CHECK (public.can_mark_project_checkpoint(auth.uid()));

-- Hide legacy amount columns on the checkpoint table. select of name/status still works.
-- The table owner (and security-definer triggers) can still read them for older jobs.
REVOKE SELECT (billing_amount, billing_percent) ON public.project_phases FROM PUBLIC, anon, authenticated;
REVOKE INSERT (billing_amount, billing_percent) ON public.project_phases FROM PUBLIC, anon, authenticated;
REVOKE UPDATE (billing_amount, billing_percent) ON public.project_phases FROM PUBLIC, anon, authenticated;

-- Phase completion -> Ready to Bill. Amount comes from the schedule of values when present.
CREATE OR REPLACE FUNCTION public.billing_event_from_phase()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_site record; v_amount numeric; v_pct numeric; v_sov numeric;
BEGIN
  IF NEW.status IS DISTINCT FROM 'complete' AND COALESCE(OLD.status, '') = 'complete' THEN
    UPDATE public.billing_events
       SET status = 'cancelled'
     WHERE project_phase_id = NEW.id
       AND invoice_id IS NULL
       AND status IN ('ready', 'hold');
    RETURN NEW;
  END IF;

  IF NEW.status <> 'complete' OR COALESCE(OLD.status, '') = 'complete' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_site FROM public.job_sites WHERE id = NEW.job_site_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT amount INTO v_sov FROM public.project_sov_lines WHERE project_phase_id = NEW.id;
  IF v_sov IS NULL AND COALESCE(v_site.billing_mode, 'completion') NOT IN ('phased', 'progress') THEN
    RETURN NEW;
  END IF;

  v_pct := NEW.billing_percent;
  v_amount := COALESCE(v_sov, NEW.billing_amount,
                       CASE WHEN v_pct IS NOT NULL AND v_site.contract_amount IS NOT NULL
                            THEN ROUND(v_site.contract_amount * v_pct / 100.0, 2) END,
                       0);

  INSERT INTO public.billing_events (
    job_site_id, project_phase_id, crm_company_id, crm_lead_id, crm_deal_id, source, label,
    contract_amount, billing_percent, amount, po_number, billing_email, notes,
    completed_at, ready_at, created_by
  ) VALUES (
    NEW.job_site_id, NEW.id, v_site.crm_company_id, v_site.crm_lead_id, v_site.crm_deal_id,
    'phase_completion',
    v_site.name || ' — ' || NEW.name,
    v_site.contract_amount, v_pct, v_amount, v_site.billing_po_number, v_site.billing_email,
    NEW.completion_notes, COALESCE(NEW.completed_at, now()), now(), auth.uid()
  )
  ON CONFLICT (project_phase_id) WHERE project_phase_id IS NOT NULL DO UPDATE
    SET amount = EXCLUDED.amount,
        label = EXCLUDED.label,
        status = 'ready',
        completed_at = EXCLUDED.completed_at,
        ready_at = now(),
        notes = EXCLUDED.notes,
        invoice_id = NULL,
        invoiced_at = NULL
    WHERE public.billing_events.status IS DISTINCT FROM 'invoiced';

  RETURN NEW;
END $$;
