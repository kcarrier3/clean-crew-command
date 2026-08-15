# Multi-Tenant SaaS Conversion Audit — Crew Compass

Audit only. No code or schema changes are proposed for execution here; this is the assessment plus a staged plan you can approve later, phase by phase.

## Summary

Crew Compass is today a single-company application. Every table, RLS policy, storage bucket, edge function, and settings row assumes exactly one company (Summit Facilities). Nothing is broken by that today, but every access rule is written as "is this user a manager?" rather than "is this user a manager *of this organization*?". Converting to SaaS means adding an organization dimension to roughly 100 tables and rewriting essentially every RLS policy and security-definer function.

This is a large conversion — realistically a multi-phase effort, not a single change.

## 1. Where company-specific assumptions exist

- **Branding and copy**: logo file referenced directly (`/crew-compass-logo-notag.png`), product name and Summit-specific wording in Auth, Settings, Privacy Policy, Lead Capture, Report Issue, PDF builders (invoice, quote, proposal), and invoice/lead emails.
- **Global settings as singletons**: `app_settings` is keyed by setting name only (module toggles, sales goals, billing preferences, check auto-apply). One row per setting = one company.
- **Business-rule tables with no owner**: `pto_tiers`, `paid_holidays`, `time_off_policies`, `tax_rates`, `estimate_settings`, `estimate_production_rates`, `roles`, `permissions`, `crm_pipeline_stages`, `supply_categories`, `departments`, `billing_email_templates`, `adp_export_settings`. All are company policy expressed as global data.
- **Hardcoded domain logic**: job titles list, office-punch eligibility by title, pay period Sunday–Saturday, attendance point thresholds, prevailing-wage margin floor, Ohio tax seeds, ADP export format.
- **Numbering functions**: `next_invoice_number()` and `next_proposal_number()` produce one global sequence — two tenants would share/collide.
- **Storage**: nine buckets (`crm-files`, `onboarding-files`, `inspection-photos`, `work-order-photos`, `check-images`, `invoice-documents`, `asset-photos`, `manager-report-photos`, `radio`) with paths that do not encode a tenant.
- **Public/unauthenticated surfaces**: QR punch tokens, `/report/:jobSiteId`, `/get-a-quote` lead capture, `submit-lead`, `submit-porter-report`, `resend-webhook` — each currently resolves to "the" company.
- **Edge functions**: `invite-employee`, `admin-reset-password`, `check-late-workers`, `send-invoice-email`, `send-push-notification` run service-role logic with no tenant scoping; `check-late-workers` presumably sweeps all rows.

## 2. What needs a tenant identifier

Recommended model: a new `organizations` table plus `organization_members` (user + org + role). Every business table gets `organization_id uuid not null`.

Grouped by root:
- **Identity/config**: profiles, employees, user_roles, user_permissions, user_custom_roles, role_permissions, roles, permissions, departments and department_* joins, directory_access_rules, app_settings, adp_export_settings.
- **Operations**: job_sites, employee_accounts, employee_schedules, schedule_weeks, calendar_drafts, time_entries, excused_shifts, shift_call_offs, attendance_points, late_notifications, missed_punch_notifications, location_updates, porter_assignments, porter_reports, manager_reports(+photos), work_orders(+notes/photos), tm_tickets(+hours), project_phases, monthly_budget_history.
- **Quality**: inspections, inspection_items, inspection_photos, inspection_templates, inspection_template_items.
- **Waypoint/CRM**: crm_companies, crm_contacts, crm_leads, crm_deals, crm_activities, crm_tasks, crm_quotes(+items/signatures), crm_lead_notes, crm_lead_files, crm_invoices(+items), crm_email_logs, crm_meetings, crm_services, crm_pipeline_stages, crm_lead_submission_log, account_contacts, company_contacts(+assignments).
- **Estimating**: estimates, estimate_revisions, estimate_line_adders, estimate_proposals, estimate_settings, estimate_production_rates.
- **Billing**: all `billing_*` tables, recurring_billing_schedules/periods, tax_rates.
- **Supply**: supply_items, supply_categories, supply_stock, supply_locations, supply_movements, supply_requests, supply_item_cost_history, fixed_assets.
- **HR/docs**: onboarding_documents, employee_document_submissions, time_off_requests, time_off_policies, pto_tiers, pto_adjustments, paid_holidays, payroll_export_batches/rows.
- **Comms**: conversations, conversation_participants, messages, radio_transmissions, device_tokens, work order notifications.

