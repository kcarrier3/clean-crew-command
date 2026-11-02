// Shared invoice email delivery used by send-invoice-email and approve-supply-billing.
// Every attempt is logged in billing_email_messages and only counts as sent when Resend accepts it.
import {
  BILLING_FROM_EMAIL,
  BRAND_ORANGE,
  COMPANY_NAME,
  INVOICE_LOGO_CID,
  invoiceEmailHtml,
  omitBlankPoLine,
  withUnmonitoredNotice,
} from './company.ts';
import { SUMMIT_LOGO_BASE64, SUMMIT_LOGO_MIME } from './summitLogoBase64.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

/** Sender defaults. BILLING_FROM_NAME and BILLING_REPLY_TO_EMAIL override these; neither is set here. */
const DEFAULT_FROM_EMAIL = Deno.env.get('BILLING_FROM_EMAIL') ?? BILLING_FROM_EMAIL;
const DEFAULT_FROM_NAME = Deno.env.get('BILLING_FROM_NAME') ?? COMPANY_NAME;
const DEFAULT_REPLY_TO = Deno.env.get('BILLING_REPLY_TO_EMAIL')?.trim() || null;

const SENDER_SETTING_KEY = 'billing_email_sender';
/** Secure invoice link lifetime (7 days). */
const LINK_TTL_SECONDS = 60 * 60 * 24 * 7;

export const INVOICE_PDF_BUCKET = 'invoice-documents';

export const isEmailConfigured = () => !!RESEND_API_KEY;

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export const emails = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(x => String(x).trim()).filter(isEmail) : [];

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface SenderConfig { from_email: string; from_name: string; reply_to: string | null }

