## Goal

Replace the current top-tab navigation on the web (desktop) experience with a collapsible left icon sidebar, add a new draft-planning **Calendar** module, and stub out a **Supply Management** module for later.

Mobile (and the native app) keep the bottom-bar navigation we just shipped — no change there.

## 1. New left sidebar (desktop only)

Built with the shadcn `Sidebar` component, `collapsible="icon"` so it shrinks to a 56px icon rail. The header gets a `SidebarTrigger` so users can collapse/expand.

Top-level icons (flatter grouping per your pick), shown only if the user has access:

| Icon | Label | Opens |
|---|---|---|
| Home | Dashboard | Manager or Employee dashboard (role-based) |
| CalendarDays | Schedule | Scheduling (managers) / My Schedule (crew) |
| CalendarRange | Calendar | NEW draft planning calendar (managers + admins) |
| PlaneTakeoff | Time Off | Time-off requests |
| BookOpen | Manager Log | Manager log (managers) |
| FileSpreadsheet | Payroll | Payroll Reports (admins/owner) |
| MapPin | Accounts | Job sites |
| ClipboardCheck | Quality Control | QC dashboard (pulled out of Accounts as its own page) |
| Users | Team | Team management (canManageEmployees) |
| Briefcase | CRM | CRM dashboard (CRM users) |
| Package | Supplies | NEW stub page |
| MessageSquare | Messages | Messaging center |
| FileText | Onboarding | Onboarding center / manager review |

The user avatar / sign-out / change password / delete account live at the bottom of the sidebar in a footer popover, replacing the top-right dropdown.

NotificationBell stays in the top header alongside the SidebarTrigger.

## 2. Calendar module (new)

A monthly/weekly view where managers draft shifts and events before promoting them into the real schedule.

**New table `calendar_drafts`:**
- `id`, `created_by`, `created_at`, `updated_at`
- `title`, `notes`
- `start_at` (timestamptz), `end_at` (timestamptz), `all_day` (bool)
- `kind` enum: `shift_draft`, `event`, `holiday`, `note`
- `employee_id` (nullable, references profiles)
- `job_site_id` (nullable, references job_sites)
- `color` (text, optional swatch)
- `promoted_schedule_id` (nullable, references employee_schedules) — set when promoted
- RLS: managers/admins can read/write; service_role full access.

**UI (`src/components/CalendarPlanner.tsx`):**
- Month grid + week view toggle (built with date-fns; no extra calendar lib needed for v1)
- Click a day → "Add draft" dialog (kind, title, employee, job site, time range)
- Click an existing draft → edit/delete
- Color legend by `kind`
- **Promote button** on any `shift_draft` (or "Promote all this week"): creates rows in `employee_schedules` from the selected drafts, sets `promoted_schedule_id`, and marks the draft as promoted (shown dimmed/checked). Idempotent: promoting again is a no-op.
- Filter chips: by employee, by job site, by kind.

Google Calendar sync is **not** in scope for this pass; we'll add it as a follow-up if you want it.

## 3. Supply Management stub

`src/components/SupplyManagement.tsx` renders a "Coming soon" page with the planned feature list (inventory, reorder points, supply requests, per-account allocation) and a "Notify me when ready" CTA that just toasts. Icon shows in the sidebar so it's discoverable.

## 4. Mobile / native app

No behavior change. The new Calendar and Supply icons are **web-only** (hidden via the `isNativeApp` flag we just added).

## 5. Cleanup

- Pull Quality Control out of `JobSitesManagement` as its own top-level page (still backed by `QualityControlDashboard`). The Accounts tab inside JobSites stays for everything else.
- Remove the existing top `TabsList` from `src/pages/Index.tsx`; tab routing stays but the trigger UI is replaced by the sidebar. (Active tab driven by sidebar `NavLink` style, with state persisted in URL hash so refresh keeps you in place.)

## Technical notes

- New file: `src/components/layout/AppSidebar.tsx` using `Sidebar`, `SidebarContent`, `SidebarGroup`, `SidebarMenu`, `SidebarFooter`.
- New file: `src/components/CalendarPlanner.tsx` + `src/components/calendar/DraftDialog.tsx`.
- New file: `src/components/SupplyManagement.tsx` (stub).
- Migration: create `calendar_drafts` + enum + GRANTs + RLS + trigger to keep `updated_at` fresh.
- `src/pages/Index.tsx`: wrap content in `SidebarProvider`, render `AppSidebar` on `md:` and up, keep mobile bottom-bar untouched.
- `useAuth` gains no new permissions; sidebar uses existing `isManager`, `canManageEmployees`, `isCrmUser` checks. Payroll icon gated by admin/owner role like today.

## What I'll ask you to approve

One database migration (the `calendar_drafts` table and enum). I'll request that approval first, then ship the UI in the same response.
