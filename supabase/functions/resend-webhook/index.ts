const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, svix-id, svix-timestamp, svix-signature, idempotency-key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
};
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Webhook } from 'https://esm.sh/svix@1.24.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('RESEND_WEBHOOK_SECRET');

/**
 * Maps Resend delivery events onto the billing email log.
 * `rank` guards against out-of-order webhook delivery: a lower-ranked event
 * never overwrites a status the row has already progressed past.
 * Terminal failure states (bounced/complained/failed) always win.
 */
const EVENT_MAP: Record<
  string,
  { status: string; field?: string; rank: number; terminal?: boolean }
> = {
  'email.sent': { status: 'sent', field: 'sent_at', rank: 20 },
  'email.delivery_delayed': { status: 'queued', field: undefined, rank: 15 },
  'email.delivered': { status: 'delivered', field: 'delivered_at', rank: 30 },
  'email.opened': { status: 'opened', field: 'opened_at', rank: 40 },
  'email.clicked': { status: 'clicked', field: 'clicked_at', rank: 50 },
  'email.bounced': { status: 'bounced', field: 'failed_at', rank: 100, terminal: true },
  'email.complained': { status: 'complained', field: 'complained_at', rank: 100, terminal: true },
  'email.failed': { status: 'failed', field: 'failed_at', rank: 100, terminal: true },
};

/** Current row statuses ranked the same way, so we can compare before writing. */
const STATUS_RANK: Record<string, number> = {
  draft: 0,
  queued: 15,
  sent: 20,
  delivered: 30,
  opened: 40,
  clicked: 50,
  bounced: 100,
  complained: 100,
  failed: 100,
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const reasonFrom = (data: Record<string, any> | undefined, fallback: string): string => {
  if (!data) return fallback;
  const bounce = data.bounce ?? {};
  return (
    bounce.message ??
    bounce.reason ??
    data.reason ??
    data.message ??
    data.error ??
    fallback
  );
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const raw = await req.text();

  // Verification stays mandatory: without the secret we refuse rather than trust the caller.
  if (!WEBHOOK_SECRET) {
    console.error('RESEND_WEBHOOK_SECRET is not configured — rejecting webhook.');
    return json({ error: 'Webhook verification is not configured' }, 503);
  }

  let event: any;
  try {
    event = new Webhook(WEBHOOK_SECRET).verify(raw, {
      'svix-id': req.headers.get('svix-id') ?? '',
      'svix-timestamp': req.headers.get('svix-timestamp') ?? '',
      'svix-signature': req.headers.get('svix-signature') ?? '',
    });
  } catch (e) {
    console.error('Webhook signature verification failed:', (e as Error).message);
    return json({ error: 'Invalid signature' }, 401);
  }

  const data = event?.data ?? {};
  const providerMessageId = data.email_id ?? data.id ?? null;
  const mapped = EVENT_MAP[event?.type];

  // Unknown event types and unmatched payloads are acknowledged so Resend stops retrying.
  if (!providerMessageId || !mapped) {
    return json({ ok: true, ignored: true, type: event?.type ?? null });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  const { data: row, error: findError } = await admin
    .from('billing_email_messages')
    .select('id, status')
    .eq('provider_message_id', providerMessageId)
    .maybeSingle();

  if (findError) {
    console.error('Webhook lookup failed:', findError.message);
    return json({ error: 'Lookup failed' }, 500);
  }
  if (!row) {
    // Not a billing email — it may be an employee invitation.
    const { data: invite } = await admin
      .from('employee_invitations')
      .select('id, status')
      .eq('provider_message_id', providerMessageId)
      .maybeSingle();
    if (invite) {
      const cur = STATUS_RANK[invite.status] ?? 0;
      const p: Record<string, unknown> = { webhook_status: event.type };
      if (event.type === 'email.delivered') p.delivered_at = new Date().toISOString();
      if (mapped.terminal || mapped.rank > cur) p.status = mapped.status;
      if (mapped.terminal) p.error_message = reasonFrom(data, event.type);
      await admin.from('employee_invitations').update(p).eq('id', invite.id);
      return json({ ok: true, invitation: true, type: event.type });
    }
    console.warn(`No email log row for provider message ${providerMessageId}`);
    return json({ ok: true, unmatched: true });
  }

  const at = data.created_at ? new Date(data.created_at).toISOString() : new Date().toISOString();
  const currentRank = STATUS_RANK[row.status] ?? 0;

  const patch: Record<string, unknown> = {
    webhook_status: event.type,
    webhook_at: new Date().toISOString(),
  };

  // Timestamps are always recorded — they are per-event facts, not a status.
  if (mapped.field) patch[mapped.field] = at;

  // The status only moves forward (or to a terminal failure state).
  if (mapped.terminal || mapped.rank > currentRank) patch.status = mapped.status;

  if (mapped.terminal) {
    const reason = reasonFrom(data, event.type);
    patch.failure_reason = reason;
    patch.error_message = reason;
  }

  const { error } = await admin
    .from('billing_email_messages')
    .update(patch)
    .eq('id', row.id);

  if (error) {
    console.error('Webhook update failed:', error.message);
    return json({ error: 'Update failed' }, 500);
  }

  return json({ ok: true, type: event.type, status: patch.status ?? row.status });
});
