import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CrmInvoice, CrmInvoiceItem } from './types';

interface Params {
  invoice: CrmInvoice;
  items: CrmInvoiceItem[];
  clientCompany?: string;
  clientName?: string;
  clientEmail?: string;
}

export function generateInvoicePdf({ invoice, items, clientCompany, clientName, clientEmail }: Params) {
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
  doc.text(`Status: ${invoice.status.toUpperCase()}`, w - 14, 26, { align: 'right' });
  doc.text(`Issued: ${invoice.issue_date}`, w - 14, 31, { align: 'right' });
  if (invoice.due_date) doc.text(`Due: ${invoice.due_date}`, w - 14, 36, { align: 'right' });

  let y = 50;
  doc.setFontSize(11); doc.setTextColor(0);
  doc.text('Bill to:', 14, y); y += 6;
  doc.setFontSize(10);
  if (clientCompany) { doc.text(clientCompany, 14, y); y += 5; }
  if (clientName) { doc.text(clientName, 14, y); y += 5; }
  if (clientEmail) { doc.text(clientEmail, 14, y); y += 5; }

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
  doc.text('Total Due:', w - 60, fy + 14);
  doc.text(`$${Number(invoice.total).toFixed(2)}`, w - 14, fy + 14, { align: 'right' });
  doc.setFont(undefined as any, 'normal');

  if (invoice.terms) {
    doc.setFontSize(9); doc.setTextColor(80);
    doc.text('Terms:', 14, fy + 28);
    const split = doc.splitTextToSize(invoice.terms, w - 28);
    doc.text(split, 14, fy + 33);
  }

  doc.save(`${invoice.invoice_number}.pdf`);
}