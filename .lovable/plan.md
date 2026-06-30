# Custom Document Builder for Team

Build a full document platform: admins upload PDFs, drag fillable/signature/acknowledgment fields onto pages, the packet is auto-assigned to new hires right after profile completion, and admins review everything in a dedicated Documents page.

## What admins get

1. **New top-level "Documents" page** (admin/owner only, on the web app sidebar).
   - **Templates tab** — list of all uploaded document templates. "Upload PDF" button opens a builder.
   - **Submissions tab** — every employee × every template, with status (Pending / Completed / Rejected), filters by employee, document, status, and date completed. Click a row to view the filled PDF + signature.
   - **Settings tab** — toggle which templates are auto-assigned to new hires, set required vs optional, reorder.

2. **PDF Field Builder** (modal that opens after upload)
   - Renders the PDF page-by-page in a canvas (using `pdfjs-dist`).
   - Admin drags rectangles onto the page and labels each as: Text, Date, Checkbox, Signature, Initials, or Acknowledgment-only (whole page is read-only with an "I acknowledge" checkbox at the bottom).
   - Each field gets a label, required flag, and optional auto-fill source (employee name, address, SSN, DOB, phone, email — pulled from the profile).
   - Saved as a JSON schema attached to the template.

3. **Employee profile linkage**
   - On the employee edit dialog, a new "Documents" section shows status of every assigned doc with quick links to view the completed PDF.

## What employees get

- Right after `/complete-profile` saves, they're routed to `/documents` (new page) showing their assigned packet.
- Each document opens a viewer with the PDF rendered and the field overlays positioned where the admin placed them. Auto-fill pre-populates known fields from their profile.
- They fill, sign (using existing `SignaturePad`), and submit. The filled values + flattened PDF (rendered with `pdf-lib`) are stored.
- Acknowledgment-only docs just need the checkbox + signature.

## Access control

- Only Owner / Administrator roles can view the Documents page, upload templates, or view submissions.
- Employees can only see their own assigned documents.
- All filled PDFs and signatures live in a private storage bucket gated by RLS.

## Technical plan

### Database (one migration)
- Extend `onboarding_documents`:
  - `source_pdf_path TEXT` — storage path of the uploaded blank PDF
  - `field_schema JSONB` — array of `{id, page, x, y, width, height, type, label, required, autofill_source}`
  - `auto_assign BOOLEAN DEFAULT true`
- Extend `employee_document_submissions`:
  - `field_values JSONB` — `{field_id: value}`
  - `filled_pdf_path TEXT` — storage path of the flattened PDF
- Tighten RLS: drop the broad job-title list and replace with `has_role(auth.uid(), 'admin') OR profiles.job_title IN ('Owner','Administrator')` via the existing `is_crm_user`-style pattern.
- New private storage bucket `onboarding-documents` with RLS: admins read/write all; employees read only their own filled PDFs.

### Frontend
- New libs: `pdfjs-dist` (render), `pdf-lib` (fill + flatten), `react-rnd` (drag/resize field rectangles).
- New files:
  - `src/pages/Documents.tsx` — admin Documents page (tabs above)
  - `src/pages/MyDocuments.tsx` — employee packet view, accessed at `/documents`
  - `src/components/documents/PdfFieldBuilder.tsx` — drag-and-drop field editor
  - `src/components/documents/PdfFiller.tsx` — employee fill experience
  - `src/components/documents/DocumentsSection.tsx` — slot inside TeamRoster edit dialog
- Update `src/pages/CompleteProfile.tsx` to navigate to `/documents` on save.
- Add a "Documents" icon entry to `AppSidebar.tsx`, visible only to admins/owners on web.

### Out of scope (for this build)
- E-signature legal compliance certificates (IP, audit trail beyond what already exists)
- Bulk reassignment / reminder emails
- Versioning of templates (uploading a new PDF replaces the old)
