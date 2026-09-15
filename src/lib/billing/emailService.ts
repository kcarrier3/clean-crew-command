/**
 * Invoice email delivery.
 *
 * Every send goes through the `send-invoice-email` edge function so the provider
 * API key never reaches the browser. The function logs each attempt in
 * `billing_email_messages` and only reports success when the provider accepts
 * the message. Until RESEND_API_KEY and a verified sending domain are
 * configured, sends come back as "not configured" instead of failing hard.
 */
import { supabase } from '@/integrations/supabase/client';
import { FunctionsHttpError } from '@supabase/supabase-js';

export const INVOICE_PDF_BUCKET = 'invoice-documents';
export const SENDER_SETTING_KEY = 'billing_email_sender';

export const DEFAULT_SENDER = {
  from_email: 'invoices@billing.crewcompass360.com',
  from_name: 'Crew Compass Billing',
  reply_to: '' as string,
};

export interface SenderSettings {
  from_email: string;
  from_name: string;
  reply_to: string;
}

export interface EmailConfig {
  configured: boolean;
  provider: string;
  from: string;
  from_email?: string;
  from_name?: string;
  reply_to: string | null;
}

/** Sender/reply-to live in app_settings so Billing owns them in one place. */
export const fetchSenderSettings = async (): Promise<SenderSettings> => {
  const { data } = await (supabase as any).from('app_settings')
    .select('value').eq('key', SENDER_SETTING_KEY).maybeSingle();
  if (!data?.value) return { ...DEFAULT_SENDER };
  try {
    const saved = JSON.parse(data.value);
    return {
      from_email: saved.from_email || DEFAULT_SENDER.from_email,
      from_name: saved.from_name || DEFAULT_SENDER.from_name,
      reply_to: saved.reply_to || '',
    };
  } catch {
    return { ...DEFAULT_SENDER };
  }
};

export const saveSenderSettings = async (s: SenderSettings): Promise<void> => {
  const { error } = await (supabase as any).from('app_settings').upsert({
    key: SENDER_SETTING_KEY,
    value: JSON.stringify(s),
    description: 'Invoice email sender and reply-to address',
  }, { onConflict: 'key' });
  if (error) throw error;
  configCache = null;
};


export interface EmailMessageDraft {
  invoice_id: string;
  template_key?: string | null;
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  attachment_path?: string | null;
  /** Stable per intended send; a repeat click never mails a second copy. */
  idempotency_key: string;
}

export interface SendResult {
  ok: boolean;
  configured?: boolean;
  duplicate?: boolean;
  messageId?: string | null;
  providerMessageId?: string | null;
  error?: string;
}

export const EMAIL_TEMPLATE_VARIABLES = [
  '{{invoice_number}}', '{{customer_name}}', '{{billing_contact_first_name}}',
  '{{invoice_total}}', '{{invoice_date}}', '{{due_date}}', '{{po_number}}',
  '{{project_name}}', '{{company_name}}',
] as const;

export const DEFAULT_INVOICE_SUBJECT =
  'Invoice {{invoice_number}} from Summit Facilities Group';

export const DEFAULT_INVOICE_BODY = `Hello {{billing_contact_first_name}},

Please find attached invoice {{invoice_number}} from Summit Facilities Group for {{customer_name}}.

Invoice number: {{invoice_number}}
Invoice date: {{invoice_date}}
Amount due: {{invoice_total}}
Due date: {{due_date}}
PO number: {{po_number}}

If you have any questions about this invoice, just reply to this email and our billing team will be glad to help.

Thank you for your business,
Summit Facilities Group — Billing`;

export const renderTemplate = (tpl: string, vars: Record<string, string>) =>
  tpl.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => vars[k] ?? '');

const readFunctionError = async (error: unknown) => {
  if (error instanceof FunctionsHttpError) {
    const text = await error.context.text();
    try { return JSON.parse(text).error ?? text; } catch { return text; }
  }
  return (error as Error)?.message ?? 'Unknown error';
};

let configCache: EmailConfig | null = null;

/** Asks the backend whether outbound email is actually configured. */
export const fetchEmailConfig = async (force = false): Promise<EmailConfig> => {
  if (configCache && !force) return configCache;
  const fallback: EmailConfig = {
    configured: false, provider: 'resend',
    from: 'billing@summitfacilitiesgroup.com', reply_to: null,
  };
  const { data, error } = await supabase.functions.invoke('send-invoice-email', {
    body: { action: 'status' },
  });
  if (error) {
    console.error('Email config check failed:', await readFunctionError(error));
    return fallback;
  }
  configCache = { ...fallback, ...(data as EmailConfig) };
  return configCache;
};

/** Stores the generated invoice PDF so the backend can attach it. */
export const uploadInvoicePdf = async (
  invoiceId: string, invoiceNumber: string, blob: Blob,
): Promise<string | null> => {
  const path = `${invoiceId}/Invoice-${invoiceNumber}.pdf`;
  const { error } = await supabase.storage.from(INVOICE_PDF_BUCKET)
    .upload(path, blob, { contentType: 'application/pdf', upsert: true });
  if (error) {
    console.error('Invoice PDF upload failed:', error.message);
    return null;
  }
  return path;
};

export const sendInvoiceEmail = async (draft: EmailMessageDraft): Promise<SendResult> => {
  const { data, error } = await supabase.functions.invoke('send-invoice-email', {
    body: {
      invoiceId: draft.invoice_id,
      templateKey: draft.template_key ?? 'invoice_default',
      to: draft.to,
      cc: draft.cc ?? [],
      subject: draft.subject,
      body: draft.body,
      attachmentPath: draft.attachment_path ?? null,
      idempotencyKey: draft.idempotency_key,
    },
  });
  if (error) return { ok: false, error: await readFunctionError(error) };
  return data as SendResult;
};

/**
 * Future delivery kinds — reminders, statements, overdue notices, receipts and
 * credit memos all route through the same function when they are turned on.
 */
export const FUTURE_EMAIL_HOOKS = [
  'invoice_reminder', 'statement', 'overdue_notice', 'payment_receipt', 'credit_memo',
] as const;