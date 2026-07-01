
CREATE POLICY "Asset photos: managers can view"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'asset-photos' AND public.is_supply_manager(auth.uid()));

CREATE POLICY "Asset photos: managers can upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'asset-photos' AND public.is_supply_manager(auth.uid()));

CREATE POLICY "Asset photos: managers can update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'asset-photos' AND public.is_supply_manager(auth.uid()));

CREATE POLICY "Asset photos: managers can delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'asset-photos' AND public.is_supply_manager(auth.uid()));
