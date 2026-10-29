-- Schedule of values and who may see billing dollars.
-- Checkpoints stay on project_phases. Dollar amounts stay out of the API for
-- everyone except Owner, admin, Office Manager, and Operations Manager.
-- Additive: no columns or rows are dropped. job_sites.contract_amount is copied
-- into job_site_financials and then hidden from the API. The column is kept so
-- this can be reversed, and a trigger mirrors later edits back onto it.

-- Billing is job title only. The admin and manager app roles do not grant it.
-- Kennedy Carrier (kennedy@gosummitvalley.com) is job title Owner, so this covers
-- that account without the admin role.
CREATE OR REPLACE FUNCTION public.can_manage_billing(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _user_id
      AND p.job_title IN ('Owner', 'Office Manager', 'Operations Manager')
  );
$$;

-- Credits over the self-approve limit stay Owner-only. Drop the admin-role shortcut.
CREATE OR REPLACE FUNCTION public.can_approve_credits(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _user_id AND p.job_title = 'Owner'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_sov(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_manage_billing(_user_id);
$$;

-- Billing roles may mark any project. A generic manager may mark any project
-- (there is no per-project manager assignment). A Project Crew Lead may mark
-- only job sites they are scheduled on. Employees cannot.
CREATE OR REPLACE FUNCTION public.can_mark_project_checkpoint(_user_id uuid, _job_site_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_manage_billing(_user_id)
      OR (
        public.has_role(_user_id, 'manager'::app_role)
        AND NOT EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = _user_id AND p.job_title = 'Project Crew Lead'
        )
      )
      OR EXISTS (
        SELECT 1
        FROM public.profiles p
        JOIN public.employee_schedules es ON es.employee_id = p.id
        WHERE p.id = _user_id
          AND p.job_title = 'Project Crew Lead'
          AND es.job_site_id = _job_site_id
          AND es.active
          AND es.start_date <= CURRENT_DATE
          AND (es.end_date IS NULL OR es.end_date >= CURRENT_DATE)
      );
$$;

REVOKE ALL ON FUNCTION public.can_view_sov(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_mark_project_checkpoint(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_sov(uuid), public.can_mark_project_checkpoint(uuid, uuid) TO authenticated, service_role;

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
  USING (public.can_mark_project_checkpoint(auth.uid(), job_site_id))
  WITH CHECK (public.can_mark_project_checkpoint(auth.uid(), job_site_id));

-- Hide legacy amount columns on the checkpoint table. select of name/status still works.
-- The table owner (and security-definer triggers) can still read them for older jobs.
ALTER TABLE public.job_sites
  ADD COLUMN IF NOT EXISTS progress_billing boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.job_sites_guard_progress_billing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.progress_billing, false) AND NOT public.can_manage_billing(auth.uid()) THEN
      RAISE EXCEPTION 'Only billing staff can turn on progress billing';
    END IF;
  ELSIF NEW.progress_billing IS DISTINCT FROM OLD.progress_billing
        AND NOT public.can_manage_billing(auth.uid()) THEN
    RAISE EXCEPTION 'Only billing staff can change progress billing';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_job_sites_guard_progress_billing ON public.job_sites;
CREATE TRIGGER trg_job_sites_guard_progress_billing
  BEFORE INSERT OR UPDATE ON public.job_sites
  FOR EACH ROW EXECUTE FUNCTION public.job_sites_guard_progress_billing();

REVOKE ALL ON FUNCTION public.job_sites_guard_progress_billing() FROM PUBLIC, anon, authenticated;

-- Contract value. Hidden from the API; billing screens read job_site_financials.
CREATE TABLE IF NOT EXISTS public.job_site_financials (
  job_site_id uuid PRIMARY KEY REFERENCES public.job_sites(id) ON DELETE CASCADE,
  contract_amount numeric(12,2),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.job_site_financials (job_site_id, contract_amount)
SELECT id, contract_amount
FROM public.job_sites
WHERE contract_amount IS NOT NULL
ON CONFLICT (job_site_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.sync_job_site_contract_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.job_sites SET contract_amount = NULL WHERE id = OLD.job_site_id;
    RETURN OLD;
  END IF;
  UPDATE public.job_sites SET contract_amount = NEW.contract_amount WHERE id = NEW.job_site_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_job_site_contract_amount ON public.job_site_financials;
CREATE TRIGGER trg_sync_job_site_contract_amount
  AFTER INSERT OR UPDATE OR DELETE ON public.job_site_financials
  FOR EACH ROW EXECUTE FUNCTION public.sync_job_site_contract_amount();

REVOKE ALL ON FUNCTION public.sync_job_site_contract_amount() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.job_site_contract_amount(_job_site_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT f.contract_amount FROM public.job_site_financials f WHERE f.job_site_id = _job_site_id),
    (SELECT s.contract_amount FROM public.job_sites s WHERE s.id = _job_site_id)
  );
$$;

REVOKE ALL ON FUNCTION public.job_site_contract_amount(uuid) FROM PUBLIC, anon, authenticated;

ALTER TABLE public.job_site_financials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Billing roles read job site financials" ON public.job_site_financials;
CREATE POLICY "Billing roles read job site financials"
  ON public.job_site_financials FOR SELECT TO authenticated
  USING (public.can_manage_billing(auth.uid()));

DROP POLICY IF EXISTS "Billing roles write job site financials" ON public.job_site_financials;
CREATE POLICY "Billing roles write job site financials"
  ON public.job_site_financials FOR ALL TO authenticated
  USING (public.can_manage_billing(auth.uid()))
  WITH CHECK (public.can_manage_billing(auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_site_financials TO authenticated;
GRANT ALL ON public.job_site_financials TO service_role;

REVOKE SELECT (contract_amount), INSERT (contract_amount), UPDATE (contract_amount)
  ON public.job_sites FROM PUBLIC, anon, authenticated;

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

  -- Progress-billing jobs bill the checkpoint's schedule amount. Other jobs
  -- keep the previous phase/percent behavior. A later partial percent or
  -- retainage can change v_amount without a new table.
  IF COALESCE(v_site.progress_billing, false) THEN
    SELECT amount INTO v_sov FROM public.project_sov_lines WHERE project_phase_id = NEW.id;
    IF v_sov IS NULL THEN RETURN NEW; END IF;
    v_amount := v_sov;
    v_pct := NULL;
  ELSE
    IF COALESCE(v_site.billing_mode, 'completion') NOT IN ('phased', 'progress') THEN
      RETURN NEW;
    END IF;
    v_pct := NEW.billing_percent;
    v_amount := COALESCE(NEW.billing_amount,
                         CASE WHEN v_pct IS NOT NULL AND public.job_site_contract_amount(v_site.id) IS NOT NULL
                              THEN ROUND(public.job_site_contract_amount(v_site.id) * v_pct / 100.0, 2) END,
                         0);
  END IF;

  INSERT INTO public.billing_events (
    job_site_id, project_phase_id, crm_company_id, crm_lead_id, crm_deal_id, source, label,
    contract_amount, billing_percent, amount, po_number, billing_email, notes,
    completed_at, ready_at, created_by
  ) VALUES (
    NEW.job_site_id, NEW.id, v_site.crm_company_id, v_site.crm_lead_id, v_site.crm_deal_id,
    'phase_completion',
    v_site.name || ' — ' || NEW.name,
    public.job_site_contract_amount(v_site.id), v_pct, v_amount, v_site.billing_po_number, v_site.billing_email,
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

-- Whole-job and milestone billing read the contract from job_site_financials
-- (falling back to the hidden column). Triggers stay security definer, so cron
-- and these triggers do not depend on the caller's billing role.
CREATE OR REPLACE FUNCTION public.billing_event_from_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_amount numeric; v_billed numeric; v_contract numeric;
BEGIN
  IF NEW.completion_status IS DISTINCT FROM 'complete'
     OR COALESCE(OLD.completion_status,'') = 'complete' THEN RETURN NEW; END IF;
  IF COALESCE(NEW.billing_mode,'completion') = 'manual' THEN RETURN NEW; END IF;

  v_contract := public.job_site_contract_amount(NEW.id);
  IF COALESCE(NEW.billing_mode,'completion') = 'completion' THEN
    v_amount := COALESCE(v_contract, 0);
  ELSE
    SELECT COALESCE(SUM(amount),0) INTO v_billed
    FROM public.billing_events WHERE job_site_id = NEW.id AND status <> 'cancelled';
    v_amount := GREATEST(COALESCE(v_contract,0) - v_billed, 0);
    IF v_amount <= 0 THEN RETURN NEW; END IF;
  END IF;

  INSERT INTO public.billing_events (
    job_site_id, crm_company_id, crm_lead_id, source, label,
    contract_amount, billing_percent, amount, po_number, billing_email, notes,
    completed_at, ready_at, created_by
  ) VALUES (
    NEW.id, NEW.crm_company_id, NEW.crm_lead_id, 'job_completion',
    NEW.name || ' — Project complete',
    v_contract,
    CASE WHEN COALESCE(NEW.billing_mode,'completion') = 'completion' THEN 100 END,
    v_amount, NEW.billing_po_number, NEW.billing_email, NEW.completion_notes,
    COALESCE(NEW.completed_at, now()), now(), auth.uid()
  );
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.billing_event_from_milestone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_site record; v_amount numeric; v_pct numeric; v_contract numeric;
BEGIN
  IF NEW.status <> 'complete' OR COALESCE(OLD.status,'') = 'complete' THEN RETURN NEW; END IF;
  SELECT * INTO v_site FROM public.job_sites WHERE id = NEW.job_site_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF COALESCE(v_site.billing_mode,'completion') <> 'progress' THEN RETURN NEW; END IF;

  v_contract := public.job_site_contract_amount(NEW.job_site_id);
  v_pct := NEW.billing_percent;
  v_amount := COALESCE(NEW.billing_amount,
                       CASE WHEN v_pct IS NOT NULL AND v_contract IS NOT NULL
                            THEN ROUND(v_contract * v_pct / 100.0, 2) END,
                       0);

  INSERT INTO public.billing_events (
    job_site_id, milestone_id, crm_company_id, crm_lead_id, crm_deal_id, source, label,
    contract_amount, billing_percent, amount, po_number, billing_email, notes,
    completed_at, ready_at, created_by
  ) VALUES (
    NEW.job_site_id, NEW.id, v_site.crm_company_id, v_site.crm_lead_id, v_site.crm_deal_id,
    'milestone_completion',
    v_site.name || ' — ' || NEW.name,
    v_contract, v_pct, v_amount, v_site.billing_po_number, v_site.billing_email,
    NEW.notes, COALESCE(NEW.completed_at, now()), now(), auth.uid()
  )
  ON CONFLICT (milestone_id) WHERE milestone_id IS NOT NULL DO NOTHING;
  RETURN NEW;
END $$;

-- Undo (do not run as part of this migration):
--   GRANT SELECT (contract_amount), INSERT (contract_amount), UPDATE (contract_amount)
--     ON public.job_sites TO authenticated;
--   DROP TABLE public.job_site_financials;
--     The hidden job_sites.contract_amount values are left in place.
--   Restore can_manage_billing to: admin role OR manager role OR the three job titles.
--   Restore can_approve_credits to: admin role OR job title Owner.
