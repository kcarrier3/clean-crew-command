import { saveInvoicePdf } from '@/lib/billing/invoicePdf';
import type { CrmInvoice, CrmInvoiceItem } from './types';

interface Params {
  invoice: CrmInvoice;
  items: CrmInvoiceItem[];
  clientCompany?: string;
  clientName?: string;
  clientEmail?: string;
}

/** Thin wrapper so legacy Waypoint invoices use the shared PDF renderer. */
export function generateInvoicePdf({ invoice, items, clientCompany, clientName, clientEmail }: Params) {
  saveInvoicePdf({
    invoice: {
      invoice_number: invoice.invoice_number,
      status: invoice.status,
      issue_date: invoice.issue_date,
      due_date: invoice.due_date,
      terms: invoice.terms,
      subtotal: Number(invoice.subtotal),
      tax_rate: Number(invoice.tax_rate),
      tax: Number(invoice.tax),
      total: Number(invoice.total),
    },
    items: items.map(i => ({
      description: i.description,
      quantity: Number(i.quantity),
      unit_price: Number(i.unit_price),
      line_total: Number(i.line_total),
    })),
    clientCompany, clientName, clientEmail,
  });
}