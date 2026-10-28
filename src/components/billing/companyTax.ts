export const TAX_EXEMPT_REASONS = [
  'Local government',
  'State government',
  'Charitable organization',
  'Religious organization',
  'Educational',
  'Hospital',
  'Other',
] as const;

export interface CompanyTaxFields {
  id: string;
  tax_exempt?: boolean | null;
  tax_exemption_reason?: string | null;
  tax_exempt_certificate_on_file?: boolean | null;
  tax_exempt_certificate_expires?: string | null;
  tax_exempt_certificate_path?: string | null;
  qb_customer_id?: string | null;
}

/** Warn when an exempt customer is missing a certificate or it is expired / due within 30 days. */
export const certificateWarning = (c: CompanyTaxFields | null | undefined): string | null => {
  if (!c?.tax_exempt) return null;
  if (!c.tax_exempt_certificate_on_file) return 'Exempt, but no exemption certificate is on file.';
  if (!c.tax_exempt_certificate_expires) return null;
  const exp = new Date(`${c.tax_exempt_certificate_expires}T00:00:00`);
  if (Number.isNaN(exp.getTime())) return null;
  const days = Math.ceil((exp.getTime() - Date.now()) / 86400000);
  if (days < 0) return 'Exemption certificate is expired. Invoices for this customer need tax review until it is renewed.';
  if (days <= 30) return `Exemption certificate expires in ${days} day${days === 1 ? '' : 's'}.`;
  return null;
};
