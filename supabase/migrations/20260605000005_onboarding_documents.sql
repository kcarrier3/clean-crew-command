-- ============================================================
-- Migration: Employee Onboarding Documents & Digital Signatures
-- ============================================================

-- -------------------------------------------------------
-- 1. Document Templates
--    Admins create templates; employees fill them out
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS onboarding_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN (
    'w4', 'i9', 'direct_deposit',
    'acknowledgment', 'signature_required', 'custom_form'
  )),
  description TEXT,
  content TEXT,                  -- Policy text for acknowledgment docs
  is_required BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------
-- 2. Employee Document Submissions
--    One row per employee per document
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS employee_document_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES onboarding_documents(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'rejected')),
  form_data JSONB,               -- Structured form fields (W-4, I-9, Direct Deposit)
  signature_data TEXT,           -- Base64 encoded signature image
  signature_typed TEXT,          -- Typed name as signature alternative
  acknowledged_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, document_id)
);

CREATE INDEX IF NOT EXISTS idx_emp_doc_submissions_employee ON employee_document_submissions(employee_id);
CREATE INDEX IF NOT EXISTS idx_emp_doc_submissions_document ON employee_document_submissions(document_id);
CREATE INDEX IF NOT EXISTS idx_emp_doc_submissions_status ON employee_document_submissions(status);

-- -------------------------------------------------------
-- 3. RLS Policies
-- -------------------------------------------------------
ALTER TABLE onboarding_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_document_submissions ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read active document templates
CREATE POLICY "onboarding_docs_read" ON onboarding_documents
  FOR SELECT TO authenticated USING (active = true OR EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid()
    AND p.job_title IN ('Owner','General Manager','Operations Manager','Area Manager',
      'District Manager','Regional Manager','Team Lead','Supervisor')
  ));

-- Only managers can create/update/delete document templates
CREATE POLICY "onboarding_docs_write" ON onboarding_documents
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid()
      AND p.job_title IN ('Owner','General Manager','Operations Manager','Area Manager',
        'District Manager','Regional Manager','Team Lead','Supervisor')
    )
  );

-- Employees can read their own submissions; managers can read all
CREATE POLICY "submissions_read" ON employee_document_submissions
  FOR SELECT TO authenticated
  USING (
    employee_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid()
      AND p.job_title IN ('Owner','General Manager','Operations Manager','Area Manager',
        'District Manager','Regional Manager','Team Lead','Supervisor')
    )
  );

-- Employees can insert/update their own submissions
CREATE POLICY "submissions_employee_write" ON employee_document_submissions
  FOR INSERT TO authenticated
  WITH CHECK (employee_id = auth.uid());

CREATE POLICY "submissions_employee_update" ON employee_document_submissions
  FOR UPDATE TO authenticated
  USING (employee_id = auth.uid() AND status = 'pending');

-- Managers can update (review/reject) any submission
CREATE POLICY "submissions_manager_update" ON employee_document_submissions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid()
      AND p.job_title IN ('Owner','General Manager','Operations Manager','Area Manager',
        'District Manager','Regional Manager','Team Lead','Supervisor')
    )
  );

-- -------------------------------------------------------
-- 4. Seed default document templates
-- -------------------------------------------------------
INSERT INTO onboarding_documents (title, document_type, description, is_required, display_order) VALUES
(
  'Employee Handbook Acknowledgment',
  'acknowledgment',
  'Acknowledgment that you have received, read, and agree to abide by the Employee Handbook.',
  true, 1
),
(
  'Attendance & Punctuality Policy',
  'acknowledgment',
  'Acknowledgment of the company attendance and punctuality policy, including call-out procedures.',
  true, 2
),
(
  'W-4 Employee Withholding Certificate',
  'w4',
  'Federal tax withholding information required by the IRS. Complete all applicable sections.',
  true, 3
),
(
  'I-9 Employment Eligibility Verification',
  'i9',
  'Federal form verifying your identity and authorization to work in the United States.',
  true, 4
),
(
  'Direct Deposit Authorization',
  'direct_deposit',
  'Authorization to deposit your paycheck directly into your bank account.',
  false, 5
)
ON CONFLICT DO NOTHING;
