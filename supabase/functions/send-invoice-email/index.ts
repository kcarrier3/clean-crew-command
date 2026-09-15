import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

/** Sender defaults. Overridable by env, then by the saved Billing setting. */
const DEFAULT_FROM_EMAIL = Deno.env.get('BILLING_FROM_EMAIL') ?? 'invoices@billing.crewcompass360.com';
const DEFAULT_FROM_NAME = Deno.env.get('BILLING_FROM_NAME') ?? 'Crew Compass Billing';
const DEFAULT_REPLY_TO = Deno.env.get('BILLING_REPLY_TO_EMAIL') ?? null;

const SENDER_SETTING_KEY = 'billing_email_sender';
/** Secure invoice link lifetime (7 days). */
const LINK_TTL_SECONDS = 60 * 60 * 24 * 7;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

const emails = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(x => String(x).trim()).filter(isEmail) : [];

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

interface SenderConfig { from_email: string; from_name: string; reply_to: string | null }

const loadSender = async (admin: any): Promise<SenderConfig> => {
  const base: SenderConfig = {
    from_email: DEFAULT_FROM_EMAIL,
    from_name: DEFAULT_FROM_NAME,
    reply_to: DEFAULT_REPLY_TO,
  };
  const { data } = await admin.from('app_settings')
    .select('value').eq('key', SENDER_SETTING_KEY).maybeSingle();
  if (!data?.value) return base;
  try {
    const saved = JSON.parse(data.value);
    return {
      from_email: isEmail(String(saved.from_email ?? '')) ? String(saved.from_email) : base.from_email,
      from_name: String(saved.from_name ?? '').trim() || base.from_name,
      reply_to: isEmail(String(saved.reply_to ?? '')) ? String(saved.reply_to) : base.reply_to,
    };
  } catch {
    return base;
  }
};

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

  const sender = await loadSender(admin);
  const FROM = `${sender.from_name} <${sender.from_email}>`;

  // ---- Configuration probe --------------------------------------------------
  if (payload.action === 'status') {
    return json({
      configured: !!RESEND_API_KEY,
      provider: 'resend',
      from: FROM,
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

  // ---- Per-account reply-to overrides the global one ------------------------
  let replyTo = sender.reply_to;
  if (invoice.crm_company_id) {
    const { data: prefs } = await admin.from('billing_account_preferences')
      .select('reply_to_email').eq('crm_company_id', invoice.crm_company_id).maybeSingle();
    if (prefs?.reply_to_email && isEmail(prefs.reply_to_email)) replyTo = prefs.reply_to_email;
  }

  // ---- Secure, expiring link to the invoice PDF -----------------------------
  let secureLink: string | null = null;
  if (attachmentPath) {
    const { data: signed } = await admin.storage.from('invoice-documents')
      .createSignedUrl(attachmentPath, LINK_TTL_SECONDS);
    secureLink = signed?.signedUrl ?? null;
  }

  const finalBody = secureLink
    ? (body.includes('{{invoice_link}}')
        ? body.replaceAll('{{invoice_link}}', secureLink)
        : `${body}\n\nView or download your invoice (link expires in 7 days):\n${secureLink}`)
    : body.replaceAll('{{invoice_link}}', '');

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
    body: finalBody,
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

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#1f2937">
${escapeHtml(finalBody).replace(/\n/g, '<br/>')
    .replace(/(https:\/\/[^\s<]+)/g, '<a href="$1" style="color:#c2410c">$1</a>')}
</div>`;

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
        ...(replyTo ? { reply_to: replyTo } : {}),
        subject,
        text: finalBody,
        html,
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
