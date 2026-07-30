# Janitorial Sales Estimator — Architectural Assessment & Plan

Read-only assessment. No files, data, migrations, or deployments were changed.

## 1. Current app architecture

**Routing** (`src/App.tsx`): a single BrowserRouter with a small flat route list — `/`, `/auth`, `/complete-profile`, `/privacy-policy`, `/get-a-quote`, `/report/:jobSiteId`, `/punch/:token`, `/crm/opportunities/:id`, `*`. Almost the whole authenticated app lives inside `/` (`src/pages/Index.tsx`), which is a large tab shell; `OpportunityDetail` is the one precedent for a full-page CRM record route.

**Shell / navigation** (`src/pages/Index.tsx`, 580 lines):
- `sidebarItems: SidebarItem[]` (Index.tsx:156-178) drives the desktop `AppSidebar`; the same `activeTab` state drives mobile tabs plus a "More" `Sheet` menu.
- Mobile handling: `const isNative = useIsNativeApp() || useIsMobile()` (Index.tsx:49-54). Phone-width browsers are deliberately treated like the native Capacitor app and web-only tabs (CRM, Accounts, Team, Manager reports) are hidden. **This is the key constraint**: today CRM is desktop-only, so an estimator placed inside CRM would be invisible on phones — the opposite of what's wanted.
- Role gating idioms: `isManager()`, `canManageEmployees()`, `isCrmUser()` from `useAuth`, plus direct `profile?.job_title === '...'` checks (e.g. `isSupplyStaff`, Index.tsx:55-56).

