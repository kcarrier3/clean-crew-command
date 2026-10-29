/**
 * The name printed on invoices and used as the default billing sender.
 * Change it here when the company name changes. Do not copy the string elsewhere.
 */
export const COMPANY_NAME = 'Summit Facilities Group';

/** Billing From address. The display name defaults to COMPANY_NAME unless BILLING_FROM_NAME is set. */
export const BILLING_FROM_EMAIL = 'invoices@billing.crewcompass360.com';

/** Added to an invoice email only when no reply-to address is configured. */
export const INVOICE_UNMONITORED_NOTICE =
  'This mailbox is not monitored. Please do not reply to this email.';

export const hasReplyTo = (replyTo: string | null | undefined) =>
  !!replyTo && replyTo.trim().length > 0;

/** Leaves the body unchanged when a reply-to address is configured. */
export const withUnmonitoredNotice = (body: string, replyTo: string | null | undefined) => {
  if (hasReplyTo(replyTo) || body.includes(INVOICE_UNMONITORED_NOTICE)) return body;
  return `${body.replace(/\s+$/, '')}\n\n${INVOICE_UNMONITORED_NOTICE}`;
};
