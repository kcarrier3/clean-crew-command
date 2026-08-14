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
  const startY = y;
  doc.text('Bill to:', 14, y); y += 6;
  doc.setFontSize(10);
  const billLines = [
    p.bill_to_name || p.customer_name,
    p.customer_contact_name,
    p.bill_to_address,
    [[p.bill_to_city, p.bill_to_state].filter(Boolean).join(', '), p.bill_to_zip].filter(Boolean).join(' ') || null,
    p.customer_email,
  ].filter(Boolean) as string[];
  billLines.forEach(t => { doc.text(t, 14, y); y += 5; });

  const shipLines = [
    p.ship_to_name,
    p.ship_to_address,
    [[p.ship_to_city, p.ship_to_state].filter(Boolean).join(', '), p.ship_to_zip].filter(Boolean).join(' ') || null,
  ].filter(Boolean) as string[];
  if (shipLines.length) {
    let sy = startY;
    doc.setFontSize(11); doc.text('Ship to / service address:', 90, sy); sy += 6;
    doc.setFontSize(10);
    shipLines.forEach(t => { doc.text(t, 90, sy); sy += 5; });
    y = Math.max(y, sy);
  }

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
    const juris = p.tax_jurisdiction ? ` ${p.tax_jurisdiction}` : '';
    doc.text(`Tax${juris} (${Number(p.tax_rate).toFixed(2)}%):`, w - 90, ty);
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
