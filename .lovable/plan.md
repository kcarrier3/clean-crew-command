# Weekly supply billing with one "Approve" button

## Goal
Julian (or any supply worker) records drop-offs as today. Every Monday, Nikki opens a **Supply Billing** screen, reviews last week's drop-offs, and clicks **Approve**. Each account gets one invoice for the week, emailed to its billing address. She does no follow-up and sees no other billing.

## What Nikki sees
- New **Supply Billing** page (in the Supplies area), visible only to people with the new permission.
- Defaults to **last week** (Sunday–Saturday, matching the pay week); a week picker lets her look at earlier weeks.
- One card per account: account name, billing email, each drop-off (date, item, quantity, price), subtotal. Sales tax is added when the invoice is created.
- Per drop-off: **Hold** (skip this week) or **Remove** (not billable).
- Warnings shown before approving, and those accounts are skipped instead of blocked:
  - no billing email on file
  - account has no county, so sales tax can't be worked out
- One **Approve** button. After it runs she sees a summary: "12 invoices sent, 1 skipped (no billing email)".

## What happens on Approve
1. For each account: create one invoice from that week's ready supply drop-offs (one line per drop-off). Sales tax and totals are calculated by the existing invoice rules.
2. Make the invoice PDF and email it to the billing email on file from the existing billing address, with the same template and logo as other invoices.
3. The drop-offs are marked invoiced (they leave Ready to Bill and lock, as today).
4. Clicking Approve twice, or two people approving at once, never sends a second invoice for the same drop-offs.

## Access
- New per-person permission **Approve Supply Billing**, set from Team → Edit. Turned on for Nikki.
- It only covers supply drop-offs. It does not open invoices, payments, A/R, contracts, credits or project billing. This is enforced in the database, not just by hiding screens.
- Office/Owner billing users keep full access. Supply invoices show up in their Invoices list for payments and follow-up.
- Optional later: a Monday-morning reminder to Nikki.

## Assumptions to confirm
- Week = Sunday–Saturday (same as pay period).
- Cleaning-supply drop-offs stay unbilled, as now.
- Until in-app billing starts, the QuickBooks "Billed in QB" button stays available.

## Technical details
- Enum value `approve_supply_billing` on `app_permission`; added to the Team permission checkboxes (`src/components/TeamRoster.tsx`) and `useAuth`.
- New edge function `approve-supply-billing` (service role internally). The caller must have the permission or `can_manage_billing`. Actions:
  - `preview(weekStart)`: ready `billing_events` with `source='supply_usage'`, completed in the week, grouped by `job_site_id` + billing email, with tax-readiness and email checks.
  - `create(weekStart, eventIds)`: inside one transaction per account, lock the events (`status='ready'` re-checked), insert `billing_invoices` + items, link events (`status='invoiced'`, `invoice_id`). The idempotency key is the sorted event ids.
  - `send(invoiceId, pdfBase64)`: only for invoices this flow created (all lines from supply events). It uploads the PDF to `invoice-documents` and sends through shared Resend send code, split out of `send-invoice-email` into `_shared/sendInvoice.ts` so both paths log to `billing_email_messages` and use the same template.
- The browser makes PDFs with the existing `src/lib/billing/invoicePdf.ts` from the data `create` returns, then calls `send` per invoice.
- New page `src/components/supply/SupplyBillingWeekly.tsx`. Hold/remove go through the same function, so no new table policies are opened to her.
- Tests: week boundaries, grouping per account, skip rules (no email / tax review), and a check that duplicate events are never billed twice.
