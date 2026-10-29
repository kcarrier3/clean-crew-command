import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  BRAND_BLACK,
  BRAND_BODY,
  BRAND_HEADER_GRAY,
  BRAND_ORANGE,
  BRAND_STRIPE_GRAY,
  COMPANY_NAME,
  COMPANY_PHONE,
  COMPANY_STREET,
  COMPANY_ZIP,
  INVOICE_LOGO_CID,
  INVOICE_LOGO_PATH,
  INVOICE_LOGO_URL,
  INVOICE_UNMONITORED_NOTICE,
  REMIT_TO_LINES,
  invoiceEmailHtml,
  omitBlankPoLine,
  withUnmonitoredNotice,
} from '@/lib/billing/company';
import { SUMMIT_LOGO_BASE64 } from '../../../supabase/functions/_shared/summitLogoBase64';
import { buildInvoicePdf, customerPdfStatus, taxSummaryLabel } from '@/lib/billing/invoicePdf';

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

  it('puts the logo, orange accent, and remit-to address on the invoice email', () => {
    const html = invoiceEmailHtml('Amount due<br/><a href="https://example.com/invoice" style="color:#FF6000;font-weight:bold">https://example.com/invoice</a>');
    expect(html).toContain(`cid:${INVOICE_LOGO_CID}`);
    expect(html).toContain(BRAND_ORANGE);
    expect(html).toContain(COMPANY_NAME);
    expect(html).toContain(COMPANY_STREET);
    expect(html).toContain(COMPANY_ZIP);
    expect(html).toContain(COMPANY_PHONE);
    expect(html).toContain(BRAND_BODY);
  });

  it('keeps the remit-to ZIP in one constant', () => {
    expect(COMPANY_ZIP).toBe('44001');
    expect(REMIT_TO_LINES).toEqual([
      'Summit Facilities Group',
      '44901 N. Ridge Road',
      'Amherst, OH 44001',
      '440.516.7898',
    ]);
  });

  it('drops a blank PO line and keeps a real PO', () => {
    const body = 'Amount due: $10\nPO number: \nDue date: 2026-11-01\nPO: —\nPO number: 4451';
    expect(omitBlankPoLine(body)).toBe('Amount due: $10\nDue date: 2026-11-01\nPO number: 4451');
  });

  it('uses an ASCII hyphen on the exempt label and hides internal status', () => {
    expect(taxSummaryLabel({
      tax_exempt: true, tax_exemption_reason: 'Resale/pass-through', tax_jurisdiction: null, tax_rate: 0,
    })).toBe('Exempt - Resale/pass-through:');
    expect(taxSummaryLabel({
      tax_exempt: false, tax_exemption_reason: null, tax_jurisdiction: 'Lorain County, OH', tax_rate: 6.75,
    })).toBe('Tax Lorain County, OH (6.75%):');
    expect(customerPdfStatus('ready')).toBeNull();
    expect(customerPdfStatus('sent')).toBeNull();
    expect(customerPdfStatus('paid')).toBe('PAID');
    expect(customerPdfStatus('void')).toBe('VOID');
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
    expect(doc.getNumberOfPages()).toBe(1);
    const raw = new TextDecoder('latin1').decode(doc.output('arraybuffer'));
    expect(raw).not.toContain('Status:');
    expect(raw).not.toContain('READY');
  });

  it('keeps a one-page invoice with the compressed logo under 200 KB', () => {
    const logo = `data:image/jpeg;base64,${SUMMIT_LOGO_BASE64}`;
    const doc = buildInvoicePdf({
      logoDataUrl: logo,
      invoice: {
        invoice_number: 'INV-1',
        status: 'ready',
        issue_date: '2026-10-01',
        due_date: '2026-10-31',
        subtotal: 5203.75,
        tax_rate: 6.75,
        tax: 351.25,
        taxable_amount: 5203.75,
        tax_jurisdiction: 'Lorain County, OH',
        total: 5555,
        tax_exempt: false,
      },
      items: [
        { description: 'Avon City Hall - Janitorial Services', quantity: 1, unit_price: 1355, line_total: 1355 },
        { description: 'Avon Utilities - Janitorial Services', quantity: 1, unit_price: 500, line_total: 500 },
      ],
      clientCompany: 'City of Avon',
    });
    expect(doc.getNumberOfPages()).toBe(1);
    expect(doc.output('arraybuffer').byteLength).toBeLessThan(200_000);
    expect(logo.startsWith('data:image/jpeg')).toBe(true);
    expect(readFileSync('public/branding/summit-logo.png').byteLength).toBeGreaterThan(100_000);
  });
});
