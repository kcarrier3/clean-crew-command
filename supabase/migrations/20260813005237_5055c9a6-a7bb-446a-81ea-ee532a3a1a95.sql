CREATE POLICY "Billing managers read check images"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'check-images' AND public.can_manage_billing(auth.uid()));
CREATE POLICY "Billing managers upload check images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'check-images' AND public.can_manage_billing(auth.uid()));
CREATE POLICY "Billing managers update check images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'check-images' AND public.can_manage_billing(auth.uid()))
  WITH CHECK (bucket_id = 'check-images' AND public.can_manage_billing(auth.uid()));
CREATE POLICY "Billing managers delete check images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'check-images' AND public.can_manage_billing(auth.uid()));