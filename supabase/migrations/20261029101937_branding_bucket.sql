-- Public bucket for the invoice logo. The file itself is committed at
-- public/branding/summit-logo.png. This migration does not upload the bytes:
-- storage object rows do not hold the file. After applying, upload that PNG to
-- branding/summit-logo.png if you want the storage URL. The invoice PDF loads
-- /branding/summit-logo.png from the web app. The invoice email inlines a copy
-- bundled with send-invoice-email, so it does not depend on this upload.

INSERT INTO storage.buckets (id, name, public)
VALUES ('branding', 'branding', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public can read branding" ON storage.objects;
CREATE POLICY "Public can read branding"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'branding');

DROP POLICY IF EXISTS "Billing users insert branding" ON storage.objects;
CREATE POLICY "Billing users insert branding"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'branding' AND public.can_manage_billing(auth.uid()));

DROP POLICY IF EXISTS "Billing users update branding" ON storage.objects;
CREATE POLICY "Billing users update branding"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'branding' AND public.can_manage_billing(auth.uid()))
WITH CHECK (bucket_id = 'branding' AND public.can_manage_billing(auth.uid()));

DROP POLICY IF EXISTS "Billing users delete branding" ON storage.objects;
CREATE POLICY "Billing users delete branding"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'branding' AND public.can_manage_billing(auth.uid()));