Child tables (invoice items, inspection items, etc.) should still carry `organization_id` denormalized so RLS never needs a join.

## 3. Auth / roles / permissions

Today: `user_roles` (admin | manager | employee) plus a permission enum and per-user overrides, with job title driving defaults. All checks are global — `has_role(uid,'manager')` means manager everywhere.

Target: membership-scoped roles.
- `organization_members(user_id, organization_id, role, job_title, status)` — a user can belong to more than one org (needed for support access, franchise groups, and accountants).
- Roles per org: `owner` (billing + destructive actions), `admin`, `manager`, `employee`. Keep the existing job-title-driven permission defaults, but resolve them per membership.
- Every helper becomes org-aware: `has_role(uid, org, role)`, `has_permission(uid, org, perm)`, `is_crm_user(uid, org)`, `can_manage_billing`, `can_run_payroll`, `can_estimate`, `is_supply_manager`, etc. There are ~25 security-definer functions to rewrite.
- Add an "active organization" concept in the client (stored per session) and a `current_org()` SQL helper reading a JWT claim or a members lookup. JWT claim is faster but requires a custom access-token hook; a members-lookup helper is simpler and safer to start.
- Add a platform-level `super_admin` (separate table, never a column on profiles) for support, with audited impersonation rather than blanket read access.

## 4. RLS and security changes

- Every policy must gain an `organization_id = current_org()` (or membership-exists) predicate — RLS today has no tenant term at all, so a missing predicate silently exposes all tenants. This is the single largest risk in the project.
- Make `organization_id` NOT NULL with a `WITH CHECK` on every insert/update policy so rows cannot be written into another tenant.
- Storage: move to tenant-prefixed paths (`{org_id}/...`) and rewrite every bucket policy to compare the first path segment against the caller's memberships. Existing objects must be moved, not just re-policed.
- Security-definer functions must take org as a parameter or derive it; any function that currently returns "all rows of X" becomes a cross-tenant leak if left as-is.
- Public/anon paths (QR punch, issue reports, lead capture) must resolve the org from the token/site rather than assuming one, and must not allow enumerating other tenants' sites.
- Unique constraints that are currently global (invoice numbers, employee numbers, site names, SKUs) become `(organization_id, value)`.
- Realtime channels and messaging must filter by org, including the radio channel.
- Add a regression test suite that logs in as tenant A and asserts zero rows visible from tenant B, per table.

## 5. Hardest features to convert

Ranked by risk:
1. **Billing/invoicing** — per-tenant invoice numbering, tax tables, remittance matching, Resend sender identity/domain per tenant, check images, payment allocations. Financial data with the worst blast radius if cross-tenant leakage occurs.
2. **Waypoint/CRM** — largest table cluster, polymorphic links, files in storage, Salesforce import, merge tooling, pipeline stages as global config.
3. **Scheduling/timeclock** — public QR tokens, geofencing, attendance points, payroll export, cross-tenant employees who work for two orgs would break current assumptions.
4. **Employees/HR/onboarding** — a person is currently a profile; in SaaS a person can be a member of multiple orgs, so profile vs. employment record must be separated. Signed documents cannot be re-parented after the fact.
5. **Estimating** — production rates, wage floors and margin rules are company IP that becomes per-tenant configuration, and completed estimates/revisions are locked by triggers.
6. **Documents/files and storage migration** — physically moving objects and rewriting stored paths in the database is irreversible-ish and needs careful batching.
7. **Supply management** — stock ledger triggers must not mix tenants; movements are append-only.
8. **Quality control** — templates are global today; each tenant needs its own.
9. **Integrations** — Resend, push notifications (device tokens and topics), AI gateway usage attribution, ADP export formats all become per-tenant, plus per-tenant secrets management.

