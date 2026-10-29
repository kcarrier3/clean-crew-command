import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  BRAND_BODY, BRAND_HEADER_GRAY, BRAND_ORANGE, BRAND_STRIPE_GRAY, COMPANY_NAME,
  INVOICE_LOGO_PATH, hexToRgb,
} from '@/lib/billing/company';

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
  taxable_amount?: number;
  credits_applied?: number;
  tax_exempt?: boolean;
  tax_exemption_reason?: string | null;
  total: number;
  amount_paid?: number;
  balance_due?: number;
  bill_to_address?: string | null;
  bill_to_city?: string | null;
  bill_to_state?: string | null;
  bill_to_zip?: string | null;
  ship_to_name?: string | null;
  ship_to_address?: string | null;
  ship_to_city?: string | null;
  ship_to_state?: string | null;
  ship_to_zip?: string | null;
  tax_jurisdiction?: string | null;
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
  /** Data URL of the logo. Loaded from INVOICE_LOGO_PATH when omitted by the async helpers. */
  logoDataUrl?: string | null;
}

const BODY = hexToRgb(BRAND_BODY);
const ORANGE = hexToRgb(BRAND_ORANGE);
const HEADER_GRAY = hexToRgb(BRAND_HEADER_GRAY);
const STRIPE_GRAY = hexToRgb(BRAND_STRIPE_GRAY);

