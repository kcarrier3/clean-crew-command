import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Proposal } from './proposalApi';

/** Customer-facing proposal document — prices only, never internal costs. */
export function buildProposalPdf(p: Proposal): jsPDF {
  const doc = new jsPDF();
  const w = doc.internal.pageSize.getWidth();

  doc.setFontSize(20);
  doc.setTextColor(40, 80, 40);
  doc.text('Summit Facilities Group', 14, 20);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text('Facility Services', 14, 26);

  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.text(`Proposal ${p.proposal_number}`, w - 14, 20, { align: 'right' });
  doc.setFontSize(10);
  doc.setTextColor(100);
  let hy = 26;
  doc.text(`Date: ${new Date(p.created_at).toLocaleDateString()}`, w - 14, hy, { align: 'right' }); hy += 5;
  if (p.valid_until) { doc.text(`Valid until: ${p.valid_until}`, w - 14, hy, { align: 'right' }); hy += 5; }

  let y = Math.max(48, hy + 8);
  doc.setFontSize(11); doc.setTextColor(0);
  doc.text('Prepared for:', 14, y); y += 6;
  doc.setFontSize(10);
  if (p.customer_name) { doc.text(p.customer_name, 14, y); y += 5; }
  if (p.customer_contact_name) { doc.text(p.customer_contact_name, 14, y); y += 5; }
  if (p.customer_email) { doc.text(p.customer_email, 14, y); y += 5; }

  y += 3;
  doc.setFontSize(13); doc.setTextColor(0);
  doc.text(p.title, 14, y); y += 6;

  if (p.intro) {
    doc.setFontSize(10); doc.setTextColor(70);
    const intro = doc.splitTextToSize(p.intro, w - 28);
    doc.text(intro, 14, y);
    y += intro.length * 5;
    doc.setTextColor(0);
  }

  autoTable(doc, {
    startY: y + 6,
    head: [['Service', `Price ${p.period_label}`]],
    body: p.lines.map(l => [
      l.detail ? `${l.label}\n${l.detail}` : l.label,
      `$${Number(l.amount).toFixed(2)}`,
    ]),
    headStyles: { fillColor: [40, 80, 40] },
    columnStyles: { 1: { halign: 'right', cellWidth: 40 } },
    styles: { cellPadding: 3 },
  });

  const fy = (doc as any).lastAutoTable.finalY + 8;
  doc.setFontSize(10);
  doc.text('Subtotal:', w - 70, fy);
  doc.text(`$${Number(p.subtotal).toFixed(2)}`, w - 14, fy, { align: 'right' });
  let ty = fy;
  if (Number(p.tax) > 0) {
    ty += 6;
    doc.text(`Tax (${Number(p.tax_rate).toFixed(2)}%):`, w - 70, ty);
    doc.text(`$${Number(p.tax).toFixed(2)}`, w - 14, ty, { align: 'right' });
  }
  ty += 8;
  doc.setFontSize(12); doc.setFont(undefined as any, 'bold');
  doc.text(`Total ${p.period_label}:`, w - 70, ty);
  doc.text(`$${Number(p.total).toFixed(2)}`, w - 14, ty, { align: 'right' });
  doc.setFont(undefined as any, 'normal');
  ty += 12;

  if (p.terms) {
    doc.setFontSize(9); doc.setTextColor(80);
    doc.text('Terms & Conditions:', 14, ty);
    doc.text(doc.splitTextToSize(p.terms, w - 28), 14, ty + 5);
    ty += 22;
  }

  doc.setFontSize(9); doc.setTextColor(80);
  doc.text('Accepted by: ______________________________   Date: ______________', 14, Math.min(ty + 10, 275));

  return doc;
}

export const saveProposalPdf = (p: Proposal) =>
  buildProposalPdf(p).save(`${p.proposal_number}.pdf`);
