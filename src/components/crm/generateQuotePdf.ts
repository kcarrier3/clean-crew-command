import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CrmQuote, CrmQuoteItem, CrmDeal } from './types';

interface Params {
  quote: CrmQuote;
  items: CrmQuoteItem[];
  deal: Pick<CrmDeal, 'name'>;
  clientName?: string;
  clientEmail?: string;
  clientCompany?: string;
}

export function generateQuotePdf({ quote, items, deal, clientName, clientEmail, clientCompany }: Params) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(20);
  doc.setTextColor(40, 80, 40);
  doc.text('Summit Facilities Group', 14, 20);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text('Crew Compass CRM', 14, 26);

  // Quote title
  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.text(`Quote ${quote.quote_number}`, pageWidth - 14, 20, { align: 'right' });
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Status: ${quote.status.toUpperCase()}`, pageWidth - 14, 26, { align: 'right' });
  if (quote.valid_until) {
    doc.text(`Valid until: ${quote.valid_until}`, pageWidth - 14, 31, { align: 'right' });
  }

  // Bill-to
  let y = 45;
  doc.setFontSize(11);
  doc.setTextColor(0);
  doc.text('Prepared for:', 14, y);
  y += 6;
  doc.setFontSize(10);
  if (clientCompany) { doc.text(clientCompany, 14, y); y += 5; }
  if (clientName)    { doc.text(clientName, 14, y);    y += 5; }
  if (clientEmail)   { doc.text(clientEmail, 14, y);   y += 5; }
  doc.text(`Project: ${deal.name}`, 14, y); y += 5;

  // Line items table
  autoTable(doc, {
    startY: y + 6,
    head: [['Description', 'Qty', 'Unit Price', 'Total']],
    body: items.map(i => [
      i.description,
      String(i.quantity),
      `$${Number(i.unit_price).toFixed(2)}`,
      `$${Number(i.line_total).toFixed(2)}`,
    ]),
    headStyles: { fillColor: [40, 80, 40] },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 8;
  doc.setFontSize(10);
  doc.text(`Subtotal:`, pageWidth - 60, finalY);
  doc.text(`$${Number(quote.subtotal).toFixed(2)}`, pageWidth - 14, finalY, { align: 'right' });
  doc.text(`Tax (${Number(quote.tax_rate).toFixed(2)}%):`, pageWidth - 60, finalY + 6);
  doc.text(`$${Number(quote.tax).toFixed(2)}`, pageWidth - 14, finalY + 6, { align: 'right' });
  doc.setFontSize(12);
  doc.setFont(undefined as any, 'bold');
  doc.text(`Total:`, pageWidth - 60, finalY + 14);
  doc.text(`$${Number(quote.total).toFixed(2)}`, pageWidth - 14, finalY + 14, { align: 'right' });
  doc.setFont(undefined as any, 'normal');

  if (quote.terms) {
    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.text('Terms & Conditions:', 14, finalY + 28);
    const split = doc.splitTextToSize(quote.terms, pageWidth - 28);
    doc.text(split, 14, finalY + 33);
  }

  doc.save(`${quote.quote_number}.pdf`);
}