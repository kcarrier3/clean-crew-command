-- helper: who can create T&M tickets
CREATE OR REPLACE FUNCTION public.can_manage_tm_tickets(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_user_id,'admin'::app_role)
      OR public.has_role(_user_id,'manager'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = _user_id
          AND p.job_title IN ('Owner','Office Manager','Operations Manager','Project Crew Lead','Night Manager','Janitorial Manager')
      );
$$;
REVOKE EXECUTE ON FUNCTION public.can_manage_tm_tickets(uuid) FROM anon;

CREATE OR REPLACE FUNCTION public.can_approve_tm_tickets(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_user_id,'admin'::app_role)
      OR public.has_role(_user_id,'manager'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = _user_id AND p.job_title IN ('Owner','Operations Manager','Office Manager')
      );
$$;
REVOKE EXECUTE ON FUNCTION public.can_approve_tm_tickets(uuid) FROM anon;

ALTER TABLE public.job_sites
  ADD COLUMN IF NOT EXISTS tm_hours numeric NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.tm_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_site_id uuid NOT NULL REFERENCES public.job_sites(id) ON DELETE CASCADE,
  ticket_number text,
  title text NOT NULL,
  description text,
  work_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'draft',
  total_hours numeric NOT NULL DEFAULT 0,
  customer_name text,
  customer_signature_data text,
  customer_signed_at timestamptz,
  approved_by uuid REFERENCES public.profiles(id),
  approved_at timestamptz,
  rejection_reason text,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tm_tickets TO authenticated;
GRANT ALL ON public.tm_tickets TO service_role;
ALTER TABLE public.tm_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "TM tickets viewable by staff"
  ON public.tm_tickets FOR SELECT TO authenticated
  USING (public.can_manage_tm_tickets(auth.uid()) OR created_by = auth.uid());

CREATE POLICY "TM tickets insert by leads"
  ON public.tm_tickets FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_tm_tickets(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "TM tickets update by owner or approver"
  ON public.tm_tickets FOR UPDATE TO authenticated
  USING (public.can_approve_tm_tickets(auth.uid()) OR (created_by = auth.uid() AND status IN ('draft','rejected')))
  WITH CHECK (public.can_approve_tm_tickets(auth.uid()) OR (created_by = auth.uid() AND status IN ('draft','rejected','pending_approval')));

CREATE POLICY "TM tickets delete by owner or approver"
  ON public.tm_tickets FOR DELETE TO authenticated
  USING (public.can_approve_tm_tickets(auth.uid()) OR (created_by = auth.uid() AND status = 'draft'));

CREATE TABLE IF NOT EXISTS public.tm_ticket_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tm_tickets(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.profiles(id),
  time_entry_id uuid REFERENCES public.time_entries(id) ON DELETE SET NULL,
  work_date date NOT NULL DEFAULT CURRENT_DATE,
  hours numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS tm_ticket_hours_entry_uniq
  ON public.tm_ticket_hours(ticket_id, time_entry_id) WHERE time_entry_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tm_ticket_hours TO authenticated;
GRANT ALL ON public.tm_ticket_hours TO service_role;
ALTER TABLE public.tm_ticket_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "TM hours viewable with ticket"
  ON public.tm_ticket_hours FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tm_tickets t WHERE t.id = ticket_id
    AND (public.can_manage_tm_tickets(auth.uid()) OR t.created_by = auth.uid())));

CREATE POLICY "TM hours writable on open tickets"
  ON public.tm_ticket_hours FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tm_tickets t WHERE t.id = ticket_id
    AND (public.can_approve_tm_tickets(auth.uid()) OR (t.created_by = auth.uid() AND t.status IN ('draft','rejected')))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.tm_tickets t WHERE t.id = ticket_id
    AND (public.can_approve_tm_tickets(auth.uid()) OR (t.created_by = auth.uid() AND t.status IN ('draft','rejected')))));

-- keep ticket totals and job site T&M hours in sync
CREATE OR REPLACE FUNCTION public.recalc_tm_ticket_total()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_ticket uuid;
BEGIN
  v_ticket := COALESCE(NEW.ticket_id, OLD.ticket_id);
  UPDATE public.tm_tickets t
  SET total_hours = COALESCE((SELECT SUM(h.hours) FROM public.tm_ticket_hours h WHERE h.ticket_id = v_ticket), 0),
      updated_at = now()
  WHERE t.id = v_ticket;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_recalc_tm_ticket_total
AFTER INSERT OR UPDATE OR DELETE ON public.tm_ticket_hours
FOR EACH ROW EXECUTE FUNCTION public.recalc_tm_ticket_total();

CREATE OR REPLACE FUNCTION public.sync_job_site_tm_hours()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_site uuid;
BEGIN
  v_site := COALESCE(NEW.job_site_id, OLD.job_site_id);
  UPDATE public.job_sites js
  SET tm_hours = COALESCE((
        SELECT SUM(t.total_hours) FROM public.tm_tickets t
        WHERE t.job_site_id = v_site AND t.status = 'approved'
      ), 0),
      updated_at = now()
  WHERE js.id = v_site;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_sync_job_site_tm_hours
AFTER INSERT OR UPDATE OR DELETE ON public.tm_tickets
FOR EACH ROW EXECUTE FUNCTION public.sync_job_site_tm_hours();

CREATE TRIGGER trg_tm_tickets_updated_at
BEFORE UPDATE ON public.tm_tickets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_tm_ticket_hours_updated_at
BEFORE UPDATE ON public.tm_ticket_hours
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();