## 6. Migration strategy (data preservation)

1. Create `organizations` and `organization_members`; insert Summit Facilities as org #1.
2. Add `organization_id` to every table as **nullable**, backfill to org #1, then set NOT NULL with defaults where sensible. Do this in batches by domain, not one giant migration.
3. Backfill `organization_members` from existing `user_roles` + `profiles.job_title`.
4. Rewrite helper functions to be org-aware while keeping single-arg wrappers temporarily so existing policies keep working.
5. Rewrite RLS per domain, one domain at a time, verifying with a two-tenant test fixture before moving on.
6. Migrate storage objects into `{org_id}/` prefixes with a script, update stored paths, then swap bucket policies.
7. Swap numbering/unique constraints to per-org.
8. Only after all of the above: allow tenant #2 to exist (self-serve signup gated behind a flag until then).

High-risk migrations to call out: RLS rewrite (silent cross-tenant exposure), storage path migration (broken file links, signed documents), invoice numbering change (duplicate or skipped numbers), unique-constraint changes on live tables (lock time), and the profiles/employees split (auth breakage).

## 7. Subscription billing and tenant onboarding

- Keep tenant subscription billing separate from the app's own customer invoicing. Stripe is the natural fit: `organizations.stripe_customer_id`, a `subscriptions` table (plan, status, seats, period end), and a webhook edge function as the only writer.
- Pricing lever: per active employee/seat, with module entitlements layered on top — the existing module toggle system maps cleanly to plan entitlements once it is per-org.
- Enforce entitlements in two places: UI gating (existing `ModuleRoute`) and server-side checks for anything that costs money (AI scans, emails, push).
- Onboarding: signup creates org + owner membership in one transaction, then a guided setup (company profile and branding, job titles, pay period, PTO policy, tax rates, pipeline stages, first job site, invite team). Seed each new org from templates rather than sharing global rows.
- Add per-tenant branding (logo upload, colors, PDF header, email sender) since PDFs and emails currently hardcode Summit.
- Add an internal admin console for support: tenant list, plan, usage, audited impersonation.

## Staged implementation plan

- **Stage 0 — Foundations**: organizations, memberships, org-aware helper functions, active-org context in the client, two-tenant test fixture. No user-visible change.
- **Stage 1 — De-hardcode the company**: move branding, job titles, pay period, PTO tiers, holidays, attendance thresholds, tax rates, pipeline stages, estimating rates into per-org settings, still with one org.
- **Stage 2 — Tenant column + backfill** by domain: identity → operations → CRM → estimating → billing → supply → HR/docs → comms.
- **Stage 3 — RLS rewrite** per domain with cross-tenant tests gating each merge.
- **Stage 4 — Storage and integrations**: tenant-prefixed paths, per-tenant email sender, push topics, numbering sequences.
- **Stage 5 — Subscriptions**: Stripe, plans, entitlements, seat counting.
- **Stage 6 — Self-serve onboarding**: signup flow, seeding, admin console, then open tenant #2.

## Technical notes

- Prefer a members-lookup `current_org()` helper first; consider a JWT custom claim later for performance once policy shape is stable.
- Denormalize `organization_id` onto child tables to keep RLS predicates index-only; add `(organization_id, ...)` composite indexes alongside.
- Keep old single-arg security-definer wrappers during the transition so policy rewrites can land incrementally.
- Treat every `SECURITY DEFINER` function as a potential cross-tenant hole; each one needs an explicit review pass.
