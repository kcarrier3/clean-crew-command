GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_check_intakes TO authenticated;
GRANT ALL ON public.billing_check_intakes TO service_role;
GRANT SELECT, INSERT ON public.billing_check_intake_events TO authenticated;
GRANT ALL ON public.billing_check_intake_events TO service_role;