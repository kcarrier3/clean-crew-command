
DROP POLICY IF EXISTS "Billing staff read invoice documents" ON storage.objects;
DROP POLICY IF EXISTS "Billing staff upload invoice documents" ON storage.objects;
DROP POLICY IF EXISTS "Billing staff update invoice documents" ON storage.objects;
DROP POLICY IF EXISTS "Billing staff delete invoice documents" ON storage.objects;

CREATE POLICY "Billing staff read invoice documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'invoice-documents' AND public.can_manage_billing(auth.uid()));

CREATE POLICY "Billing staff upload invoice documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'invoice-documents' AND public.can_manage_billing(auth.uid()));

CREATE POLICY "Billing staff update invoice documents"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'invoice-documents' AND public.can_manage_billing(auth.uid()))
WITH CHECK (bucket_id = 'invoice-documents' AND public.can_manage_billing(auth.uid()));

CREATE POLICY "Billing staff delete invoice documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'invoice-documents' AND public.can_manage_billing(auth.uid()));