// deno-lint-ignore no-explicit-any
export const loadSender = async (admin: any): Promise<SenderConfig> => {
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

export const DEFAULT_INVOICE_SUBJECT = 'Invoice {{invoice_number}} from {{company_name}}';

export const DEFAULT_INVOICE_BODY = `Hello {{billing_contact_first_name}},

Please find attached invoice {{invoice_number}} from {{company_name}} for {{customer_name}}.

Invoice number: {{invoice_number}}
Invoice date: {{invoice_date}}
Amount due: {{invoice_total}}
Due date: {{due_date}}
PO number: {{po_number}}

View or download your invoice here (secure link, expires in 7 days):
{{invoice_link}}

Thank you for your business,
{{company_name}} — Billing`;

export const renderTemplate = (tpl: string, vars: Record<string, string>) =>
  tpl.replace(/\{\{(\w+)\}\}/g, (m, k: string) => (k in vars ? vars[k] : m));

export interface DeliverParams {
  invoice: { id: string; invoice_number: string; crm_company_id: string | null; crm_lead_id: string | null };
  to: string[];
  cc: string[];
  subject: string;
  body: string;
  attachmentPath: string | null;
  idempotencyKey: string | null;
  templateKey?: string | null;
  createdBy: string | null;
}

export interface DeliverResult { status: number; body: Record<string, unknown> }

// deno-lint-ignore no-explicit-any
export const deliverInvoiceEmail = async (admin: any, p: DeliverParams): Promise<DeliverResult> => {
  const { invoice, to, cc, subject, body, attachmentPath, idempotencyKey } = p;
  const sender = await loadSender(admin);
  const FROM = `${sender.from_name} <${sender.from_email}>`;

  // ---- Idempotency: one log row per intended send ---------------------------
  if (idempotencyKey) {
    const { data: existing } = await admin.from('billing_email_messages')
      .select('id, status, provider_message_id')
      .eq('idempotency_key', idempotencyKey).maybeSingle();
    if (existing && existing.status !== 'draft' && existing.status !== 'failed') {
      return {
        status: 200,
        body: {
          ok: existing.status === 'sent',
          duplicate: true,
          messageId: existing.id,
          providerMessageId: existing.provider_message_id,
        },
      };
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
    const { data: signed } = await admin.storage.from(INVOICE_PDF_BUCKET)
      .createSignedUrl(attachmentPath, LINK_TTL_SECONDS);
    secureLink = signed?.signedUrl ?? null;
  }

  const linkedBody = secureLink
    ? (body.includes('{{invoice_link}}')
        ? body.replaceAll('{{invoice_link}}', secureLink)
        : `${body}\n\nView or download your invoice (link expires in 7 days):\n${secureLink}`)
    : body.replaceAll('{{invoice_link}}', '');

  const applyCompany = (text: string) => text
    .replaceAll('{{company_name}}', COMPANY_NAME)
    .replaceAll('{{company_contact}}', COMPANY_NAME);

  const mailedSubject = applyCompany(subject);
  const finalBody = withUnmonitoredNotice(omitBlankPoLine(applyCompany(linkedBody)), replyTo);

  const notConfigured = !RESEND_API_KEY;

  // A failed earlier attempt with the same key is retried under a fresh log row.
  const logKey = idempotencyKey;
  if (logKey) {
    await admin.from('billing_email_messages')
      .update({ idempotency_key: null })
      .eq('idempotency_key', logKey).in('status', ['draft', 'failed']);
  }

  const { data: logRow, error: logErr } = await admin.from('billing_email_messages').insert({
    invoice_id: invoice.id,
    crm_company_id: invoice.crm_company_id,
    crm_lead_id: invoice.crm_lead_id,
    template_key: p.templateKey ?? 'invoice_default',
    message_kind: 'invoice',
    to_recipients: to,
    cc_recipients: cc,
    subject: mailedSubject,
    body: finalBody,
    attachment_path: attachmentPath,
    attachment_paths: attachmentPath ? [attachmentPath] : [],
    idempotency_key: logKey,
    status: notConfigured ? 'draft' : 'queued',
    provider: notConfigured ? null : 'resend',
    queued_at: notConfigured ? null : new Date().toISOString(),
    created_by: p.createdBy,
  }).select().single();

  if (logErr) {
    console.error('Could not log email attempt:', logErr.message);
    return { status: 500, body: { error: logErr.message } };
  }

  if (notConfigured) {
    return {
      status: 200,
      body: {
        ok: false,
        configured: false,
        messageId: logRow.id,
        error: 'Email sending is not configured yet. Add RESEND_API_KEY and a verified sending domain in Billing → Settings.',
      },
    };
  }

  // ---- Attachment -----------------------------------------------------------
  let attachment: { filename: string; content: string } | null = null;
  if (attachmentPath) {
    const { data: file, error: dlErr } = await admin.storage.from(INVOICE_PDF_BUCKET).download(attachmentPath);
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
  const fail = async (reason: string, status = 502): Promise<DeliverResult> => {
    await admin.from('billing_email_messages').update({
      status: 'failed',
      failed_at: new Date().toISOString(),
      failure_reason: reason,
      error_message: reason,
    }).eq('id', logRow.id);
    return { status, body: { ok: false, messageId: logRow.id, error: reason } };
  };

  const html = invoiceEmailHtml(
    escapeHtml(finalBody).replace(/\n/g, '<br/>')
      .replace(/(https:\/\/[^\s<]+)/g, `<a href="$1" style="color:${BRAND_ORANGE};font-weight:bold">$1</a>`),
  );
  const logoAttachment = {
    filename: 'summit-logo.png',
    content: SUMMIT_LOGO_BASE64,
    content_type: SUMMIT_LOGO_MIME,
    content_id: INVOICE_LOGO_CID,
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
        ...(replyTo ? { reply_to: replyTo } : {}),
        subject: mailedSubject,
        text: finalBody,
        html,
        attachments: [...(attachment ? [attachment] : []), logoAttachment],
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
    .eq('id', invoice.id)
    .in('status', ['draft', 'ready']);

  await admin.from('billing_invoice_history').insert({
    invoice_id: invoice.id,
    event_type: 'emailed',
    detail: `Emailed to ${to.join(', ')}`,
  });

  return { status: 200, body: { ok: true, messageId: logRow.id, providerMessageId: result?.id ?? null } };
};
