import { money, type Invoice } from '@/lib/billing/types';

/** Server-owned money block. Every figure is read back from the invoice row. */
export const InvoiceTotals = ({ invoice }: { invoice: Invoice }) => {
  const exempt = !!invoice.tax_exempt;
  const taxLabel = exempt
    ? `Exempt${invoice.tax_exemption_reason ? ` — ${invoice.tax_exemption_reason}` : ''}`
    : `Tax (${Number(invoice.tax_rate || 0).toFixed(2)}%${invoice.tax_jurisdiction ? ` — ${invoice.tax_jurisdiction}` : ''})`;

  return (
    <div className="ml-auto w-full sm:w-80 space-y-1 text-sm">
      <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{money(invoice.subtotal)}</span></div>
      <div className="flex justify-between"><span>Credits applied</span><span className="tabular-nums">−{money(invoice.credits_applied)}</span></div>
      <div className="flex justify-between"><span>Taxable amount</span><span className="tabular-nums">{money(invoice.taxable_amount)}</span></div>
      <div className="flex justify-between gap-3">
        <span className="min-w-0">{taxLabel}</span>
        <span className="tabular-nums shrink-0">{money(invoice.tax)}</span>
      </div>
      <div className="flex justify-between font-semibold"><span>Total</span><span className="tabular-nums">{money(invoice.total)}</span></div>
      <div className="flex justify-between text-green-700"><span>Paid</span><span className="tabular-nums">{money(invoice.amount_paid)}</span></div>
      <div className="flex justify-between font-semibold"><span>Balance due</span><span className="tabular-nums">{money(invoice.balance_due)}</span></div>
    </div>
  );
};

export const invoiceNeedsTaxReview = (invoice: { tax_status?: string | null; status?: string | null } | null | undefined) =>
  !!invoice && invoice.tax_status === 'needs_review' && invoice.status !== 'void';
