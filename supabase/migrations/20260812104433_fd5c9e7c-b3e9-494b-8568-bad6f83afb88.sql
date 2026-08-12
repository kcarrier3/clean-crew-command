
-- ============ permission helper ============
CREATE OR REPLACE FUNCTION public.can_manage_billing(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id,'admin'::app_role)
      OR public.has_role(_user_id,'manager'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = _user_id
          AND p.job_title IN ('Owner','Office Manager','Operations Manager')
      );
$$;

-- ============ job_sites billing configuration ============
ALTER TABLE public.job_sites
  ADD COLUMN IF NOT EXISTS billing_mode text NOT NULL DEFAULT 'completion',
  ADD COLUMN IF NOT EXISTS contract_amount numeric,
  ADD COLUMN IF NOT EXISTS billing_terms text DEFAULT 'Net 30',
  ADD COLUMN IF NOT EXISTS billing_po_number text,
  ADD COLUMN IF NOT EXISTS billing_contact_name text,
  ADD COLUMN IF NOT EXISTS billing_email text,
  ADD COLUMN IF NOT EXISTS billing_notes text,
  ADD COLUMN IF NOT EXISTS crm_company_id uuid REFERENCES public.crm_companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS crm_lead_id uuid REFERENCES public.crm_leads(id) ON DELETE SET NULL;

-- ============ project_phases billing configuration ============
ALTER TABLE public.project_phases
  ADD COLUMN IF NOT EXISTS billing_percent numeric,
  ADD COLUMN IF NOT EXISTS billing_amount numeric;

-- ============ billing milestones ============
CREATE TABLE IF NOT EXISTS public.billing_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_site_id uuid NOT NULL REFERENCES public.job_sites(id) ON DELETE CASCADE,
  name text NOT NULL,
  sequence integer NOT NULL DEFAULT 1,
  billing_percent numeric,
  billing_amount numeric,
  status text NOT NULL DEFAULT 'pending',
  completed_at timestamptz,
  completed_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_milestones TO authenticated;
