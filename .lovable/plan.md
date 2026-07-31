## Diagnostic audit — Salesforce migration (read-only, nothing changed)

### What actually exists today

There is **no Salesforce API integration at all**. The entire migration is one client-side file:
`src/components/crm/SalesforceImportDialog.tsx` (680 lines), launched from `src/components/crm/CRMDashboard.tsx` ("Import from Salesforce"). It parses a **Setup → Data Export ZIP** (JSZip + PapaParse) in the browser and writes through the normal `supabase` anon client. No edge function is involved (`supabase/functions/` has only `admin-reset-password`, `check-late-workers`, `invite-employee`, `send-push-notification`, `submit-lead`, `submit-porter-report`).

Current row counts: `crm_companies` 1052, `crm_contacts` 320, `crm_leads` 396, `crm_deals` 396, `crm_lead_notes` 863, `crm_lead_files` 414, `crm_tasks` **0**, `storage.objects` in `crm-files` **828**.

---

### Answers to your ten questions

1. **Objects read** (ZIP CSV filename regexes, lines 224–230): `Account`, `Contact`, `Opportunity`, `Note`, `Attachment`, `ContentVersion`, `ContentDocumentLink`. **Not read: `Task`, `Event`, `ContentDocument`, `Lead`, `OpportunityContactRole`, `User`.** No SOQL/REST/Bulk API is used, so questions about queryMore and OAuth scopes are moot today — fidelity is bounded by what the Data Export ZIP contains.
2. **Both note systems partially supported.** Classic `Note.csv` → `crm_lead_notes` (lines 463–481). Enhanced Notes arrive as `ContentVersion` rows with `FileType=SNOTE`; those are detected (line 520) and HTML-stripped into `crm_lead_notes`. Classic `Attachment` and modern Files both map to `crm_lead_files`.
3. **Pagination:** N/A (file-based), but ZIP-native truncation risk is real — Salesforce Data Export splits into multiple ZIPs (`WE_00D…_1.ZIP`, `_2.ZIP`), and the loop at line 219 keeps only the **first** ZIP's copy of each CSV (`accounts = accounts ?? …`) and only the **last** `sourceZip` for file bytes. **Confirmed defect: multi-part exports silently lose records and file bytes.**
4. **Mappings** (confirmed): Account→`crm_companies` (Name, Industry, Website, Phone, Billing*, Description→notes, AnnualRevenue, NumberOfEmployees, Id→`salesforce_id`). Contact→`crm_contacts` (First/Last/Email/Phone/Title/Description, AccountId→`company_id`). Opportunity→`crm_leads` + mirrored `crm_deals` (Amount, Probability, CloseDate, StageName→`stage_id`, Type, NextStep, Description). **Defects:** `owner_id`/`created_by` are hardcoded to the importing user (`uid`) on every object — Salesforce `OwnerId` is discarded; Salesforce `CreatedDate`/`LastModifiedDate` are discarded everywhere (rows get `now()`); `won_at`/`lost_at` are set to `new Date()` instead of `CloseDate`; `crm_leads.contact_name` is stuffed with the **opportunity name** (line 385) and `company_name` falls back to the opportunity name; `crm_leads.notes` is overwritten with the literal string `Stage: <x>` (line 398), destroying any real note text on that column.
5. **Files:** there is **no VersionData download** — bytes come from the ZIP via `findZipEntryById()` (lines 174–186), which scans for the Salesforce Id as a path segment. Uploads go to `crm-files` at `crm-leads/<lead_id>/<uuid>-<name>`, then a row is inserted into `crm_lead_files`. **Confirmed defect:** if the id isn't found in the ZIP path the file is silently skipped with no error and no counter (lines 513–514) — this is the single most likely cause of "files not importing," and it is invisible in the summary. Salesforce Data Export actually names file folders by `ContentDocumentId`/`ParentId` in some layouts, not by the `ContentVersion.Id` that line 512 uses.
6. **Enhanced Notes are lossy by design:** the `.snote` HTML is regex-stripped to plain text (lines 526–539), so bullets, links, tables and formatting are destroyed. Only ~7 HTML entities are decoded; anything else survives as literal `&…;`. Titles equal to "Untitled Note" are nulled.
7. **Polymorphic resolution is the biggest fidelity gap.** `Note.ParentId`, `Attachment.ParentId` and `ContentDocumentLink.LinkedEntityId` are resolved **only** against `sfIdToLeadId` (opportunities). Any note/file whose parent is an **Account or Contact** is dropped with `continue` and never reported (lines 468, 500, 506). Salesforce orgs keep the majority of notes and files on Accounts — this alone explains large missing volumes. Schema reinforces it: `crm_lead_notes` and `crm_lead_files` have **only** `lead_id`; there is no company/contact/task parent column. `Task.WhoId`/`WhatId` are never read because Tasks are never imported (`crm_tasks` = 0 rows).
8. **Idempotency is asymmetric.** Accounts/Contacts/Opportunities upsert on `salesforce_id`; deals upsert on `lead_id`. **Notes and files use plain `.insert()` and have no `salesforce_id` column at all** — every re-run duplicates them. Evidence: 828 storage objects vs 414 `crm_lead_files` rows (~2× — orphaned bytes from a prior run wiped by "Reset CRM", which deletes DB rows but never storage objects). Error handling `break`s out of the whole entity loop on the first chunk error, abandoning remaining chunks; skipped rows produce no counts, so the summary can report success while thousands of records were dropped. No reconciliation against source row counts.
9. **RLS/storage are not the blocker.** `crm_lead_notes`, `crm_lead_files`, `crm_tasks` all have `FOR ALL … is_crm_user(auth.uid())`, and `crm-files` has matching insert/select/update/delete policies gated on `is_crm_user`. Real risks here are the browser-side 50 MB cap (line 558) and doing thousands of sequential uploads on an anon-key session in a tab that can be closed mid-run.
10. **OAuth/permissions:** none required today. If we move to API-based sync we'd need a Connected App with `api` + `refresh_token offline_access`, and the importing user needs "View All Data" plus read on Notes/Attachments/ContentDocument to see other owners' private notes and files.

