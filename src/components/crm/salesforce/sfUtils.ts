import Papa from 'papaparse';
import DOMPurify from 'dompurify';

export type Row = Record<string, string>;

/** Case-insensitive column lookup across several possible Salesforce header spellings. */
export const pick = (row: Row, ...keys: string[]): string => {
  for (const k of keys) {
    const found = Object.keys(row).find((rk) => rk.trim().toLowerCase() === k.toLowerCase());
    if (found && row[found] != null && String(row[found]).trim() !== '') return String(row[found]).trim();
  }
  return '';
};

/**
 * Salesforce IDs come in 15-char (case-sensitive) and 18-char (case-insensitive)
 * flavours. Every map in the importer is keyed by the 15-char prefix so the two
 * forms always resolve to the same record.
 */
export const k15 = (id: string): string => (id || '').trim().slice(0, 15);

export const isSfId = (v: string): boolean => /^[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?$/.test((v || '').trim());

/** The 3-char object key prefix: 001=Account, 003=Contact, 006=Opportunity, 00T=Task. */
export const sfPrefix = (id: string): string => (id || '').trim().slice(0, 3);

export const parseNum = (v: string): number | null => {
  if (!v) return null;
  const n = Number(String(v).replace(/[$,%\s,]/g, ''));
  return Number.isFinite(n) ? n : null;
};

export const parseInteger = (v: string): number | null => {
  const n = parseNum(v);
  return n == null ? null : Math.round(n);
};

/** Date-only (YYYY-MM-DD) for `date` columns. */
export const parseDate = (v: string): string | null => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

/** Full timestamp for timestamptz columns (Salesforce CreatedDate etc.). */
export const parseTimestamp = (v: string): string | null => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
};

export const parseBool = (v: string): boolean => /^(true|1|yes)$/i.test((v || '').trim());

// ---------------------------------------------------------------- encoding --

export function decodeCsvBytes(bytes: Uint8Array): string {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes.slice(2));
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes.slice(2));
  }
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.slice(3));
  }
  const sample = bytes.slice(0, Math.min(1024, bytes.length));
  let nulls = 0;
  for (let i = 1; i < sample.length; i += 2) if (sample[i] === 0) nulls++;
  if (nulls > sample.length / 4) return new TextDecoder('utf-16le').decode(bytes);
  return new TextDecoder('utf-8').decode(bytes);
}

export function parseCsvText(text: string): Row[] {
  const parsed = Papa.parse<Row>(text, { header: true, skipEmptyLines: true });
  return parsed.data.filter((r) => r && Object.values(r).some((v) => v && String(v).trim() !== ''));
}

// -------------------------------------------------------------- mime types --

const SALESFORCE_FILE_TYPE_MIME: Record<string, string> = {
  PDF: 'application/pdf',
  WORD: 'application/msword',
  WORD_X: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  DOC: 'application/msword',
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  EXCEL: 'application/vnd.ms-excel',
  EXCEL_X: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  XLS: 'application/vnd.ms-excel',
  XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  POWER_POINT: 'application/vnd.ms-powerpoint',
  POWER_POINT_X: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  PPT: 'application/vnd.ms-powerpoint',
  PPTX: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  PNG: 'image/png',
  JPG: 'image/jpeg',
  JPEG: 'image/jpeg',
  GIF: 'image/gif',
  TIFF: 'image/tiff',
  TXT: 'text/plain',
  CSV: 'text/csv',
  XML: 'application/xml',
  ZIP: 'application/zip',
  SNOTE: 'text/html',
};

const EXTENSION_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  txt: 'text/plain',
  csv: 'text/csv',
  xml: 'application/xml',
  zip: 'application/zip',
  snote: 'text/html',
};

const isValidMimeType = (value: string) =>
  /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*(?:\s*;.*)?$/i.test(value);

export const getSafeContentType = (row: Row, fileName: string): string => {
  const contentType = pick(row, 'ContentType', 'Content Type', 'MimeType');
  if (contentType && isValidMimeType(contentType)) return contentType;
  const sfType = pick(row, 'FileType', 'File Type').toUpperCase();
  if (sfType && SALESFORCE_FILE_TYPE_MIME[sfType]) return SALESFORCE_FILE_TYPE_MIME[sfType];
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return EXTENSION_MIME[ext] || 'application/octet-stream';
};

export const sanitizeStorageFileName = (fileName: string): string =>
  (fileName || '')
    .replace(/[\\/]+/g, '-')
    .split('')
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code > 31 && code !== 127;
    })
    .join('')
    .trim()
    .slice(0, 180) || 'salesforce-file';

// ---------------------------------------------------------- note rich text --

/** Enhanced Note HTML, sanitized to a safe subset before it is ever stored. */
export const sanitizeNoteHtml = (html: string): string =>
  DOMPurify.sanitize(html || '', {
    ALLOWED_TAGS: [
      'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code',
      'a', 'span', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr',
    ],
    ALLOWED_ATTR: ['href', 'title', 'target', 'rel'],
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input'],
    FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick'],
  });

/** Derived plain text kept in `content` so search and previews keep working. */
export const htmlToPlainText = (html: string): string => {
  const withoutBlocks = (html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '');
  const doc = typeof document !== 'undefined' ? document.createElement('textarea') : null;
  let decoded = withoutBlocks;
  if (doc) {
    doc.innerHTML = withoutBlocks;
    decoded = doc.value;
  }
  return decoded.replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
};

/** Stable fingerprint used for cautious matching of legacy rows (no Salesforce id). */
export async function contentHash(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function toCsv(rows: Record<string, string | number>[]): string {
  if (!rows.length) return '';
  const headers = Array.from(rows.reduce((set, r) => { Object.keys(r).forEach((k) => set.add(k)); return set; }, new Set<string>()));
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n');
}