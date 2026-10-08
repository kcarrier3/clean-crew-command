CREATE POLICY "Staff complete own assignments" ON public.training_assignments FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());