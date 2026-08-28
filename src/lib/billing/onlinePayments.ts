/**
 * Online payment collection groundwork.
 *
 * Crew Compass stores the payment-collection settings and the per-invoice
 * payment link here so a card processor (Stripe, Paddle, a bank portal, …)
 * can be wired in later without touching the invoice workflow. Nothing here
 * charges a card — it only produces and stores the customer-facing pay link
 * and tracks what the processor reported back.
 */
import { supabase } from '@/integrations/supabase/client';
import { db } from '@/components/billing/billingApi';

export const ONLINE_PAYMENTS_SETTING_KEY = 'billing_online_payments';

export type PaymentProcessor = 'none' | 'stripe' | 'paddle' | 'quickbooks' | 'other';

export const PROCESSOR_LABEL: Record<PaymentProcessor, string> = {
  none: 'Not connected yet',
  stripe: 'Stripe',
  paddle: 'Paddle',
  quickbooks: 'QuickBooks Payments',
  other: 'Other / bank portal',
};

export interface OnlinePaymentConfig {
  /** Master switch — when off, no pay link is offered anywhere. */
  enabled: boolean;
  processor: PaymentProcessor;
  /** Where customers land to pay, e.g. https://pay.summitfacilitiesgroup.com/invoice */
  checkout_base_url: string;
  /** Turn online payment on automatically for every new invoice. */
  default_on_new_invoices: boolean;
  /** Cards accepted / ACH accepted flags shown on the invoice. */
  accept_card: boolean;
  accept_ach: boolean;
  /** Optional convenience fee shown to the customer (informational only). */
  surcharge_percent: number;
  /** Short line printed with the pay link on invoices and emails. */
  instructions: string;
}

export const DEFAULT_ONLINE_PAYMENT_CONFIG: OnlinePaymentConfig = {
  enabled: false,
  processor: 'none',
  checkout_base_url: '',
  default_on_new_invoices: false,
  accept_card: true,
  accept_ach: true,
  surcharge_percent: 0,
  instructions: 'Pay this invoice online with a card or bank transfer.',
};

export const fetchOnlinePaymentConfig = async (): Promise<OnlinePaymentConfig> => {
  const { data } = await db.from('app_settings')
    .select('value').eq('key', ONLINE_PAYMENTS_SETTING_KEY).maybeSingle();
  if (!data?.value) return DEFAULT_ONLINE_PAYMENT_CONFIG;
  try {
    return { ...DEFAULT_ONLINE_PAYMENT_CONFIG, ...JSON.parse(String(data.value)) };
  } catch {
    return DEFAULT_ONLINE_PAYMENT_CONFIG;
  }
};

export const saveOnlinePaymentConfig = async (cfg: OnlinePaymentConfig) => {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await db.from('app_settings').upsert({
    key: ONLINE_PAYMENTS_SETTING_KEY,
    value: JSON.stringify(cfg),
    description: 'Online payment collection settings (processor, checkout link, defaults)',
    updated_by: userData?.user?.id ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'key' });
  if (error) throw error;
};

/** True once a processor and a checkout URL exist. */
export const isCollectionReady = (cfg: OnlinePaymentConfig) =>
  cfg.enabled && cfg.processor !== 'none' && !!cfg.checkout_base_url.trim();

/** Builds the customer pay link for an invoice from the configured base URL. */
export const buildPaymentLink = (
  cfg: OnlinePaymentConfig,
  invoice: { invoice_number: string; balance_due: number | string; id: string },
): string | null => {
  const base = cfg.checkout_base_url.trim();
  if (!base) return null;
  const sep = base.includes('?') ? '&' : '?';
  const amount = Number(invoice.balance_due || 0).toFixed(2);
  return `${base}${sep}invoice=${encodeURIComponent(invoice.invoice_number)}&amount=${amount}&ref=${invoice.id}`;
};

/** Enables/disables online payment on one invoice and stores the link. */
export const setInvoiceOnlinePayment = async (
  invoiceId: string,
  opts: { enabled: boolean; link?: string | null; processor?: PaymentProcessor },
) => {
  const { error } = await db.from('billing_invoices').update({
    online_payment_enabled: opts.enabled,
    payment_link_url: opts.enabled ? (opts.link ?? null) : null,
    payment_processor: opts.enabled ? (opts.processor ?? null) : null,
  }).eq('id', invoiceId);
  if (error) throw error;
  await db.from('billing_invoice_history').insert({
    invoice_id: invoiceId,
    event_type: opts.enabled ? 'online_payment_enabled' : 'online_payment_disabled',
    detail: opts.enabled ? `Pay link: ${opts.link ?? '—'}` : 'Online payment turned off',
  });
};
