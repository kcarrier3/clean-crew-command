import { describe, it, expect } from 'vitest';
import { buildBooksGptRows, booksGptCsv, booksGptIssues, type ExportInvoice, type ExportLine } from '../billing/booksgptExport';

const inv = (o: Partial<ExportInvoice>): ExportInvoice => ({
  id: 'i1', invoice_number: 'INV-1001', status: 'sent', invoice_date: '2027-01-05',
  due_date: '2027-02-04', payment_terms: 'Net 30', customer_name: 'Stelfast',
  billing_email: 'ap@stelfast.com', po_number: null, subtotal: 1000, tax_rate: 0.08, tax: 80,
  total: 1080, notes: null, ...o,
});
const line = (o: Partial<ExportLine>): ExportLine => ({
  invoice_id: 'i1', description: 'Monthly cleaning', quantity: 1, unit_price: 1000,
  line_total: 1000, sort_order: 0, billing_item_id: 'b1', ...o,
});
const range = { from: '2027-01-01', to: '2027-01-31' };

describe('buildBooksGptRows', () => {
  it('makes exactly one row per invoice, even with several lines', () => {
    const rows = buildBooksGptRows([inv({})], [
      line({ description: 'Monthly cleaning', unit_price: 900, line_total: 900 }),
      line({ description: 'Supplies', quantity: 2, unit_price: 50, line_total: 100, sort_order: 1, billing_item_id: 'b2' }),
    ], { b1: 'Janitorial', b2: 'Resale supplies' }, range);
    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe(1000);
    expect(rows[0].sales_tax).toBe(80);
    expect(rows[0].product_service).toBe('');
    expect(rows[0].description).toContain('Supplies (2 x $50.00 = $100.00)');
  });

  it('uses the saved billable item name when every line shares one item', () => {
    const rows = buildBooksGptRows([inv({})], [line({})], { b1: 'Janitorial' }, range);
    expect(rows[0].product_service).toBe('Janitorial');
    expect(rows[0].tax_rate_percent).toBe(8);
  });

  it('leaves out draft and void invoices and invoices outside the dates', () => {
    const rows = buildBooksGptRows([
      inv({ id: 'a', invoice_number: 'A', status: 'draft' }),
      inv({ id: 'b', invoice_number: 'B', status: 'void' }),
      inv({ id: 'c', invoice_number: 'C', invoice_date: '2026-12-31' }),
      inv({ id: 'd', invoice_number: 'D', status: 'paid' }),
    ], [], {}, range);
    expect(rows.map(r => r.invoice_number)).toEqual(['D']);
  });
});

describe('booksGptCsv / issues', () => {
  it('quotes commas and flags a missing customer', () => {
    const rows = buildBooksGptRows([inv({ customer_name: 'Smith, Inc', billing_email: null })], [line({})], {}, range);
    expect(booksGptCsv(rows).split('\r\n')[1]).toContain('"Smith, Inc"');
    const none = buildBooksGptRows([inv({ customer_name: null, billing_email: null })], [], {}, range);
    expect(booksGptIssues(none)).toEqual(['INV-1001: no customer name or email']);
  });
});
