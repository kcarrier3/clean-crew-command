-- 1) Trigger functions: never callable directly through the API (triggers still fire normally)
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'billing_alloc_after_change()','billing_event_from_job()','billing_event_from_milestone()',
    'billing_event_from_phase()','billing_invoice_log_change()','crm_lead_set_lost_at()',
    'recalc_tm_ticket_total()','sync_job_site_tm_hours()','billing_invoice_email_rollup()',
    'crm_lead_notes_set_updated_by()','time_off_auto_approve()'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;
END $$;

-- 2) Permission helpers used by access rules: signed-in only, never signed-out
REVOKE EXECUTE ON FUNCTION public.can_approve_tm_tickets(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_tm_tickets(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_run_payroll(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_approve_tm_tickets(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_tm_tickets(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_run_payroll(uuid) TO authenticated, service_role;

-- 3) Internal-only functions: not called by the app directly
REVOKE EXECUTE ON FUNCTION public.recalc_invoice_balance(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_all_permissions(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recalc_invoice_balance(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_all_permissions(uuid) TO service_role;

-- 4) Conversations: creator must be the caller
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
CREATE POLICY "Users can create conversations"
  ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- 5) Project phases: only people who can see the job site, billing staff, or crew punched in there
DROP POLICY IF EXISTS "Authenticated users can view project phases" ON public.project_phases;
CREATE POLICY "Permitted users can view project phases"
  ON public.project_phases FOR SELECT TO authenticated
  USING (
    public.can_access_job_site_sensitive_info(auth.uid(), job_site_id)
    OR public.can_manage_billing(auth.uid())
    OR public.can_manage_tm_tickets(auth.uid())
    OR public.is_punched_in_at(auth.uid(), job_site_id)
  );

-- 6) Schedule weeks: staff see published weeks; schedulers see drafts too
DROP POLICY IF EXISTS "Authenticated users can view schedule weeks" ON public.schedule_weeks;
CREATE POLICY "Staff view published schedule weeks"
  ON public.schedule_weeks FOR SELECT TO authenticated
  USING (
    published = true
    OR public.can_publish_schedules(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  );

-- 7) Tax rates: only billing, estimating and sales users
DROP POLICY IF EXISTS "Authenticated can view tax rates" ON public.tax_rates;
CREATE POLICY "Billing and sales can view tax rates"
  ON public.tax_rates FOR SELECT TO authenticated
  USING (
    public.can_manage_billing(auth.uid())
    OR public.can_estimate(auth.uid())
    OR public.is_crm_user(auth.uid())
  );