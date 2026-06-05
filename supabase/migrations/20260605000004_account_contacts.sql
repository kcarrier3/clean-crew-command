-- ============================================================
-- Migration: Account Contacts (Multiple contacts per job site)
-- ============================================================

-- -------------------------------------------------------
-- 1. Account Contacts table
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS account_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_site_id UUID NOT NULL REFERENCES job_sites(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  title TEXT,                        -- e.g. "Facilities Manager", "Billing Contact"
  phone TEXT,
  email TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup by job site
CREATE INDEX IF NOT EXISTS idx_account_contacts_job_site ON account_contacts(job_site_id);

-- -------------------------------------------------------
-- 2. RLS Policies
-- -------------------------------------------------------
ALTER TABLE account_contacts ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read contacts
CREATE POLICY "account_contacts_read" ON account_contacts
  FOR SELECT TO authenticated USING (true);

-- Only managers/admins can write contacts
CREATE POLICY "account_contacts_write" ON account_contacts
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.job_title IN (
        'Owner','General Manager','Operations Manager','Area Manager',
        'District Manager','Regional Manager','Team Lead','Supervisor'
      )
    )
  );

-- -------------------------------------------------------
-- 3. Ensure only one primary contact per job site
--    (enforce via trigger)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_single_primary_contact()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_primary = true THEN
    UPDATE account_contacts
    SET is_primary = false
    WHERE job_site_id = NEW.job_site_id
      AND id != NEW.id
      AND is_primary = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_single_primary_contact ON account_contacts;
CREATE TRIGGER trg_single_primary_contact
  BEFORE INSERT OR UPDATE ON account_contacts
  FOR EACH ROW
  EXECUTE FUNCTION enforce_single_primary_contact();
