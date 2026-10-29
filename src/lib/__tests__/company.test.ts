import { describe, expect, it } from 'vitest';
import {
  BRAND_BLACK,
  BRAND_BODY,
  BRAND_HEADER_GRAY,
  BRAND_ORANGE,
  BRAND_STRIPE_GRAY,
  COMPANY_NAME,
  INVOICE_LOGO_CID,
  INVOICE_LOGO_PATH,
  INVOICE_LOGO_URL,
  INVOICE_UNMONITORED_NOTICE,
  invoiceEmailHtml,
  withUnmonitoredNotice,
} from '@/lib/billing/company';
import { buildInvoicePdf } from '@/lib/billing/invoicePdf';

describe('invoice company name', () => {
  it('keeps the current company name in one place', () => {
    expect(COMPANY_NAME).toBe('Summit Facilities Group');
  });

  it('adds the unmonitored notice only when no reply-to is configured', () => {
    const body = 'Thank you,\nSummit Facilities Group — Billing';
    expect(withUnmonitoredNotice(body, null)).toBe(`${body}\n\n${INVOICE_UNMONITORED_NOTICE}`);
    expect(withUnmonitoredNotice(body, '')).toBe(`${body}\n\n${INVOICE_UNMONITORED_NOTICE}`);
    expect(withUnmonitoredNotice(body, '  ')).toBe(`${body}\n\n${INVOICE_UNMONITORED_NOTICE}`);
  });

  it('leaves the body alone when a reply-to address is configured', () => {
    const body = 'Thank you,\nSummit Facilities Group — Billing';
    expect(withUnmonitoredNotice(body, 'billing@example.com')).toBe(body);
  });

  it('does not add the notice twice', () => {
    const body = `Thanks.\n\n${INVOICE_UNMONITORED_NOTICE}`;
    expect(withUnmonitoredNotice(body, null)).toBe(body);
  });
});

describe('invoice branding', () => {
  it('keeps the logo colors and URL in one place', () => {
    expect(BRAND_ORANGE).toBe('#FF6000');
    expect(BRAND_BLACK).toBe('#000000');
    expect(BRAND_BODY).toBe('#1F1F1F');
    expect(BRAND_HEADER_GRAY).toBe('#F3F4F6');
    expect(BRAND_STRIPE_GRAY).toBe('#F7F7F8');
    expect(INVOICE_LOGO_PATH).toBe('/branding/summit-logo.png');
    expect(INVOICE_LOGO_URL).toContain(INVOICE_LOGO_PATH);
  });

  it('puts the logo, orange accent, and company name on the invoice email', () => {
    const html = invoiceEmailHtml('Amount due<br/><a href="https://example.com/invoice" style="color:#FF6000;font-weight:bold">https://example.com/invoice</a>');
    expect(html).toContain(`cid:${INVOICE_LOGO_CID}`);
    expect(html).toContain(BRAND_ORANGE);
    expect(html).toContain(COMPANY_NAME);
    expect(html).toContain(BRAND_BODY);
  });

  it('draws an invoice PDF without the logo file', () => {
    const doc = buildInvoicePdf({
      logoDataUrl: null,
      invoice: {
        invoice_number: 'INV-1',
        status: 'ready',
        issue_date: '2026-10-01',
        subtotal: 100,
        tax_rate: 0,
        tax: 0,
        total: 100,
      },
      items: [{ description: 'Janitorial', quantity: 1, unit_price: 100, line_total: 100 }],
    });
    const out = doc.output('arraybuffer');
    expect(out.byteLength).toBeGreaterThan(500);
  });
});
