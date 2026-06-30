# CRM Build Plan

A focused CRM for Owner + Admin only, sharing data with your existing Accounts so a won deal becomes a real job site in one click. External CRM sync (HubSpot/Pipedrive/Zoho/Salesforce) is wired in as a Phase 2 add-on once the core works.

## Scope (v1)

**In:** Leads, Contacts, Deals (kanban pipeline), Activities + reminders, Quotes/estimates (PDF), convert-to-Account.
**Out (Phase 2+):** Email send/track from inside the app, external CRM two-way sync, marketing automation.

## Data model

New tables (all gated to Owner + Admin via `has_role` RLS):

- **`crm_leads`** — `company_name`, `contact_name`, `email`, `phone`, `source`, `status` (new/contacted/qualified/unqualified/converted), `notes`, `assigned_to`, `created_by`
- **`crm_deals`** — `name`, `lead_id` (nullable), `account_id` (nullable, links to existing `job_sites` once converted), `stage` (prospect/quoted/negotiation/won/lost), `value`, `expected_close_date`, `probability`, `owner_id`, `lost_reason`
- **`crm_pipeline_stages`** — configurable stage list so you can rename/reorder later without code changes
- **`crm_activities`** — `deal_id` or `lead_id`, `type` (call/email/meeting/note/task), `subject`, `body`, `due_at`, `completed_at`, `owner_id`. Drives the follow-up reminder feed.
- **`crm_quotes`** — `deal_id`, `quote_number`, `status` (draft/sent/accepted/rejected), `subtotal`, `tax`, `total`, `valid_until`, `terms`
- **`crm_quote_items`** — `quote_id`, `description`, `quantity`, `unit_price`, `line_total`

All tables get GRANTs + RLS limiting access to users with `admin` role or `Owner`/`Administrator` job title.

## UI

A new **CRM** top-level tab visible only to Owner/Admin, with sub-tabs:

1. **Pipeline** — Kanban board, drag deals between stages, totals per column. Card shows deal name, value, owner avatar, days-in-stage.
2. **Leads** — Table with filters (status, source, owner), quick-add form, "Convert to Deal" action.
3. **Deal detail page** — Header (value, stage, close date), tabs for Activities, Quotes, Files, linked Contacts. "Mark Won" prompts to convert into a Job Site (prefilling name/address/contact).
4. **Activities feed** — "My follow-ups today / overdue / this week" on the CRM dashboard, plus a bell-icon reminder count.
5. **Quote builder** — Line-item editor, live total, "Generate PDF" button, "Send to client" (email is Phase 2 — for now it downloads/copies a shareable link).

## Quotes PDF

Generated client-side with `jspdf` + `jspdf-autotable` (no extra backend needed). Branded with the Crew Compass logo.

## Activity reminders

A daily cron (Supabase `pg_cron` + edge function) emails/pushes overdue follow-ups to the deal owner. Reuses your existing `send-push-notification` function.

## Convert flow

When a deal moves to **Won**, a dialog asks: *"Create a Job Site from this deal?"* → opens the existing New Account form prefilled from the deal/lead/contact, then links `crm_deals.account_id` so revenue is traceable.

## Phase 2 (after v1 ships)

- **External CRM sync** via the Lovable connector gateway — your existing connection list shows HubSpot, Pipedrive, Zoho, Salesforce are all available. Direction (one-way pull vs. two-way) and which entities to sync (contacts only? deals?) is a separate conversation once you pick the provider.
- **Email send/track** (SendGrid or your Microsoft 365/Google account).
- **Reporting** — win rate, avg deal size, conversion %, source ROI.

## Technical notes

- All CRM tables protected with `has_role(auth.uid(), 'admin')` policies; managers/crew won't even see the CRM tab (route guard + RLS).
- Stages stored in a config table so you can edit pipeline labels without a migration.
- Deal ↔ Job Site link is bidirectional so the Accounts page can show "Originated from Deal #123."
- Drag-and-drop kanban uses `@dnd-kit/core` (already in your stack).
- Quote PDFs render with the same branding/colors as the rest of the app.

## What I need from you to start

1. **Approval to create the CRM tables** (migration with the schema above).
2. **Pipeline stages** — confirm or edit: Prospect → Contacted → Quoted → Negotiation → Won / Lost.
3. **Lead sources** — give me a starter list (referral, website, cold call, walk-in, repeat client, other?) so the dropdown is useful out of the gate.

Once you approve, I'll ship v1 in stages: tables → Leads + Deals + Pipeline → Activities/reminders → Quote builder. You'll see each piece working before I move to the next.