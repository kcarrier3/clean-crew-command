import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { Webhook } from 'npm:svix@1.24.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('RESEND_WEBHOOK_SECRET');

/** Maps Resend delivery events onto the billing email log. */
const EVENT_MAP: Record<string, { status: string; field?: string }> = {
  'email.sent': { status: 'sent', field: 'sent_at' },
  'email.delivered': { status: 'delivered', field: 'delivered_at' },
  'email.opened': { status: 'opened', field: 'opened_at' },
  'email.bounced': { status: 'bounced', field: 'failed_at' },
  'email.complained': { status: 'bounced', field: 'failed_at' },
  'email.delivery_delayed': { status: 'queued' },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const raw = await req.text();

  // Verification stays mandatory: without the secret we refuse rather than trust the caller.
  if (!WEBHOOK_SECRET) {
    console.error('RESEND_WEBHOOK_SECRET is not configured — rejecting webhook.');
    return new Response(JSON.stringify({ error: 'Webhook verification is not configured' }), {
      status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
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
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const providerMessageId = event?.data?.email_id ?? event?.data?.id ?? null;
  const mapped = EVENT_MAP[event?.type];
  if (!providerMessageId || !mapped) {
    return new Response(JSON.stringify({ ok: true, ignored: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const patch: Record<string, unknown> = {
    status: mapped.status,
    webhook_status: event.type,
    webhook_at: new Date().toISOString(),
  };
  if (mapped.field) patch[mapped.field] = new Date().toISOString();
  if (mapped.status === 'bounced') {
    patch.failure_reason = event?.data?.reason ?? event.type;
    patch.error_message = event?.data?.reason ?? event.type;
  }

  const { error } = await admin.from('billing_email_messages')
    .update(patch).eq('provider_message_id', providerMessageId);
  if (error) console.error('Webhook update failed:', error.message);

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});