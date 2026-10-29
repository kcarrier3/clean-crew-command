/**
 * The name printed on invoices and used as the default billing sender.
 * Change it here when the company name changes. Do not copy the string elsewhere.
 */
export const COMPANY_NAME = 'Summit Facilities Group';

/** Billing From address. The display name defaults to COMPANY_NAME unless BILLING_FROM_NAME is set. */
export const BILLING_FROM_EMAIL = 'invoices@billing.crewcompass360.com';

/** Colors sampled from public/branding/summit-logo.png. */
export const BRAND_ORANGE = '#FF6000';
export const BRAND_BLACK = '#000000';
export const BRAND_BODY = '#1F1F1F';
export const BRAND_HEADER_GRAY = '#F3F4F6';
export const BRAND_STRIPE_GRAY = '#F7F7F8';

/**
 * Logo served by the web app (public/branding/summit-logo.png).
 * Invoice email does not fetch this URL; send-invoice-email inlines the same file.
 * Optional storage copy: public bucket `branding`, object `summit-logo.png`.
 */
export const INVOICE_LOGO_PATH = '/branding/summit-logo.png';
export const INVOICE_LOGO_URL = 'https://app.gosummitfacilities.com/branding/summit-logo.png';
export const INVOICE_LOGO_CID = 'summit-logo';

export const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  return [
    Number.parseInt(h.slice(0, 2), 16),
    Number.parseInt(h.slice(2, 4), 16),
    Number.parseInt(h.slice(4, 6), 16),
  ];
};

/** Wraps the escaped invoice body. The logo is an inline cid, not a remote image. */
export const invoiceEmailHtml = (escapedBodyHtml: string) => `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:${BRAND_BODY};max-width:640px">
<img src="cid:${INVOICE_LOGO_CID}" alt="${COMPANY_NAME}" width="232" height="86" style="display:block;border:0;margin:0 0 12px;height:auto" />
<div style="height:3px;width:96px;background:${BRAND_ORANGE};margin:0 0 18px"></div>
${escapedBodyHtml}
<p style="margin:28px 0 0;padding-top:12px;border-top:1px solid #E5E5E5;font-size:12px;line-height:1.4;color:${BRAND_BODY}">${COMPANY_NAME}</p>
</div>`;

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