GRANT ALL ON public.billing_milestones TO service_role;
ALTER TABLE public.billing_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "billing staff manage milestones" ON public.billing_milestones
  FOR ALL TO authenticated USING (public.can_manage_billing(auth.uid())) WITH CHECK (public.can_manage_billing(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_billing_milestones_site ON public.billing_milestones(job_site_id);

-- ============ invoices ============
CREATE SEQUENCE IF NOT EXISTS public.billing_invoice_number_seq START 1000;

CREATE TABLE IF NOT EXISTS public.billing_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  job_site_id uuid REFERENCES public.job_sites(id) ON DELETE SET NULL,
  crm_company_id uuid REFERENCES public.crm_companies(id) ON DELETE SET NULL,
  crm_lead_id uuid REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  customer_name text,
  billing_contact_name text,
  billing_email text,
  po_number text,
  status text NOT NULL DEFAULT 'draft',
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  payment_terms text DEFAULT 'Net 30',
  subtotal numeric NOT NULL DEFAULT 0,
  tax_rate numeric NOT NULL DEFAULT 0,
  tax numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL DEFAULT 0,
  balance_due numeric NOT NULL DEFAULT 0,
  notes text,
  pdf_path text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  paid_at timestamptz,
  voided_at timestamptz,
  earliest_completed_at timestamptz,
  qb_external_id text,
  qb_sync_status text NOT NULL DEFAULT 'not_synced',
  qb_synced_at timestamptz,
  qb_sync_error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_invoices TO authenticated;
GRANT ALL ON public.billing_invoices TO service_role;
ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "billing staff manage invoices" ON public.billing_invoices
  FOR ALL TO authenticated USING (public.can_manage_billing(auth.uid())) WITH CHECK (public.can_manage_billing(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_billing_invoices_site ON public.billing_invoices(job_site_id);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_lead ON public.billing_invoices(crm_lead_id);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_company ON public.billing_invoices(crm_company_id);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_status ON public.billing_invoices(status);

CREATE TABLE IF NOT EXISTS public.billing_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.billing_invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_invoice_items TO authenticated;
GRANT ALL ON public.billing_invoice_items TO service_role;
ALTER TABLE public.billing_invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "billing staff manage invoice items" ON public.billing_invoice_items
  FOR ALL TO authenticated USING (public.can_manage_billing(auth.uid())) WITH CHECK (public.can_manage_billing(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_billing_invoice_items_invoice ON public.billing_invoice_items(invoice_id);

CREATE TABLE IF NOT EXISTS public.billing_invoice_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.billing_invoices(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  from_status text,
  to_status text,
  detail text,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.billing_invoice_history TO authenticated;
GRANT ALL ON public.billing_invoice_history TO service_role;
ALTER TABLE public.billing_invoice_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "billing staff read invoice history" ON public.billing_invoice_history
  FOR SELECT TO authenticated USING (public.can_manage_billing(auth.uid()));
CREATE POLICY "billing staff write invoice history" ON public.billing_invoice_history
  FOR INSERT TO authenticated WITH CHECK (public.can_manage_billing(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_billing_invoice_history_invoice ON public.billing_invoice_history(invoice_id);

-- ============ billable events (Ready to Bill) ============
CREATE TABLE IF NOT EXISTS public.billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_site_id uuid REFERENCES public.job_sites(id) ON DELETE CASCADE,
  project_phase_id uuid REFERENCES public.project_phases(id) ON DELETE SET NULL,
  milestone_id uuid REFERENCES public.billing_milestones(id) ON DELETE SET NULL,
  crm_company_id uuid REFERENCES public.crm_companies(id) ON DELETE SET NULL,
  crm_lead_id uuid REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'job_completion',
  label text NOT NULL,
  description text,
  contract_amount numeric,
  billing_percent numeric,
  amount numeric NOT NULL DEFAULT 0,
  po_number text,
  billing_email text,
  notes text,
  status text NOT NULL DEFAULT 'ready',
  hold_reason text,
  hold_at timestamptz,
  hold_by uuid,
  completed_at timestamptz NOT NULL DEFAULT now(),
  ready_at timestamptz NOT NULL DEFAULT now(),
  invoice_id uuid REFERENCES public.billing_invoices(id) ON DELETE SET NULL,
  invoiced_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_events TO authenticated;
GRANT ALL ON public.billing_events TO service_role;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "billing staff manage billing events" ON public.billing_events
  FOR ALL TO authenticated USING (public.can_manage_billing(auth.uid())) WITH CHECK (public.can_manage_billing(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_billing_events_status ON public.billing_events(status);
CREATE INDEX IF NOT EXISTS idx_billing_events_site ON public.billing_events(job_site_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_lead ON public.billing_events(crm_lead_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_events_phase ON public.billing_events(project_phase_id) WHERE project_phase_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_events_milestone ON public.billing_events(milestone_id) WHERE milestone_id IS NOT NULL;

-- ============ deposits, payments, allocations ============
CREATE TABLE IF NOT EXISTS public.billing_deposit_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  deposit_date date NOT NULL DEFAULT CURRENT_DATE,
  bank_account_label text,
  total_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_deposit_batches TO authenticated;
GRANT ALL ON public.billing_deposit_batches TO service_role;
ALTER TABLE public.billing_deposit_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "billing staff manage deposits" ON public.billing_deposit_batches
  FOR ALL TO authenticated USING (public.can_manage_billing(auth.uid())) WITH CHECK (public.can_manage_billing(auth.uid()));

CREATE TABLE IF NOT EXISTS public.billing_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crm_company_id uuid REFERENCES public.crm_companies(id) ON DELETE SET NULL,
  payer_name text,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL DEFAULT 0,
  method text NOT NULL DEFAULT 'check',
  reference_number text,
  deposit_date date,
  deposit_account_label text,
  deposit_batch_id uuid REFERENCES public.billing_deposit_batches(id) ON DELETE SET NULL,
  notes text,
  qb_external_id text,
  qb_sync_status text NOT NULL DEFAULT 'not_synced',
  qb_synced_at timestamptz,
  qb_sync_error text,
  entered_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_payments TO authenticated;
GRANT ALL ON public.billing_payments TO service_role;
ALTER TABLE public.billing_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "billing staff manage payments" ON public.billing_payments
  FOR ALL TO authenticated USING (public.can_manage_billing(auth.uid())) WITH CHECK (public.can_manage_billing(auth.uid()));

CREATE TABLE IF NOT EXISTS public.billing_payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.billing_payments(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.billing_invoices(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_payment_allocations TO authenticated;
GRANT ALL ON public.billing_payment_allocations TO service_role;
ALTER TABLE public.billing_payment_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "billing staff manage allocations" ON public.billing_payment_allocations
  FOR ALL TO authenticated USING (public.can_manage_billing(auth.uid())) WITH CHECK (public.can_manage_billing(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_billing_alloc_invoice ON public.billing_payment_allocations(invoice_id);
CREATE INDEX IF NOT EXISTS idx_billing_alloc_payment ON public.billing_payment_allocations(payment_id);

-- ============ email foundation ============
CREATE TABLE IF NOT EXISTS public.billing_email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_email_templates TO authenticated;
GRANT ALL ON public.billing_email_templates TO service_role;
ALTER TABLE public.billing_email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "billing staff manage email templates" ON public.billing_email_templates
  FOR ALL TO authenticated USING (public.can_manage_billing(auth.uid())) WITH CHECK (public.can_manage_billing(auth.uid()));

CREATE TABLE IF NOT EXISTS public.billing_email_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES public.billing_invoices(id) ON DELETE CASCADE,
  crm_lead_id uuid REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  template_key text,
  to_recipients text[] NOT NULL DEFAULT '{}',
  cc_recipients text[] NOT NULL DEFAULT '{}',
  bcc_recipients text[] NOT NULL DEFAULT '{}',
  subject text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  attachment_paths text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft',
  provider text,
  provider_message_id text,
  error_message text,
  retry_count integer NOT NULL DEFAULT 0,
  webhook_status text,
  webhook_at timestamptz,
  queued_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_email_messages TO authenticated;
GRANT ALL ON public.billing_email_messages TO service_role;
ALTER TABLE public.billing_email_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "billing staff manage email messages" ON public.billing_email_messages
  FOR ALL TO authenticated USING (public.can_manage_billing(auth.uid())) WITH CHECK (public.can_manage_billing(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_billing_email_invoice ON public.billing_email_messages(invoice_id);

CREATE TABLE IF NOT EXISTS public.billing_account_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crm_company_id uuid UNIQUE REFERENCES public.crm_companies(id) ON DELETE CASCADE,
  primary_billing_email text,
  additional_recipients text[] NOT NULL DEFAULT '{}',
  cc_recipients text[] NOT NULL DEFAULT '{}',
  po_required boolean NOT NULL DEFAULT false,
  consolidated_invoicing boolean NOT NULL DEFAULT false,
  auto_send_allowed boolean NOT NULL DEFAULT false,
  default_terms text DEFAULT 'Net 30',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_account_preferences TO authenticated;
GRANT ALL ON public.billing_account_preferences TO service_role;
ALTER TABLE public.billing_account_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "billing staff manage account prefs" ON public.billing_account_preferences
  FOR ALL TO authenticated USING (public.can_manage_billing(auth.uid())) WITH CHECK (public.can_manage_billing(auth.uid()));

-- ============ updated_at triggers ============
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['billing_milestones','billing_invoices','billing_events','billing_payments',
                           'billing_deposit_batches','billing_email_messages','billing_email_templates',
                           'billing_account_preferences'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I', t);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t);
  END LOOP;
END $$;

-- ============ invoice numbering ============
CREATE OR REPLACE FUNCTION public.next_invoice_number()
RETURNS text LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  SELECT 'INV-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.billing_invoice_number_seq')::text, 5, '0');
$$;
GRANT EXECUTE ON FUNCTION public.next_invoice_number() TO authenticated;

-- ============ invoice balance derivation ============
CREATE OR REPLACE FUNCTION public.recalc_invoice_balance(_invoice_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_paid numeric; v_inv record;
BEGIN
  SELECT * INTO v_inv FROM public.billing_invoices WHERE id = _invoice_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT COALESCE(SUM(a.amount),0) INTO v_paid
  FROM public.billing_payment_allocations a WHERE a.invoice_id = _invoice_id;

  UPDATE public.billing_invoices SET
    amount_paid = v_paid,
    balance_due = GREATEST(v_inv.total - v_paid, 0),
    paid_at = CASE WHEN v_paid >= v_inv.total AND v_inv.total > 0 THEN COALESCE(v_inv.paid_at, now()) ELSE NULL END,
    status = CASE
      WHEN v_inv.status IN ('void','draft') THEN v_inv.status
      WHEN v_inv.total > 0 AND v_paid >= v_inv.total THEN 'paid'
      WHEN v_paid > 0 THEN 'partially_paid'
      WHEN v_inv.sent_at IS NOT NULL AND v_inv.due_date IS NOT NULL AND v_inv.due_date < CURRENT_DATE THEN 'past_due'
      WHEN v_inv.sent_at IS NOT NULL THEN 'sent'
      ELSE 'ready'
    END,
    updated_at = now()
  WHERE id = _invoice_id;
END $$;
GRANT EXECUTE ON FUNCTION public.recalc_invoice_balance(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.billing_alloc_after_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN PERFORM public.recalc_invoice_balance(OLD.invoice_id); END IF;
  IF TG_OP <> 'DELETE' THEN PERFORM public.recalc_invoice_balance(NEW.invoice_id); END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
DROP TRIGGER IF EXISTS trg_billing_alloc_change ON public.billing_payment_allocations;
CREATE TRIGGER trg_billing_alloc_change
AFTER INSERT OR UPDATE OR DELETE ON public.billing_payment_allocations
FOR EACH ROW EXECUTE FUNCTION public.billing_alloc_after_change();

-- ============ invoice history trigger ============
CREATE OR REPLACE FUNCTION public.billing_invoice_log_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.billing_invoice_history (invoice_id, event_type, to_status, detail, actor_id)
    VALUES (NEW.id, 'created', NEW.status, 'Invoice ' || NEW.invoice_number || ' generated', auth.uid());
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.billing_invoice_history (invoice_id, event_type, from_status, to_status, actor_id)
    VALUES (NEW.id, 'status_change', OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_billing_invoice_log ON public.billing_invoices;
CREATE TRIGGER trg_billing_invoice_log
AFTER INSERT OR UPDATE ON public.billing_invoices
FOR EACH ROW EXECUTE FUNCTION public.billing_invoice_log_change();

-- ============ automatic Ready to Bill creation ============
CREATE OR REPLACE FUNCTION public.billing_event_from_phase()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    job_site_id, project_phase_id, crm_company_id, crm_lead_id, source, label,
    contract_amount, billing_percent, amount, po_number, billing_email, notes,
    completed_at, ready_at, created_by
  ) VALUES (
    NEW.job_site_id, NEW.id, v_site.crm_company_id, v_site.crm_lead_id, 'phase_completion',
    v_site.name || ' — ' || NEW.name,
    v_site.contract_amount, v_pct, v_amount, v_site.billing_po_number, v_site.billing_email,
    NEW.completion_notes, COALESCE(NEW.completed_at, now()), now(), auth.uid()
  )
  ON CONFLICT (project_phase_id) WHERE project_phase_id IS NOT NULL DO NOTHING;

  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_billing_event_phase ON public.project_phases;
CREATE TRIGGER trg_billing_event_phase
AFTER UPDATE ON public.project_phases
FOR EACH ROW EXECUTE FUNCTION public.billing_event_from_phase();

CREATE OR REPLACE FUNCTION public.billing_event_from_job()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_amount numeric; v_billed numeric;
BEGIN
  IF NEW.completion_status IS DISTINCT FROM 'complete'
     OR COALESCE(OLD.completion_status,'') = 'complete' THEN RETURN NEW; END IF;

  IF COALESCE(NEW.billing_mode,'completion') = 'manual' THEN RETURN NEW; END IF;

  IF COALESCE(NEW.billing_mode,'completion') = 'completion' THEN
    v_amount := COALESCE(NEW.contract_amount, 0);
  ELSE
    -- phased/progress: bill whatever remains of the contract
    SELECT COALESCE(SUM(amount),0) INTO v_billed
    FROM public.billing_events WHERE job_site_id = NEW.id AND status <> 'cancelled';
    v_amount := GREATEST(COALESCE(NEW.contract_amount,0) - v_billed, 0);
    IF v_amount <= 0 THEN RETURN NEW; END IF;
  END IF;

  INSERT INTO public.billing_events (
    job_site_id, crm_company_id, crm_lead_id, source, label,
    contract_amount, billing_percent, amount, po_number, billing_email, notes,
    completed_at, ready_at, created_by
  ) VALUES (
    NEW.id, NEW.crm_company_id, NEW.crm_lead_id, 'job_completion',
    NEW.name || ' — Project complete',
    NEW.contract_amount,
    CASE WHEN COALESCE(NEW.billing_mode,'completion') = 'completion' THEN 100 END,
    v_amount, NEW.billing_po_number, NEW.billing_email, NEW.completion_notes,
    COALESCE(NEW.completed_at, now()), now(), auth.uid()
  );

  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_billing_event_job ON public.job_sites;
CREATE TRIGGER trg_billing_event_job
AFTER UPDATE ON public.job_sites
FOR EACH ROW EXECUTE FUNCTION public.billing_event_from_job();

-- ============ default email template ============
INSERT INTO public.billing_email_templates (key, name, subject, body)
VALUES (
  'invoice_default', 'Invoice — default',
  'Invoice {{invoice_number}} from {{company_name}}',
  E'Hello {{customer_name}},\n\nPlease find attached invoice {{invoice_number}} for {{project_name}} in the amount of {{amount}}, due {{due_date}}.\nPO: {{po_number}}\n\nThank you,\n{{company_contact}}'
)
ON CONFLICT (key) DO NOTHING;
