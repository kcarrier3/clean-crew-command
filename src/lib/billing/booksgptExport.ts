/**
 * BooksGPT invoice spreadsheet export.
 *
 * BooksGPT's "Upload invoices" import turns each spreadsheet row into one draft
 * invoice and never combines rows (two rows with the same invoice number are both
 * skipped). So every Crew Compass invoice becomes exactly ONE row; its lines are
 * summarised in the Description column and the amount is the pre-tax subtotal
 * with sales tax in its own column. Dates are ISO (YYYY-MM-DD), which BooksGPT
 * always accepts. Re-exporting is safe: BooksGPT skips invoice numbers it already has.
 */

export interface ExportInvoice {
  id: string;
  invoice_number: string;
  status: string;
  invoice_date: string;
  due_date: string | null;
  payment_terms: string | null;
  customer_name: string | null;
  billing_email: string | null;
  po_number: string | null;
  subtotal: number;
  tax_rate: number;
  tax: number;
  total: number;
  notes: string | null;
}

export interface ExportLine {
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  sort_order: number;
  billing_item_id: string | null;
}

export interface BooksGptRow {
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  terms: string;
  customer: string;
  customer_email: string;
  product_service: string;
  description: string;
  amount: number;
  sales_tax: number;
  tax_rate_percent: number;
  total: number;
  po_number: string;
  memo: string;
}

/** Statuses that are final enough to belong in the books. */
export const EXPORTABLE_STATUSES = ['ready', 'sent', 'partially_paid', 'paid', 'past_due'];

export const BOOKSGPT_HEADERS: { key: keyof BooksGptRow; header: string }[] = [
  { key: 'invoice_number', header: 'Invoice number' },
  { key: 'invoice_date', header: 'Invoice date' },
  { key: 'due_date', header: 'Due date' },
  { key: 'terms', header: 'Terms' },
  { key: 'customer', header: 'Customer' },
  { key: 'customer_email', header: 'Customer email' },
  { key: 'product_service', header: 'Product/Service' },
  { key: 'description', header: 'Description' },
  { key: 'amount', header: 'Amount' },
  { key: 'sales_tax', header: 'Sales tax' },
  { key: 'tax_rate_percent', header: 'Tax rate %' },
  { key: 'total', header: 'Total' },
  { key: 'po_number', header: 'PO number' },
  { key: 'memo', header: 'Memo' },
];

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const fmt = (n: number) => round2(n).toFixed(2);

export function buildBooksGptRows(
  invoices: ExportInvoice[],
  lines: ExportLine[],
  itemNames: Record<string, string>,
  range: { from: string; to: string },
): BooksGptRow[] {
  const byInvoice = new Map<string, ExportLine[]>();
  for (const l of lines) {
    const arr = byInvoice.get(l.invoice_id) ?? [];
    arr.push(l);
    byInvoice.set(l.invoice_id, arr);
  }

  return invoices
    .filter(i => EXPORTABLE_STATUSES.includes(i.status))
    .filter(i => i.invoice_date >= range.from && i.invoice_date <= range.to)
    .sort((a, b) => a.invoice_date.localeCompare(b.invoice_date)
      || a.invoice_number.localeCompare(b.invoice_number))
    .map(i => {
      const ls = (byInvoice.get(i.id) ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
      const productNames = [...new Set(ls.map(l => (l.billing_item_id && itemNames[l.billing_item_id]) || ''))];
      const product = ls.length > 0 && productNames.length === 1 ? productNames[0] : '';
      const description = ls.length === 1
        ? ls[0].description
        : ls.map(l => `${l.description} (${Number(l.quantity)} x $${fmt(l.unit_price)} = $${fmt(l.line_total)})`).join('; ');
      return {
        invoice_number: i.invoice_number,
        invoice_date: i.invoice_date,
        due_date: i.due_date ?? '',
        terms: i.payment_terms ?? '',
        customer: i.customer_name ?? '',
        customer_email: i.billing_email ?? '',
        product_service: product,
        description,
        amount: round2(i.subtotal),
        sales_tax: round2(i.tax),
        tax_rate_percent: round2(i.tax_rate), // stored as a percent, e.g. 8 = 8%
        total: round2(i.total),
        po_number: i.po_number ?? '',
        memo: (i.notes ?? '').replace(/\s+/g, ' ').trim(),
      };
    });
}

const escapeCsv = (v: string | number) => {
  const s = typeof v === 'number' ? fmt(v) : String(v ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function booksGptCsv(rows: BooksGptRow[]): string {
  const out = [BOOKSGPT_HEADERS.map(h => escapeCsv(h.header)).join(',')];
  for (const r of rows) out.push(BOOKSGPT_HEADERS.map(h => escapeCsv(r[h.key])).join(','));
  return out.join('\r\n');
}

/** Problems BooksGPT would reject a row for, so they can be fixed before upload. */
export function booksGptIssues(rows: BooksGptRow[]): string[] {
  const issues: string[] = [];
  const seen = new Map<string, number>();
  rows.forEach(r => seen.set(r.invoice_number, (seen.get(r.invoice_number) ?? 0) + 1));
  for (const r of rows) {
    if (!r.customer && !r.customer_email) issues.push(`${r.invoice_number}: no customer name or email`);
    if ((seen.get(r.invoice_number) ?? 0) > 1) issues.push(`${r.invoice_number}: invoice number used more than once`);
  }
  return [...new Set(issues)];
}
