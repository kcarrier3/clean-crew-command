import { describe, expect, it } from 'vitest';
import { exemptionGap, exemptionSaveError } from '@/components/billing/companyTax';

describe('tax exemption', () => {
  it('requires a reason and a certificate for a new exemption', () => {
    expect(exemptionSaveError({ taxExempt: true, reason: null, certificatePath: null })).toMatch(/reason/i);
    expect(exemptionSaveError({
      taxExempt: true, reason: 'Nonprofit', certificatePath: null,
    })).toMatch(/certificate/i);
    expect(exemptionSaveError({
      taxExempt: true, reason: 'Government', certificatePath: 'certs/a.pdf',
    })).toBeNull();
    expect(exemptionSaveError({ taxExempt: false, reason: null, certificatePath: null })).toBeNull();
  });

  it('lets a grandfathered missing certificate stay until a file is added', () => {
    expect(exemptionSaveError({
      taxExempt: true, reason: 'Nonprofit', certificatePath: null, certificateMissing: true,
    })).toBeNull();
  });

  it('lists missing and expired exemptions', () => {
    const today = new Date('2026-10-29T00:00:00');
    expect(exemptionGap({ id: '1', tax_exempt: true, tax_exempt_certificate_path: null }, today)).toBe('missing');
    expect(exemptionGap({
      id: '2', tax_exempt: true, tax_exempt_certificate_path: 'a.pdf', tax_exempt_certificate_expires: '2026-01-01',
    }, today)).toBe('expired');
    expect(exemptionGap({
      id: '3', tax_exempt: true, tax_exempt_certificate_path: 'a.pdf', tax_exempt_certificate_expires: '2027-01-01',
    }, today)).toBeNull();
  });
});