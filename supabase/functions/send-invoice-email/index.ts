const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, svix-id, svix-timestamp, svix-signature, idempotency-key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
};
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { deliverInvoiceEmail, emails, isEmailConfigured, loadSender } from '../_shared/invoiceEmail.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // ---- Caller must be a signed-in billing user ------------------------------
  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  const user = userData?.user;
  if (!user) return json({ error: 'Not signed in' }, 401);

  const { data: allowed } = await userClient.rpc('can_manage_billing', { _user_id: user.id });
  if (!allowed) return json({ error: 'You do not have billing permissions' }, 403);

  // deno-lint-ignore no-explicit-any
  let payload: any = {};
  try { payload = await req.json(); } catch { payload = {}; }

  // ---- Configuration probe --------------------------------------------------
  if (payload.action === 'status') {
    const sender = await loadSender(admin);
    return json({
      configured: isEmailConfigured(),
      provider: 'resend',
      from: `${sender.from_name} <${sender.from_email}>`,
      from_email: sender.from_email,
      from_name: sender.from_name,
      reply_to: sender.reply_to,
    });
  }

  const invoiceId = typeof payload.invoiceId === 'string' ? payload.invoiceId : '';
  const to = emails(payload.to);
  const cc = emails(payload.cc);
  const subject = String(payload.subject ?? '').trim();
  const body = String(payload.body ?? '').trim();
  const attachmentPath = payload.attachmentPath ? String(payload.attachmentPath) : null;
  const idempotencyKey = payload.idempotencyKey ? String(payload.idempotencyKey) : null;

  if (!invoiceId) return json({ error: 'invoiceId is required' }, 400);
  if (!to.length) return json({ error: 'At least one valid recipient email is required' }, 400);
  if (!subject) return json({ error: 'Subject is required' }, 400);
  if (!body) return json({ error: 'Message body is required' }, 400);

  const { data: invoice } = await admin.from('billing_invoices')
    .select('id, invoice_number, crm_company_id, crm_lead_id').eq('id', invoiceId).maybeSingle();
  if (!invoice) return json({ error: 'Invoice not found' }, 404);

  const result = await deliverInvoiceEmail(admin, {
    invoice, to, cc, subject, body, attachmentPath, idempotencyKey,
    templateKey: payload.templateKey ?? 'invoice_default',
    createdBy: user.id,
  });
  return json(result.body, result.status);
});
