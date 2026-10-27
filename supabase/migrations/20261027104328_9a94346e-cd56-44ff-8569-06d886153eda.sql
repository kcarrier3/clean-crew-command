CREATE POLICY "No direct app access to deletion requests"
ON public.account_deletion_requests
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);