---

### Confirmed defects (ranked)

1. Notes/files attached to **Accounts, Contacts, or Tasks are silently discarded** — schema only supports `lead_id`.
2. **Silent skips everywhere** (`continue` with no counter) — the summary overstates success.
3. **No idempotency for notes/files** → duplicates on re-run; Reset CRM orphans storage objects.
4. ZIP entry lookup keyed on the wrong Salesforce Id in common export layouts → files "not importing."
5. Enhanced Note rich text destroyed; entity decoding incomplete.
6. **Tasks not imported at all.**
7. Salesforce `OwnerId`, `CreatedDate`, `LastModifiedDate`, `CreatedById` discarded on every object.
8. Multi-part Data Export ZIPs partially ignored.
9. `crm_leads.contact_name` / `.notes` polluted with wrong values.
10. First chunk error aborts the remaining chunks of that entity.

### Likely risks (unconfirmed)

- Browser memory/time limits on multi-GB exports; tab-close mid-import leaves half-migrated state.
- `is_crm_user` denies the importer if the signed-in user lacks admin/manager → all-or-nothing failure.
- 50 MB files skipped (the bucket may allow more server-side).

---

### Recommended correction plan (not implemented)

**Phase 1 — schema for true parity**
- Add polymorphic parents + external ids to notes/files: `salesforce_id` (unique), `parent_type` (`account|contact|opportunity|task`), `company_id`, `contact_id`, `task_id`, plus `sf_owner_id`, `sf_created_date`, `sf_created_by_name`, and `content_html` for rich Enhanced Notes.
- Add `salesforce_id` + `who_id`/`what_id` resolution columns to `crm_tasks`.
- Backfill-safe: existing `lead_id` rows keep working.

**Phase 2 — importer rewrite in `SalesforceImportDialog.tsx`**
- Accept **multiple ZIP parts**; concatenate CSVs across parts, index every ZIP entry once into a `Map` keyed by *all* id-like path segments (15- and 18-char) so lookups can't miss.
- Build one global `sfId → {type, uuid}` resolver covering accounts, contacts, opportunities, tasks; route `ParentId`/`LinkedEntityId`/`WhoId`/`WhatId` through it.
- Import `Task.csv` → `crm_tasks` with subject, status, priority, `ActivityDate`, and resolved who/what links.
- Preserve Enhanced Note HTML (sanitized allowlist) into `content_html`, keep the stripped text in `content`.
- Upsert notes/files on `salesforce_id`; deduplicate storage paths deterministically (`crm/<sf_id>/<name>`) with `upsert: true`.
- Per-row outcome ledger: `imported / updated / skipped(reason) / failed(reason)`; never `break` a whole entity on one chunk error.

**Phase 3 — validation procedure (proves parity)**
1. Pre-import: record source row counts per CSV and per parent type (`Note` by ParentId prefix `001`/`003`/`006`, same for `Attachment` and `ContentDocumentLink`).
2. Post-import: run reconciliation SQL comparing `count(distinct salesforce_id)` per table against those source counts; expect exact equality, with an explicit reason list for every non-match.
3. Relationship check: zero notes/files with `parent_type` set but all parent FKs null; zero opportunities with an `AccountId` in source but null `company_id`.
4. File integrity: for a random 25-file sample, compare `crm_lead_files.file_size` to the ZIP entry's uncompressed size and confirm the storage object downloads.
5. Storage hygiene: report `storage.objects` in `crm-files` with no matching DB row (today: ~414 orphans) and offer a one-time cleanup.
6. Re-run the same import twice; all counts must be identical (idempotency proof).

Say the word and I'll implement Phase 1–3 in that order.