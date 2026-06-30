import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { PdfField, FieldValues } from './types';

/**
 * Renders fieldValues onto sourcePdfBytes and returns the flattened PDF bytes.
 */
export async function flattenPdf(
  sourcePdfBytes: ArrayBuffer | Uint8Array,
  fields: PdfField[],
  values: FieldValues,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(sourcePdfBytes);
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = pdf.getPages();

  for (const f of fields) {
    const page = pages[f.page - 1];
    if (!page) continue;
    const { width: pw, height: ph } = page.getSize();
    const x = f.x * pw;
    const y = ph - (f.y + f.height) * ph; // pdf-lib origin = bottom-left
    const w = f.width * pw;
    const h = f.height * ph;
    const v = values[f.id];

    if (f.type === 'checkbox') {
      if (v) {
        page.drawText('X', {
          x: x + w * 0.2,
          y: y + h * 0.15,
          size: Math.min(w, h) * 0.9,
          font: helv,
          color: rgb(0, 0, 0),
        });
      }
      continue;
    }

    if ((f.type === 'signature' || f.type === 'initials') && typeof v === 'string' && v.startsWith('data:image')) {
      try {
        const isPng = v.includes('image/png');
        const bytes = Uint8Array.from(atob(v.split(',')[1]), c => c.charCodeAt(0));
        const img = isPng ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
        const scaled = img.scaleToFit(w, h);
        page.drawImage(img, {
          x: x + (w - scaled.width) / 2,
          y: y + (h - scaled.height) / 2,
          width: scaled.width,
          height: scaled.height,
        });
      } catch (e) {
        console.error('embed signature failed', e);
      }
      continue;
    }

    if (typeof v === 'string' && v) {
      const size = Math.max(8, h * 0.6);
      page.drawText(v, {
        x: x + 2,
        y: y + (h - size) / 2,
        size,
        font: helv,
        color: rgb(0, 0, 0),
        maxWidth: w - 4,
      });
    }
  }

  return await pdf.save();
}