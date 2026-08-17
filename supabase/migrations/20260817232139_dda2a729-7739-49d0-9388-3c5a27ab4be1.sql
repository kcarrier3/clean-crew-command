GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.department_managers TO authenticated;
GRANT ALL ON public.department_managers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.department_employees TO authenticated;
GRANT ALL ON public.department_employees TO service_role;