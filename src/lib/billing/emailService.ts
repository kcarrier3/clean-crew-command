/**
 * Provider-agnostic invoice email delivery.
 *
 * Nothing is sent today: no provider is configured, so `send()` refuses in a
 * clearly labelled way and records the attempt. Plugging in Resend / Postmark /
 * SendGrid / SES later means registering a provider here — the Billing module
 * only ever talks to this interface.
 */
import { supabase } from '@/integrations/supabase/client';

export interface EmailMessageDraft {
  invoice_id: string;
  crm_lead_id?: string | null;
  template_key?: string | null;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  attachment_paths?: string[];
}

export interface SendResult {
  ok: boolean;
  provider: string | null;
  providerMessageId?: string | null;
  error?: string;
}

export interface EmailProvider {
  name: string;
  isConfigured(): boolean;
  send(draft: EmailMessageDraft): Promise<SendResult>;
}

/** Placeholder used until a real vendor is wired up. */
const notConfiguredProvider: EmailProvider = {
  name: 'none',
  isConfigured: () => false,
  send: async () => ({
    ok: false,
    provider: null,
    error: 'No email provider is configured. Connect Resend, Postmark, SendGrid or SES in Billing → Settings.',
  }),
};

let activeProvider: EmailProvider = notConfiguredProvider;

/** Later: registerEmailProvider(resendProvider) — no billing code changes needed. */
export const registerEmailProvider = (p: EmailProvider) => { activeProvider = p; };
export const getEmailProvider = () => activeProvider;
export const isEmailConfigured = () => activeProvider.isConfigured();

export const EMAIL_TEMPLATE_VARIABLES = [
  '{{customer_name}}', '{{invoice_number}}', '{{project_name}}', '{{amount}}',
  '{{due_date}}', '{{po_number}}', '{{company_name}}', '{{company_contact}}',
] as const;

export const renderTemplate = (tpl: string, vars: Record<string, string>) =>
  tpl.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => vars[k] ?? '');

/** Persist a delivery attempt and try the active provider. Always auditable. */
export const sendInvoiceEmail = async (draft: EmailMessageDraft): Promise<SendResult> => {
  const { data: user } = await supabase.auth.getUser();
  const configured = activeProvider.isConfigured();

  const { data: row, error } = await (supabase as any)
    .from('billing_email_messages')
    .insert({
      invoice_id: draft.invoice_id,
      crm_lead_id: draft.crm_lead_id ?? null,
      template_key: draft.template_key ?? null,
      to_recipients: draft.to,
      cc_recipients: draft.cc ?? [],
      bcc_recipients: draft.bcc ?? [],
      subject: draft.subject,
      body: draft.body,
      attachment_paths: draft.attachment_paths ?? [],
      status: configured ? 'queued' : 'draft',
      provider: configured ? activeProvider.name : null,
      queued_at: configured ? new Date().toISOString() : null,
      created_by: user?.user?.id ?? null,
    })
    .select()
    .maybeSingle();

  if (error) return { ok: false, provider: null, error: error.message };

  const result = await activeProvider.send(draft);

  await (supabase as any).from('billing_email_messages').update({
    status: result.ok ? 'sent' : configured ? 'failed' : 'draft',
    provider: result.provider,
    provider_message_id: result.providerMessageId ?? null,
    error_message: result.error ?? null,
    sent_at: result.ok ? new Date().toISOString() : null,
  }).eq('id', row?.id);

  if (result.ok) {
    await (supabase as any).from('billing_invoices')
      .update({ sent_at: new Date().toISOString(), status: 'sent' })
      .eq('id', draft.invoice_id);
  }

  return result;
};

/**
 * Future delivery kinds — reminders, statements, overdue notices, receipts and
 * credit memos all route through the same provider interface when enabled.
 */
export const FUTURE_EMAIL_HOOKS = [
  'invoice_reminder', 'statement', 'overdue_notice', 'payment_receipt', 'credit_memo',
] as const;