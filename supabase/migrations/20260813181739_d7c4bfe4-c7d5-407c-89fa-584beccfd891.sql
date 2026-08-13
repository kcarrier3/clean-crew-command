CREATE POLICY "Anyone signed in can read module settings"
ON public.app_settings
FOR SELECT
TO authenticated
USING (key = 'disabled_modules');