import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/** Vendor-neutral invoice shape so both Waypoint quotes/invoices and the
 *  Billing module render the same document. */
export interface InvoicePdfData {
  invoice_number: string;
  status: string;
  issue_date: string;
  due_date?: string | null;
  po_number?: string | null;
  terms?: string | null;
  notes?: string | null;
  subtotal: number;
  tax_rate: number;
  tax: number;
  total: number;
  amount_paid?: number;
  balance_due?: number;
}

export interface InvoicePdfLine {
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface InvoicePdfParams {
  invoice: InvoicePdfData;
  items: InvoicePdfLine[];
  clientCompany?: string | null;
  clientName?: string | null;
  clientEmail?: string | null;
  projectName?: string | null;
}

/** Builds the invoice document; callers decide whether to save or get a blob. */
export function buildInvoicePdf({
  invoice, items, clientCompany, clientName, clientEmail, projectName,
}: InvoicePdfParams): jsPDF {
  const doc = new jsPDF();
  const w = doc.internal.pageSize.getWidth();

  doc.setFontSize(20);
  doc.setTextColor(40, 80, 40);
  doc.text('Summit Facilities Group', 14, 20);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text('Crew Compass', 14, 26);

  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.text(`Invoice ${invoice.invoice_number}`, w - 14, 20, { align: 'right' });
  doc.setFontSize(10);
  doc.setTextColor(100);
  let hy = 26;
  doc.text(`Status: ${invoice.status.replace(/_/g, ' ').toUpperCase()}`, w - 14, hy, { align: 'right' }); hy += 5;
  doc.text(`Issued: ${invoice.issue_date}`, w - 14, hy, { align: 'right' }); hy += 5;
  if (invoice.due_date) { doc.text(`Due: ${invoice.due_date}`, w - 14, hy, { align: 'right' }); hy += 5; }
  if (invoice.po_number) { doc.text(`PO: ${invoice.po_number}`, w - 14, hy, { align: 'right' }); hy += 5; }

  let y = Math.max(50, hy + 8);
  doc.setFontSize(11); doc.setTextColor(0);
  doc.text('Bill to:', 14, y); y += 6;
  doc.setFontSize(10);
  if (clientCompany) { doc.text(clientCompany, 14, y); y += 5; }
  if (clientName) { doc.text(clientName, 14, y); y += 5; }
  if (clientEmail) { doc.text(clientEmail, 14, y); y += 5; }
  if (projectName) { y += 2; doc.setTextColor(90); doc.text(`Project: ${projectName}`, 14, y); doc.setTextColor(0); y += 5; }

  autoTable(doc, {
    startY: y + 6,
    head: [['Description', 'Qty', 'Unit Price', 'Total']],
    body: items.map(i => [
      i.description, String(i.quantity),
      `$${Number(i.unit_price).toFixed(2)}`,
      `$${Number(i.line_total).toFixed(2)}`,
    ]),
    headStyles: { fillColor: [40, 80, 40] },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
  });

  const fy = (doc as any).lastAutoTable.finalY + 8;
  doc.setFontSize(10);
  doc.text('Subtotal:', w - 60, fy);
  doc.text(`$${Number(invoice.subtotal).toFixed(2)}`, w - 14, fy, { align: 'right' });
  doc.text(`Tax (${Number(invoice.tax_rate).toFixed(2)}%):`, w - 60, fy + 6);
  doc.text(`$${Number(invoice.tax).toFixed(2)}`, w - 14, fy + 6, { align: 'right' });
  doc.setFontSize(12); doc.setFont(undefined as any, 'bold');
  doc.text('Total:', w - 60, fy + 14);
  doc.text(`$${Number(invoice.total).toFixed(2)}`, w - 14, fy + 14, { align: 'right' });
  doc.setFont(undefined as any, 'normal');

  let ty = fy + 22;
  if (invoice.amount_paid != null && invoice.amount_paid > 0) {
    doc.setFontSize(10);
    doc.text('Paid to date:', w - 60, ty);
    doc.text(`-$${Number(invoice.amount_paid).toFixed(2)}`, w - 14, ty, { align: 'right' });
    ty += 6;
    doc.setFont(undefined as any, 'bold');
    doc.text('Balance due:', w - 60, ty);
    doc.text(`$${Number(invoice.balance_due ?? 0).toFixed(2)}`, w - 14, ty, { align: 'right' });
    doc.setFont(undefined as any, 'normal');
    ty += 8;
  }

  if (invoice.terms) {
    doc.setFontSize(9); doc.setTextColor(80);
    doc.text('Terms:', 14, ty + 6);
    doc.text(doc.splitTextToSize(invoice.terms, w - 28), 14, ty + 11);
    ty += 20;
  }
  if (invoice.notes) {
    doc.setFontSize(9); doc.setTextColor(80);
    doc.text('Notes:', 14, ty + 6);
    doc.text(doc.splitTextToSize(invoice.notes, w - 28), 14, ty + 11);
  }

  return doc;
}

export const saveInvoicePdf = (params: InvoicePdfParams) =>
  buildInvoicePdf(params).save(`${params.invoice.invoice_number}.pdf`);

export const invoicePdfBlob = (params: InvoicePdfParams): Blob =>
  buildInvoicePdf(params).output('blob');