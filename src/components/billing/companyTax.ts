export const TAX_EXEMPT_REASONS = [
  'Nonprofit',
  'Government',
  'Resale/pass-through',
  'Other',
] as const;

export const TAX_CERT_BUCKET = 'tax-exemption-certificates';

export interface CompanyTaxFields {
  id: string;
  tax_exempt?: boolean | null;
  tax_exemption_reason?: string | null;
  tax_exempt_certificate_on_file?: boolean | null;
  tax_exempt_certificate_expires?: string | null;
  tax_exempt_certificate_path?: string | null;
  tax_exempt_certificate_missing?: boolean | null;
  qb_customer_id?: string | null;
}

/** Client-side gate matching the database trigger. Grandfathered rows may stay exempt without a file. */
export const exemptionSaveError = (input: {
  taxExempt: boolean;
  reason: string | null;
  certificatePath: string | null;
  certificateMissing?: boolean;
}): string | null => {
  if (!input.taxExempt) return null;
  if (!input.reason?.trim()) return 'Choose an exemption reason.';
  const known = TAX_EXEMPT_REASONS.some(r => input.reason === r || (r === 'Other' && input.reason!.startsWith('Other')));
  if (!known) return 'Choose Nonprofit, Government, Resale/pass-through, or Other.';
  if (!input.certificatePath?.trim() && !input.certificateMissing) {
    return 'Upload an exemption certificate before saving tax exempt.';
  }
  return null;
};

/** Warn when an exempt customer is missing a certificate or it is expired / due within 30 days. */
export const certificateWarning = (c: CompanyTaxFields | null | undefined, today = new Date()): string | null => {
  if (!c?.tax_exempt) return null;
  const hasFile = !!(c.tax_exempt_certificate_path || c.tax_exempt_certificate_on_file);
  if (!hasFile) return 'Exempt, but no exemption certificate is on file.';
  if (!c.tax_exempt_certificate_expires) return null;
  const exp = new Date(`${c.tax_exempt_certificate_expires}T00:00:00`);
  if (Number.isNaN(exp.getTime())) return null;
  const days = Math.ceil((exp.getTime() - today.getTime()) / 86400000);
  if (days < 0) return 'Exemption certificate is expired. Invoices for this customer need tax review until it is renewed.';
  if (days <= 30) return `Exemption certificate expires in ${days} day${days === 1 ? '' : 's'}.`;
  return null;
};

export const exemptionGap = (c: CompanyTaxFields, today = new Date()): 'missing' | 'expired' | null => {
  if (!c.tax_exempt) return null;
  if (!c.tax_exempt_certificate_path) return 'missing';
  if (!c.tax_exempt_certificate_expires) return null;
  const exp = new Date(`${c.tax_exempt_certificate_expires}T00:00:00`);
  if (!Number.isNaN(exp.getTime()) && exp < new Date(today.getFullYear(), today.getMonth(), today.getDate())) return 'expired';
  return null;
};
