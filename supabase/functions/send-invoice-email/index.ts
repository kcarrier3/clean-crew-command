import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM = Deno.env.get('BILLING_FROM_EMAIL')
  ?? 'Summit Facilities Group Billing <billing@summitfacilitiesgroup.com>';
const REPLY_TO = Deno.env.get('BILLING_REPLY_TO_EMAIL') ?? null;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const emails = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.map(x => String(x).trim()).filter(x => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x))
    : [];

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

  let payload: any = {};
  try { payload = await req.json(); } catch { payload = {}; }

  // ---- Configuration probe --------------------------------------------------
  if (payload.action === 'status') {
    return json({ configured: !!RESEND_API_KEY, provider: 'resend', from: FROM, reply_to: REPLY_TO });
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

  // ---- Idempotency: one log row per intended send ---------------------------
  if (idempotencyKey) {
    const { data: existing } = await admin.from('billing_email_messages')
      .select('id, status, provider_message_id')
      .eq('idempotency_key', idempotencyKey).maybeSingle();
    if (existing && existing.status !== 'draft') {
      return json({
        ok: existing.status === 'sent',
        duplicate: true,
        messageId: existing.id,
        providerMessageId: existing.provider_message_id,
      });
    }
  }

  const notConfigured = !RESEND_API_KEY;

  const { data: logRow, error: logErr } = await admin.from('billing_email_messages').insert({
    invoice_id: invoiceId,
    crm_company_id: invoice.crm_company_id,
    crm_lead_id: invoice.crm_lead_id,
    template_key: payload.templateKey ?? 'invoice_default',
    message_kind: 'invoice',
    to_recipients: to,
    cc_recipients: cc,
    subject,
    body,
    attachment_path: attachmentPath,
    attachment_paths: attachmentPath ? [attachmentPath] : [],
    idempotency_key: idempotencyKey,
    status: notConfigured ? 'draft' : 'queued',
    provider: notConfigured ? null : 'resend',
    queued_at: notConfigured ? null : new Date().toISOString(),
    created_by: user.id,
  }).select().single();

  if (logErr) {
    console.error('Could not log email attempt:', logErr.message);
    return json({ error: logErr.message }, 500);
  }

  if (notConfigured) {
    return json({
      ok: false,
      configured: false,
      messageId: logRow.id,
      error: 'Email sending is not configured yet. Add RESEND_API_KEY and a verified sending domain in Billing → Settings.',
    });
  }

  // ---- Attachment -----------------------------------------------------------
  let attachment: { filename: string; content: string } | null = null;
  if (attachmentPath) {
    const { data: file, error: dlErr } = await admin.storage.from('invoice-documents').download(attachmentPath);
    if (dlErr || !file) {
      console.error('Attachment download failed:', dlErr?.message);
    } else {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      attachment = {
        filename: `Invoice-${invoice.invoice_number}.pdf`,
        content: btoa(binary),
      };
    }
  }

  // ---- Send via Resend ------------------------------------------------------
  const fail = async (reason: string, status = 502) => {
    await admin.from('billing_email_messages').update({
      status: 'failed',
      failed_at: new Date().toISOString(),
      failure_reason: reason,
      error_message: reason,
    }).eq('id', logRow.id);
    return json({ ok: false, messageId: logRow.id, error: reason }, status);
  };

  let response: Response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM,
        to,
        ...(cc.length ? { cc } : {}),
        ...(REPLY_TO ? { reply_to: REPLY_TO } : {}),
        subject,
        text: body,
        ...(attachment ? { attachments: [attachment] } : {}),
      }),
    });
  } catch (e) {
    return await fail(`Could not reach the email provider: ${(e as Error).message}`);
  }

  if (!response.ok) {
    const detail = await response.text();
    console.error(`Resend request failed [${response.status}]: ${detail}`);
    return await fail(`Provider rejected the message [${response.status}]: ${detail}`, response.status);
  }

  const result = await response.json();

  await admin.from('billing_email_messages').update({
    status: 'sent',
    provider: 'resend',
    provider_message_id: result?.id ?? null,
    sent_at: new Date().toISOString(),
  }).eq('id', logRow.id);

  await admin.from('billing_invoices')
    .update({ sent_at: new Date().toISOString(), status: 'sent' })
    .eq('id', invoiceId)
    .in('status', ['draft', 'ready']);

  await admin.from('billing_invoice_history').insert({
    invoice_id: invoiceId,
    event_type: 'emailed',
    detail: `Emailed to ${to.join(', ')}`,
  });

  return json({ ok: true, messageId: logRow.id, providerMessageId: result?.id ?? null });
});