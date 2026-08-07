DROP POLICY IF EXISTS "Owners can delete estimates" ON public.estimates;
CREATE POLICY "Owners and creators can delete estimates"
ON public.estimates FOR DELETE TO authenticated
USING (public.can_approve_estimate(auth.uid()) OR created_by = auth.uid());