**Design tokens** (`src/index.css`): HSL semantic tokens only — `--background/--foreground`, `--card`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--brand-orange: 25 95% 53%`, `--radius: 0.5rem`, and the `--sidebar-*` set, with a `.dark` block. The estimator must use these tokens (`bg-card`, `text-muted-foreground`, `text-[hsl(var(--brand-orange))]`) and never hardcoded colors.

**Reusable components**: full shadcn set in `src/components/ui` (card, tabs, table, dialog, drawer, sheet, select, slider, toggle-group, accordion, collapsible, progress, chart, form, alert-dialog, sonner/toaster). `slider` + `collapsible` + `drawer` are ideal for a mobile estimator. Domain pieces worth reusing: `SignaturePad.tsx`, `SEO.tsx`, `crm/generateQuotePdf.ts`, `crm/QuoteSignatureDialog.tsx`, `EmployeeSelector.tsx`.

## 2. Auth / roles

`src/hooks/useAuth.ts` exposes three layers:
- `user_roles` enum `app_role` (`admin | manager | employee`) via `hasRole` / `has_role()`.
- `user_permissions` enum `app_permission` (13 values; no estimating-related value exists).
- `profiles.job_title` free text constrained in code by `src/lib/jobTitles.ts` (`Owner`, `Office Manager`, `Operations Manager`, `Janitorial Manager`, `Night Manager`, `Project Crew Lead`, `Project Worker`, `Janitorial Staff`, `Floaters`, `Supply Management`, `Supply`).
- `isCrmUser()` = admin OR job_title `Owner`/`Administrator` (note: `Administrator` is stale — it was removed from `JOB_TITLES`).

Recommended mapping (no new enum values needed for MVP):
| Action | Who |
|---|---|
| Create/edit draft estimate | `isManager()` — Owner, Office Manager, Operations Manager, Janitorial Manager, Night Manager, Project Crew Lead |
| View own estimates | creator (`created_by = auth.uid()`) |
| View all estimates | `isManager()` |
| Approve / reject | Owner + `has_role(admin)` only (mirrors the Account Cost Report payroll restriction) |
| Administer defaults (wage, burden, supply presets, production rates) | Owner + admin only |

MVP-safe approach: enforce with RLS using existing `has_role()` + a small `public.can_estimate(uuid)` / `public.can_approve_estimate(uuid)` SECURITY DEFINER function reading `profiles.job_title`, exactly like the existing `is_supply_manager()` / `is_crm_user()` pattern. Adding a new `app_permission` value is a later enhancement (it touches `permissions`, `role_permissions`, `PermissionManagement.tsx`).

## 3. CRM/customer data to reuse (do not duplicate)

- `crm_companies` — accounts (has `salesforce_id`, `annual_revenue`, `employee_count`). Estimator links here, does **not** re-store customer name/address.
- `crm_contacts` — site/decision contacts, filterable by `company_id`.
- `crm_leads` — "Opportunities" in the UI; has `amount`, `stage_id`, `service_line`, `expected_revenue` (generated). An estimate should attach to an opportunity and be able to write its total back into `crm_leads.amount`.
- `crm_deals` — created only on award (per the current rule in `LeadDialog.tsx`).
- `crm_quotes` / `crm_quote_items` / `crm_quote_signatures` — the proposal layer the estimator should feed, not replace.
- `job_sites` — existing accounts/projects with `budgeted_hours`, `is_recurring_monthly`. An estimate should optionally link to a `job_site_id` once won; this is the hook for later estimated-vs-actual.
- Reusable components: `crm/LeadDialog.tsx` (`AccountPicker` / `ContactPicker` patterns), `CompanyDetailDialog.tsx` (tabbed account dashboard — add an "Estimates" tab), `LeadsList.tsx`, `QuoteBuilder.tsx`, `generateQuotePdf.ts`.
- Actual-cost sources for later analytics: `time_entries` + `profiles.hourly_rate`/`salary_amount` (as used by `AccountCostReport.tsx`), and `supply_movements` filtered to `kind = 'cleaning'` (resale is excluded from job cost — established rule).

## 4. Backend integration today

Supabase JS client at `src/integrations/supabase/client.ts`; types auto-generated in `src/integrations/supabase/types.ts` (never hand-edited). Edge functions: `admin-reset-password`, `check-late-workers`, `invite-employee`, `send-push-notification`, `submit-lead`, `submit-porter-report` (`supabase/config.toml` sets `verify_jwt`). Storage buckets already in use for inspection photos, work-order photos, onboarding/I-9 IDs, and CRM lead files. Heavy RLS everywhere, with SECURITY DEFINER helpers (`has_role`, `has_permission`, `is_crm_user`, `is_supply_manager`, `can_access_job_site_sensitive_info`). PDFs are generated **client-side** (`generateQuotePdf.ts`) — the estimator should follow that, no new edge function needed for MVP.

## 5. Recommended module location & routes

Mobile-first, so it must live outside the desktop-only CRM tab.

- New folder `src/components/estimator/` for all UI.
- New pages:
  - `src/pages/Estimates.tsx` → route `/estimates` (list: my drafts, pending approval, approved, lost)
  - `src/pages/EstimateDetail.tsx` → route `/estimates/:id` (survey → production → pricing → approval, full page, mirrors `OpportunityDetail.tsx`)
  - `src/pages/EstimatorSettings.tsx` → route `/estimates/settings` (Owner/admin only)
- Add a `{ v: 'estimates', label: 'Sales Estimator', icon: Calculator }` entry to the manager branch of `sidebarItems` in `Index.tsx` that `navigate('/estimates')`, **and** an entry in the mobile "More" sheet so it is reachable on phones and in the Capacitor shell.
- Add an "Estimates" tab to `crm/CompanyDetailDialog.tsx` and a link on `OpportunityDetail.tsx`.

Naming: user-facing label **"Sales Estimator"**; table prefix `estimate_*`. No "Cartana" anywhere.

## 6. Proposed schema (no customer-data duplication, revisions preserved)

All tables in `public`, each with `GRANT` → `ENABLE RLS` → policies, and `created_at`/`updated_at` + `update_updated_at_column()` trigger, per project convention.

**`estimate_settings`** — singleton-ish org defaults, Owner/admin write, manager read:
`base_wage numeric default 15.00`, `labor_burden_percent numeric default 20`, `supply_low numeric default 0.40`, `supply_standard numeric default 0.55`, `supply_high numeric default 0.85`, `default_production_rate integer default 3500`, `weeks_per_month numeric default 4.33`, `default_overhead_percent`, `default_target_margin_percent`.

**`estimate_production_rates`** — lookup, `building_type text`, `area_type text` (open floor, restroom, hard floor, carpet, etc.), `sqft_per_hour integer`, `active boolean`. Seeds the 3,500 sq ft/hr generic default and lets rates be tuned without code changes.

**`estimates`** — the header. Customer data by reference only:
`company_id uuid → crm_companies`, `lead_id uuid → crm_leads`, `contact_id uuid → crm_contacts`, `job_site_id uuid → job_sites` (null until won), `name text`, `status text` (`draft | pending_approval | approved | rejected | sent | won | lost`), `current_revision_id uuid`, `owner_id`, `created_by`, `approved_by`, `approved_at`, `rejection_reason`.

**`estimate_revisions`** — immutable snapshot; every recalculation-save creates a new row, so history is never lost:
`estimate_id`, `revision_number int`, `status text`, plus **inputs**: `square_feet`, `building_type`, `cleanings_per_week`, `weeks_per_month`, `production_rate_sqft_hour`, `restroom_count`, `fixture_count`, `floor_mix jsonb` (carpet/hard/tile %), `occupancy_level`, `traffic_level`, `service_window` (`day | night`), `day_porter_hours_per_week`, `windows_hours_per_month`, `periodic_floor_care jsonb`; **rates**: `base_wage`, `labor_burden_percent`, `supply_rate_per_hour`, `supply_preset` (`low|standard|high|custom`), `overhead_percent`, `target_margin_percent`, `pricing_mode` (`markup | margin`); **outputs** (stored so historical numbers never drift when defaults change): `labor_hours_per_visit`, `monthly_labor_hours`, `loaded_labor_rate`, `monthly_labor_cost`, `monthly_supply_cost`, `total_direct_cost`, `overhead_amount`, `price_per_visit`, `monthly_price`, `annual_price`, `price_per_sqft`, `gross_margin_percent`, `markup_percent`; `notes`, `created_by`.

**`estimate_line_adders`** — one row per adder/periodic service on a revision: `revision_id`, `kind` (`day_porter | floor_care | windows | restroom | custom`), `description`, `hours`, `cost`, `price`, `frequency`, `sort_order`.

Optional Stage 3: **`estimate_approvals`** (audit trail of approve/reject events) and **`estimate_actuals`** (a view, not a table, joining `time_entries` and cleaning-only `supply_movements` per `job_site_id`).

Calculation logic lives in a pure, unit-testable `src/components/estimator/calc.ts` — the DB stores results, it does not compute them (avoids generated-column pitfalls like the one already hit with `crm_leads.expected_revenue`).

## 7. Staged implementation plan

**Stage 0 — foundation (no UI risk)**
Migration for `estimate_settings`, `estimate_production_rates`, `estimates`, `estimate_revisions`, `estimate_line_adders` with GRANTs + RLS + `can_estimate()` / `can_approve_estimate()` helpers; seed defaults ($15.00, 20%, 0.40/0.55/0.85, 3,500 sq ft/hr, 4.33).

**Stage 1 — MVP calculator (mobile-first, standalone)**
`calc.ts` + `src/pages/Estimates.tsx` + `EstimateDetail.tsx` with a 3-step mobile flow: **Site Survey → Production → Pricing**. Inputs: sq ft, cleanings/week, weeks/month, production rate, supply preset. Outputs card: labor hrs/visit, monthly hours, loaded labor cost, supply cost, total direct cost, price/visit, monthly, annual, $/sq ft. Overhead and target profit shown as adjustable sliders with an explicit **markup vs margin** toggle and both figures displayed side by side. Save = create estimate + revision 1. Routes + sidebar/More-menu entries. Works standalone even with no CRM link.

**Stage 2 — CRM integration + adders**
Account/contact/opportunity pickers reusing `LeadDialog`'s patterns; "Estimates" tab on `CompanyDetailDialog`; adders UI (restrooms, floor mix, occupancy/traffic, day vs night differential, day porter, periodic floor care, windows) writing `estimate_line_adders`; revision history list with side-by-side compare and "duplicate as new revision".

**Stage 3 — approval + proposal**
Submit-for-approval → approve/reject (Owner/admin) with reason; approved estimate can push its total into `crm_leads.amount` and generate a `crm_quotes` + `crm_quote_items` record so the existing `generateQuotePdf.ts` / `QuoteSignatureDialog` proposal path is reused rather than rebuilt.

**Stage 4 — estimated vs actual**
Once won and linked to a `job_site_id`, compare estimated monthly hours/cost against `time_entries` labor and cleaning-only `supply_movements`, reusing the aggregation logic already in `AccountCostReport.tsx`. Feed variance back into `estimate_production_rates` as a "suggested rate".

## 8. Risks & conflicts

1. **Mobile visibility conflict (highest)** — `isNative = isNativeShell || isPhone` in `Index.tsx` hides CRM on phones. A mobile-friendly estimator must be its own route with its own mobile nav entry; putting it under the CRM tab would break the core requirement.
2. **`isCrmUser()` is too narrow and partly stale** — it's admin/Owner/`Administrator` only, and `Administrator` no longer exists in `JOB_TITLES`. Do not reuse it for estimator gating; use a fresh `can_estimate()` helper.
3. **Generated / constrained columns** — `crm_leads.expected_revenue` is generated and previously broke the Salesforce importer. Never write computed columns; keep all math in `calc.ts`.
4. **Writing back to `crm_leads.amount`** — the CRM pipeline value calculation in `CRMDashboard.tsx` sums open opportunity `amount` plus unlinked deals. Auto-pushing estimate totals will change reported pipeline value; make it an explicit user action, not automatic.
5. **RLS/GRANT omissions** — several past findings came from broad-read policies. Estimates contain wage and margin data: scope reads to creator + managers, restrict approval and settings to Owner/admin, and never grant `anon`.
6. **`crm_services` still queried by `QuoteBuilder.tsx`** even though the Services tab was removed — reusing the quote path in Stage 3 needs a check that this still resolves.
7. **Naming collision** — the public `/get-a-quote` lead form and CRM "Quotes" already exist; the estimator is an internal costing tool that *feeds* quotes. Keep the label "Sales Estimator" to avoid user confusion.
8. **Rate drift** — changing `estimate_settings` later must not retroactively alter historical estimates; that's why every rate is snapshotted onto `estimate_revisions`.

## Open questions before build

- Should a saved estimate always require an existing CRM account, or should quick "unlinked" estimates be allowed for cold prospects (recommended: allow unlinked, link later)?
- Should approval be required before a proposal PDF can be generated, or only before it is sent?
- Should `Project Crew Lead` / `Night Manager` be able to create estimates, or restrict creation to Owner / Office Manager / Operations Manager?
