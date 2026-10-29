import { describe, expect, it } from 'vitest';
import {
  COMPANY_NAME,
  INVOICE_UNMONITORED_NOTICE,
  withUnmonitoredNotice,
} from '@/lib/billing/company';

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
