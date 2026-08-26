# Assistant intake API (`assistant-api`)

A server-side Supabase edge function that lets an authorized external assistant
(e.g. a ChatGPT custom action) search Waypoint opportunities and create estimates
using the same production tables as the in-app estimator (`estimates`,
`estimate_revisions`, `estimate_line_adders`).

No service key ever reaches a client. All privileged work happens inside the
edge function using the service role from the server environment.

**Endpoint**

```
POST https://<project-ref>.supabase.co/functions/v1/assistant-api
Content-Type: application/json
Authorization: Bearer <ASSISTANT_API_KEY>
x-idempotency-key: <optional, per logical request>
```

## Authentication

Two accepted credentials:

1. **Assistant API key** (recommended for external integrations) — an opaque
   secret issued per integration. Only its SHA-256 hash is stored, in
   `public.assistant_api_clients`, along with the staff user the assistant acts
   as (`actor_user_id`). That table is service-role only; no app user can read it.
2. **Staff Supabase JWT** — a signed-in Crew Compass user's access token. Useful
   for testing from the app.

Either way the resolved actor must pass `public.can_estimate(actor)`, so
assistant writes obey the same permission rules as the UI. Disabled clients
(`enabled = false`) are rejected.

### Issuing a key

Generate a random secret, store only its hash:

```sql
-- key = the plaintext you give the integration (store it in a password manager)
insert into public.assistant_api_clients (label, key_hash, key_prefix, actor_user_id)
values (
  'ChatGPT assistant',
  encode(digest('<PLAINTEXT_KEY>', 'sha256'), 'hex'),
  left('<PLAINTEXT_KEY>', 8),
  '<staff-user-uuid-with-estimating-rights>'
);
```

Revoke by setting `enabled = false` or deleting the row.

## Action: `search_opportunities`

Narrow read used to resolve the parent record before creating anything.

```json
{
  "action": "search_opportunities",
  "opportunity_name": "Metro Health",
  "city": "Cleveland",
  "state": "OH",
  "limit": 10
}
```

Accepts `opportunity_id`, `opportunity_name`, or `account_name`; `city`/`state`
filter through the linked account.

```json
{
  "ok": true,
  "count": 1,
  "matches": [
    {
      "opportunity_id": "uuid",
      "opportunity_name": "MetroHealth CSP 1039",
      "account_id": "uuid",
      "account_name": "MetroHealth",
      "city": "Cleveland",
      "state": "OH",
      "status": "qualified",
      "amount": 20000
    }
  ]
}
```

## Action: `create_estimate`

```json
{
  "action": "create_estimate",
  "opportunity_id": "uuid",
  "opportunity_name": "MetroHealth CSP 1039",
  "account_name": "MetroHealth",
  "city": "Cleveland",
  "state": "OH",
  "service_type": "janitorial",
  "title": "MetroHealth — Janitorial",
  "description": "Nightly service, 5x/week",
  "notes": "Quoted from RFP packet",
  "square_feet": 24000,
  "line_items": [
    {
      "description": "Nightly cleaning",
      "kind": "labor",
      "quantity": 1,
      "hours": 120,
      "rate": 26.8,
      "amount": 3216,
      "cost": 2100,
      "frequency": "monthly"
    }
  ],
  "source_file": { "name": "rfp.pdf", "url": "https://…", "mime_type": "application/pdf" },
  "idempotency_key": "rfp-1039-v1"
}
```

`service_type` is one of `janitorial`, `construction_cleaning`, `carpet_cleaning`,
`floor_scrubbing`, `vct_strip_wax` (defaults to `janitorial`). `amount` defaults to
`quantity * rate` when omitted. Unspecified pricing columns keep their database
defaults so the estimate opens cleanly in the estimator UI.

**Success — 201**

```json
{
  "ok": true,
  "estimate_id": "uuid",
  "revision_id": "uuid",
  "line_item_ids": ["uuid"],
  "opportunity_id": "uuid",
  "account_id": "uuid",
  "source": "chatgpt_assistant",
  "summary": "Created draft janitorial estimate \"MetroHealth — Janitorial\" on opportunity \"MetroHealth CSP 1039\" with 1 line item(s) totaling $3216.00.",
  "url_path": "/estimating/<uuid>"
}
```

**Errors**

| Status | Body `error` | Meaning |
| --- | --- | --- |
| 400 | validation message | Bad JSON, unknown action, or no lookup criteria |
| 401 | `Invalid credentials` | Missing/unknown bearer token |
| 403 | permission message | Actor may not create estimates |
| 404 | `no_match` | No opportunity matched |
| 409 | `ambiguous_match` | More than one match — `matches[]` returned so the assistant can pick and retry with `opportunity_id` |
| 409 | in-progress message | Same idempotency key still running |
| 500 | database message | Write failed |

## Idempotency

Send `x-idempotency-key` (or `idempotency_key` in the body) on `create_estimate`.
The key is reserved in `public.assistant_request_log` before any write. A retry
with the same key returns the original response with `"idempotent_replay": true`
instead of creating a second estimate. Failed attempts release the key so a
corrected retry can proceed.

## Auditing

Every assistant request is written to `public.assistant_request_log` with the
client, actor, action, request/response payloads, created record IDs, and
`source = 'chatgpt_assistant'`. Estimates created this way also carry
`estimates.source = 'chatgpt_assistant'` plus `estimates.source_metadata`
(integration label, description, source file metadata). Owners, admins and
managers can read the log; only the service role can write it.

## Deployment / configuration

1. The function deploys automatically with the project. `SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY` are provided by the platform — no extra secrets.
2. `verify_jwt = false` in `supabase/config.toml`: the function validates the
   API key or JWT in code (a raw assistant key is not a Supabase JWT).
3. Insert an `assistant_api_clients` row per integration (see above) and hand the
   plaintext key to the assistant as a bearer token.
4. Point the assistant's action schema at the endpoint URL above.
