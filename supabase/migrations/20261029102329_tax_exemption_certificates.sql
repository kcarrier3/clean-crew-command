-- Tax-exempt customers need a certificate, except rows that were already exempt.
-- Those existing rows are flagged certificate_missing and can be cleaned up later.

ALTER TABLE public.crm_companies
  ADD COLUMN IF NOT EXISTS tax_exempt_certificate_missing boolean NOT NULL DEFAULT false;

UPDATE public.crm_companies
   SET tax_exempt_certificate_missing = true
 WHERE tax_exempt
   AND (tax_exempt_certificate_path IS NULL OR btrim(tax_exempt_certificate_path) = '');

CREATE OR REPLACE FUNCTION public.guard_company_tax_exemption()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_role text;
BEGIN
  v_role := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    CASE
      WHEN nullif(current_setting('request.jwt.claims', true), '') IS NULL THEN NULL
      ELSE nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
    END,
    ''
  );

  IF TG_OP = 'UPDATE'
     AND auth.uid() IS NOT NULL
     AND v_role IN ('authenticated', 'anon')
     AND NOT public.can_manage_billing(auth.uid())
     AND (
       NEW.tax_exempt IS DISTINCT FROM OLD.tax_exempt
       OR NEW.tax_exemption_reason IS DISTINCT FROM OLD.tax_exemption_reason
       OR NEW.tax_exempt_certificate_path IS DISTINCT FROM OLD.tax_exempt_certificate_path
       OR NEW.tax_exempt_certificate_expires IS DISTINCT FROM OLD.tax_exempt_certificate_expires
       OR NEW.tax_exempt_certificate_on_file IS DISTINCT FROM OLD.tax_exempt_certificate_on_file
       OR NEW.tax_exempt_certificate_missing IS DISTINCT FROM OLD.tax_exempt_certificate_missing
     )
  THEN
    RAISE EXCEPTION 'Not authorized to change tax exemption' USING ERRCODE = '42501';
  END IF;

  IF NEW.tax_exempt_certificate_path IS NOT NULL AND btrim(NEW.tax_exempt_certificate_path) <> '' THEN
    NEW.tax_exempt_certificate_on_file := true;
    NEW.tax_exempt_certificate_missing := false;
  END IF;

  IF NEW.tax_exempt AND (NEW.tax_exemption_reason IS NULL OR btrim(NEW.tax_exemption_reason) = '') THEN
    IF NOT coalesce(NEW.tax_exempt_certificate_missing, false) THEN
      RAISE EXCEPTION 'Tax exempt customers need an exemption reason' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.tax_exempt AND (NEW.tax_exempt_certificate_path IS NULL OR btrim(NEW.tax_exempt_certificate_path) = '') THEN
    IF NOT coalesce(NEW.tax_exempt_certificate_missing, false) THEN
      RAISE EXCEPTION 'Tax exempt customers need an exemption certificate on file' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.guard_company_tax_exemption() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_company_tax_exemption ON public.crm_companies;
CREATE TRIGGER trg_guard_company_tax_exemption
  BEFORE INSERT OR UPDATE ON public.crm_companies
  FOR EACH ROW EXECUTE FUNCTION public.guard_company_tax_exemption();

CREATE OR REPLACE VIEW public.billing_tax_exemption_gaps
WITH (security_invoker = true) AS
SELECT
  c.id,
  c.name,
  c.tax_exemption_reason,
  c.tax_exempt_certificate_path,
  c.tax_exempt_certificate_expires,
  c.tax_exempt_certificate_missing,
  CASE
    WHEN c.tax_exempt_certificate_path IS NULL OR btrim(c.tax_exempt_certificate_path) = '' THEN 'missing'
    WHEN c.tax_exempt_certificate_expires IS NOT NULL AND c.tax_exempt_certificate_expires < CURRENT_DATE THEN 'expired'
    ELSE 'ok'
  END AS gap
FROM public.crm_companies c
WHERE c.tax_exempt
  AND (
    c.tax_exempt_certificate_path IS NULL
    OR btrim(c.tax_exempt_certificate_path) = ''
    OR (c.tax_exempt_certificate_expires IS NOT NULL AND c.tax_exempt_certificate_expires < CURRENT_DATE)
  );

GRANT SELECT ON public.billing_tax_exemption_gaps TO authenticated;
REVOKE ALL ON public.billing_tax_exemption_gaps FROM anon;

INSERT INTO storage.buckets (id, name, public)
VALUES ('tax-exemption-certificates', 'tax-exemption-certificates', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Billing users read tax certificates" ON storage.objects;
CREATE POLICY "Billing users read tax certificates"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'tax-exemption-certificates' AND public.can_manage_billing(auth.uid()));

DROP POLICY IF EXISTS "Billing users insert tax certificates" ON storage.objects;
CREATE POLICY "Billing users insert tax certificates"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'tax-exemption-certificates' AND public.can_manage_billing(auth.uid()));

DROP POLICY IF EXISTS "Billing users update tax certificates" ON storage.objects;
CREATE POLICY "Billing users update tax certificates"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'tax-exemption-certificates' AND public.can_manage_billing(auth.uid()))
WITH CHECK (bucket_id = 'tax-exemption-certificates' AND public.can_manage_billing(auth.uid()));

DROP POLICY IF EXISTS "Billing users delete tax certificates" ON storage.objects;
CREATE POLICY "Billing users delete tax certificates"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'tax-exemption-certificates' AND public.can_manage_billing(auth.uid()));
