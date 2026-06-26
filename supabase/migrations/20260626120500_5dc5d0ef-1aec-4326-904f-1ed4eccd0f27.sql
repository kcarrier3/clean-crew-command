GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_orders TO authenticated;
GRANT ALL ON public.work_orders TO service_role;

GRANT SELECT ON public.job_sites TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_sites TO authenticated;
GRANT ALL ON public.job_sites TO service_role;

GRANT SELECT ON public.profiles_directory TO authenticated;
GRANT ALL ON public.profiles_directory TO service_role;