/** Builds the invoice document; callers decide whether to save or get a blob. */
export function buildInvoicePdf({
  invoice, items, clientCompany, clientName, clientEmail, projectName, logoDataUrl,
}: InvoicePdfParams): jsPDF {
  const doc = new jsPDF();
  const w = doc.internal.pageSize.getWidth();

  let headerBottom = 22;
  if (logoDataUrl) {
    // 1160×432 logo. Keep it small so the page stays print-friendly.
    const logoW = 62;
    const logoH = logoW * (432 / 1160);
    doc.addImage(logoDataUrl, 'PNG', 14, 12, logoW, logoH);
    headerBottom = 12 + logoH;
  } else {
    doc.setFontSize(16);
    doc.setTextColor(...BODY);
    doc.text(COMPANY_NAME, 14, 20);
    headerBottom = 24;
  }
  doc.setDrawColor(...ORANGE);
  doc.setLineWidth(0.9);
  doc.line(14, headerBottom + 3, 14 + 36, headerBottom + 3);

  doc.setFontSize(16);
  doc.setTextColor(...BODY);
  doc.text(`Invoice ${invoice.invoice_number}`, w - 14, 18, { align: 'right' });
  doc.setFontSize(10);
  doc.setTextColor(90);
  let hy = 26;
  doc.text(`Status: ${invoice.status.replace(/_/g, ' ').toUpperCase()}`, w - 14, hy, { align: 'right' }); hy += 5;
  doc.text(`Issued: ${invoice.issue_date}`, w - 14, hy, { align: 'right' }); hy += 5;
  if (invoice.due_date) { doc.text(`Due: ${invoice.due_date}`, w - 14, hy, { align: 'right' }); hy += 5; }
  if (invoice.po_number) { doc.text(`PO: ${invoice.po_number}`, w - 14, hy, { align: 'right' }); hy += 5; }

  let y = Math.max(headerBottom + 14, hy + 8);
  doc.setFontSize(11); doc.setTextColor(...BODY);
  const startY = y;
  doc.text('Bill to:', 14, y); y += 6;
  doc.setFontSize(10);
  if (clientCompany) { doc.text(clientCompany, 14, y); y += 5; }
  if (clientName) { doc.text(clientName, 14, y); y += 5; }
  if (invoice.bill_to_address) { doc.text(invoice.bill_to_address, 14, y); y += 5; }
  {
    const l = [[invoice.bill_to_city, invoice.bill_to_state].filter(Boolean).join(', '), invoice.bill_to_zip]
      .filter(Boolean).join(' ');
    if (l) { doc.text(l, 14, y); y += 5; }
  }
  if (clientEmail) { doc.text(clientEmail, 14, y); y += 5; }

  const shipLines = [
    invoice.ship_to_name,
    invoice.ship_to_address,
    [[invoice.ship_to_city, invoice.ship_to_state].filter(Boolean).join(', '), invoice.ship_to_zip]
      .filter(Boolean).join(' ') || null,
  ].filter(Boolean) as string[];
  if (shipLines.length) {
    let sy = startY;
    doc.setFontSize(11); doc.text('Ship to / service address:', 100, sy); sy += 6;
    doc.setFontSize(10);
    shipLines.forEach(t => { doc.text(t, 100, sy); sy += 5; });
    y = Math.max(y, sy);
  }
  if (projectName) { y += 2; doc.setTextColor(90); doc.text(`Project: ${projectName}`, 14, y); doc.setTextColor(0); y += 5; }

  autoTable(doc, {
    startY: y + 6,
    head: [['Description', 'Qty', 'Unit Price', 'Total']],
    body: items.map(i => [
      i.description, String(i.quantity),
      `$${Number(i.unit_price).toFixed(2)}`,
      `$${Number(i.line_total).toFixed(2)}`,
    ]),
    headStyles: { fillColor: HEADER_GRAY, textColor: BODY, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: STRIPE_GRAY },
    styles: { textColor: BODY, lineColor: [220, 220, 220] },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
  });

  const fy = (doc as any).lastAutoTable.finalY + 8;
  const moneyText = (n: number) => `$${Number(n || 0).toFixed(2)}`;
  const rows: { label: string; value: string; bold?: boolean; accent?: boolean }[] = [
    { label: 'Subtotal:', value: moneyText(invoice.subtotal) },
  ];
  if (Number(invoice.credits_applied || 0) > 0) {
    rows.push({ label: 'Credits applied:', value: `-${moneyText(invoice.credits_applied || 0)}` });
  }
  if (invoice.taxable_amount != null) {
    rows.push({ label: 'Taxable amount:', value: moneyText(invoice.taxable_amount) });
  }
  const taxLabel = invoice.tax_exempt
    ? `Exempt${invoice.tax_exemption_reason ? ` — ${invoice.tax_exemption_reason}` : ''}:`
    : `Tax${invoice.tax_jurisdiction ? ` ${invoice.tax_jurisdiction}` : ''} (${Number(invoice.tax_rate).toFixed(2)}%):`;
  rows.push({ label: taxLabel, value: moneyText(invoice.tax) });
  rows.push({ label: 'Total:', value: moneyText(invoice.total), bold: true, accent: true });

  let rowY = fy;
  rows.forEach(r => {
    doc.setFontSize(r.bold ? 12 : 10);
    doc.setFont(undefined as any, r.bold ? 'bold' : 'normal');
    doc.setTextColor(...(r.accent ? ORANGE : BODY));
    doc.text(r.label, w - 90, rowY);
    doc.text(r.value, w - 14, rowY, { align: 'right' });
    rowY += r.bold ? 8 : 6;
  });
  doc.setFont(undefined as any, 'normal');
  doc.setTextColor(...BODY);

  let ty = rowY + 4;
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

const blobToDataUrl = (blob: Blob) => new Promise<string | null>((resolve) => {
  const reader = new FileReader();
  reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
  reader.onerror = () => resolve(null);
  reader.readAsDataURL(blob);
});

/** Loads the committed logo. Returns null when the file is not served (tests, offline). */
export const loadInvoiceLogoDataUrl = async (): Promise<string | null> => {
  if (typeof fetch !== 'function') return null;
  try {
    const res = await fetch(INVOICE_LOGO_PATH);
    if (!res.ok) return null;
    return blobToDataUrl(await res.blob());
  } catch {
    return null;
  }
};

const withLogo = async (params: InvoicePdfParams): Promise<InvoicePdfParams> => {
  if (params.logoDataUrl !== undefined) return params;
  return { ...params, logoDataUrl: await loadInvoiceLogoDataUrl() };
};

export const saveInvoicePdf = async (params: InvoicePdfParams) => {
  const ready = await withLogo(params);
  buildInvoicePdf(ready).save(`${params.invoice.invoice_number}.pdf`);
};

export const invoicePdfBlob = async (params: InvoicePdfParams): Promise<Blob> => {
  const ready = await withLogo(params);
  return buildInvoicePdf(ready).output('blob');
};