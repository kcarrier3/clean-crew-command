-- Milestone completion -> Ready to Bill
CREATE OR REPLACE FUNCTION public.billing_event_from_milestone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_site record; v_amount numeric; v_pct numeric;
BEGIN
  IF NEW.status <> 'complete' OR COALESCE(OLD.status,'') = 'complete' THEN RETURN NEW; END IF;

  SELECT * INTO v_site FROM public.job_sites WHERE id = NEW.job_site_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF COALESCE(v_site.billing_mode,'completion') <> 'progress' THEN RETURN NEW; END IF;

  v_pct := NEW.billing_percent;
  v_amount := COALESCE(NEW.billing_amount,
                       CASE WHEN v_pct IS NOT NULL AND v_site.contract_amount IS NOT NULL
                            THEN ROUND(v_site.contract_amount * v_pct / 100.0, 2) END,
                       0);

  INSERT INTO public.billing_events (
    job_site_id, milestone_id, crm_company_id, crm_lead_id, crm_deal_id, source, label,
    contract_amount, billing_percent, amount, po_number, billing_email, notes,
    completed_at, ready_at, created_by
  ) VALUES (
    NEW.job_site_id, NEW.id, v_site.crm_company_id, v_site.crm_lead_id, v_site.crm_deal_id,
    'milestone_completion',
    v_site.name || ' — ' || NEW.name,
    v_site.contract_amount, v_pct, v_amount, v_site.billing_po_number, v_site.billing_email,
    NEW.notes, COALESCE(NEW.completed_at, now()), now(), auth.uid()
  )
  ON CONFLICT (milestone_id) WHERE milestone_id IS NOT NULL DO NOTHING;

  RETURN NEW;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS billing_events_milestone_uniq
  ON public.billing_events (milestone_id) WHERE milestone_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_billing_event_milestone ON public.billing_milestones;
CREATE TRIGGER trg_billing_event_milestone
AFTER UPDATE ON public.billing_milestones
FOR EACH ROW EXECUTE FUNCTION public.billing_event_from_milestone();

-- Carry the Waypoint opportunity onto phase-driven billing events
CREATE OR REPLACE FUNCTION public.billing_event_from_phase()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_site record; v_amount numeric; v_pct numeric;
BEGIN
  IF NEW.status <> 'complete' OR COALESCE(OLD.status,'') = 'complete' THEN RETURN NEW; END IF;

  SELECT * INTO v_site FROM public.job_sites WHERE id = NEW.job_site_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF COALESCE(v_site.billing_mode,'completion') NOT IN ('phased','progress') THEN RETURN NEW; END IF;

  v_pct := NEW.billing_percent;
  v_amount := COALESCE(NEW.billing_amount,
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
  ON CONFLICT (project_phase_id) WHERE project_phase_id IS NOT NULL DO NOTHING;

  RETURN NEW;
END $$;