# Training Planner and New Account Calendar

## Training Planner
- Add a separate **Training Planner** module with month, week, and upcoming-session views.
- Each session requires a worker, an assigned training manager, an existing account/location, a date, and start/end times; include optional notes.
- Saving a session creates a linked, one-day **draft shift** in Schedule. Editing it updates that same shift rather than creating duplicates.
- Training still requires **Publish** through the existing weekly Schedule workflow. Adding or changing training after a week was published must require publishing that training again, without hiding unrelated shifts.
- Display the worker, training manager, account, times, and Draft/Published status on calendar entries. Remove a session and its linked training shift together with confirmation; preserve any attendance records and prevent removal when attendance already exists.

## Manager dashboard
- Add **My Training This Week**, showing only sessions assigned to the signed-in manager, grouped by date with worker, account, and times.
- Show draft and published status so managers can prepare before publishing.
- Use Sunday–Saturday for the dashboard's weekly lookahead, matching the existing dashboard period.

## New Account Calendar
- Add a separate **New Account Calendar** module for managers, with a shared month view and upcoming-account list.
- Each entry requires an account already created under **Accounts → Account Management** and a planned start date. Include optional manager and launch notes.
- Use a searchable existing-account selector; do not allow free-text accounts or create accounts from this calendar.
- Allow managers to update or remove calendar entries without deleting the account. These entries are informational: they do not create shifts or change budgets, contracts, or billing.

## Access and availability
- Add both modules to the existing company-wide module switches and desktop/mobile navigation.
- Managers can view both calendars. Training edits require existing schedule-edit authority; Project Crew Leads remain unable to create, edit, delete, or publish training shifts.
- Publishing keeps the existing publish permission. Manager selections are validated against actual manager/admin role records.
- Preserve existing Planning Calendar permissions and training-course assignments/progress; these new calendars are separate from both.

## Technical approach
- Add dedicated training-session and new-account-calendar tables with explicit API grants, authenticated access policies, and required existing-account references.
- Keep training sessions and their linked employee schedules synchronized transactionally; validate worker, manager, account, time range, and duplicate submissions server-side.
- Add per-session publication tracking integrated into the existing weekly Publish action. Enforce unpublished training visibility on the server and across worker schedule/clock surfaces, including future weeks and edits after publication, without changing ordinary shift permissions.
- Reuse existing calendar/date controls and semantic styling; use separate focused calendar and dashboard components.

## Verification and delivery
- Test required worker/manager/account fields, valid manager assignment, draft-to-published behavior, edits after publishing, linked-shift synchronization, weekly dashboard filtering, and Project Crew Lead restrictions.
- Verify the new tables and policies were applied, then exercise calendar creation → linked draft shift → publishing → worker schedule and manager dashboard.
- Check desktop and phone layouts. Authenticated end-to-end testing may be limited by this external Supabase project's available session; report any unverified steps explicitly.
- Do not publish the app or send training notifications as part of this work.