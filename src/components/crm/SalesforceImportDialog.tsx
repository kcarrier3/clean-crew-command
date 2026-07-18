import { useState } from 'react';
import JSZip from 'jszip';
import Papa from 'papaparse';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Upload, FileArchive, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onImported: () => void;
}

type Row = Record<string, string>;

interface Summary {
  companies: number;
  contacts: number;
  opportunities: number;
  notes: number;
  files: number;
  skipped: string[];
  errors: string[];
}

const pick = (row: Row, ...keys: string[]): string => {
  for (const k of keys) {
    const found = Object.keys(row).find(rk => rk.toLowerCase() === k.toLowerCase());
    if (found && row[found] != null && String(row[found]).trim() !== '') return String(row[found]).trim();
  }
  return '';
};

const parseNum = (v: string): number | null => {
  if (!v) return null;
  const n = Number(String(v).replace(/[$,]/g, ''));
  return Number.isFinite(n) ? n : null;
};

const parseDate = (v: string): string | null => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

const SALESFORCE_FILE_TYPE_MIME: Record<string, string> = {
  PDF: 'application/pdf',
  WORD: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  WORD_X: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  DOC: 'application/msword',
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  EXCEL: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  XLS: 'application/vnd.ms-excel',
  XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  PPT: 'application/vnd.ms-powerpoint',
  PPTX: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  PNG: 'image/png',
  JPG: 'image/jpeg',
  JPEG: 'image/jpeg',
  GIF: 'image/gif',
  TXT: 'text/plain',
  CSV: 'text/csv',
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
  txt: 'text/plain',
  csv: 'text/csv',
  snote: 'text/html',
};

const isValidMimeType = (value: string) => /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*(?:\s*;.*)?$/i.test(value);

const getSafeContentType = (row: Row, fileName: string): string => {
  const contentType = pick(row, 'ContentType', 'Content Type');
  if (contentType && isValidMimeType(contentType)) return contentType;

  const sfType = pick(row, 'FileType', 'File Type').toUpperCase();
  if (sfType && SALESFORCE_FILE_TYPE_MIME[sfType]) return SALESFORCE_FILE_TYPE_MIME[sfType];

  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return EXTENSION_MIME[ext] || 'application/octet-stream';
};

const sanitizeStorageFileName = (fileName: string): string =>
  fileName
    .replace(/[\\/]+/g, '-')
    .split('')
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code > 31 && code !== 127;
    })
    .join('')
    .trim() || 'salesforce-file';

async function readCsvFromZip(zip: JSZip, patterns: RegExp[]): Promise<Row[] | null> {
  const file = Object.keys(zip.files).find(name => patterns.some(p => p.test(name)));
  if (!file) return null;
  const buf = await zip.files[file].async('uint8array');
  const text = decodeCsvBytes(buf);
  const parsed = Papa.parse<Row>(text, { header: true, skipEmptyLines: true });
  return parsed.data.filter(r => r && Object.values(r).some(v => v && String(v).trim() !== ''));
}

function decodeCsvBytes(bytes: Uint8Array): string {
  // UTF-16 LE BOM
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes.slice(2));
  }
  // UTF-16 BE BOM
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes.slice(2));
  }
  // UTF-8 BOM
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.slice(3));
  }
  // Heuristic: lots of NUL bytes in first 1KB → likely UTF-16 LE without BOM
  const sample = bytes.slice(0, Math.min(1024, bytes.length));
  let nulls = 0;
  for (let i = 1; i < sample.length; i += 2) if (sample[i] === 0) nulls++;
  if (nulls > sample.length / 4) {
    return new TextDecoder('utf-16le').decode(bytes);
  }
  return new TextDecoder('utf-8').decode(bytes);
}

async function readCsvFile(file: File): Promise<Row[]> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const text = decodeCsvBytes(buf);
  const parsed = Papa.parse<Row>(text, { header: true, skipEmptyLines: true });
  return parsed.data.filter(r => r && Object.values(r).some(v => v && String(v).trim() !== ''));
}

function detectEntity(filename: string): 'accounts' | 'contacts' | 'leads' | 'opportunities' | null {
  const n = filename.toLowerCase();
  if (/opportunit/.test(n)) return 'opportunities';
  if (/note/.test(n)) return 'notes' as any;
  if (/attachment|contentversion|contentdocumentlink/.test(n)) return null; // handled only from ZIP
  if (/contact/.test(n)) return 'contacts';
  if (/account/.test(n)) return 'accounts';
  return null;
}

// Locate a file inside the Salesforce export ZIP by Salesforce Id.
// Data Export layout: files live under `Attachments/<AttachmentId>/<filename>`
// or `Files/<ContentVersionId>/<filename>`.
function findZipEntryById(zip: JSZip, id: string): JSZip.JSZipObject | null {
  if (!id) return null;
  const id15 = id.slice(0, 15);
  for (const name of Object.keys(zip.files)) {
    const f = zip.files[name];
    if (f.dir) continue;
    if (name.includes(`/${id}/`) || name.includes(`/${id15}/`) ||
        name.endsWith(`/${id}`) || name.endsWith(`/${id15}`)) {
      return f;
    }
  }
  return null;
}

export function SalesforceImportDialog({ open, onOpenChange, onImported }: Props) {
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);

  const reset = () => { setFiles([]); setProgress(0); setStatus(''); setSummary(null); };

  const handleImport = async () => {
    if (!files.length) return;
    setRunning(true); setSummary(null); setProgress(2);
    const s: Summary = { companies: 0, contacts: 0, opportunities: 0, notes: 0, files: 0, skipped: [], errors: [] };

    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) throw new Error('You must be signed in.');

      setStatus('Reading files...');
      // Assemble entity-to-rows map from either a ZIP or one/many CSVs
      let accounts: Row[] | null = null;
      let contactsRows: Row[] | null = null;
      let opps: Row[] | null = null;
      let notesRows: Row[] | null = null;
      let attachmentsRows: Row[] | null = null;
      let contentVersionsRows: Row[] | null = null;
      let contentDocLinksRows: Row[] | null = null;
      let sourceZip: JSZip | null = null;

      for (const f of files) {
        const isZip = /\.zip$/i.test(f.name) || f.type.includes('zip');
        if (isZip) {
          const zip = await JSZip.loadAsync(f);
          sourceZip = zip;
          accounts = accounts ?? await readCsvFromZip(zip, [/(^|\/)Account(s)?\.csv$/i, /accounts?_/i]);
          contactsRows = contactsRows ?? await readCsvFromZip(zip, [/(^|\/)Contact(s)?\.csv$/i, /contacts?_/i]);
          opps = opps ?? await readCsvFromZip(zip, [/(^|\/)Opportunit(y|ies)\.csv$/i, /opportunit/i]);
          notesRows = notesRows ?? await readCsvFromZip(zip, [/(^|\/)Note(s)?\.csv$/i, /^notes?_/i]);
          attachmentsRows = attachmentsRows ?? await readCsvFromZip(zip, [/(^|\/)Attachment(s)?\.csv$/i]);
          contentVersionsRows = contentVersionsRows ?? await readCsvFromZip(zip, [/(^|\/)ContentVersion(s)?\.csv$/i]);
          contentDocLinksRows = contentDocLinksRows ?? await readCsvFromZip(zip, [/(^|\/)ContentDocumentLink(s)?\.csv$/i]);
        } else {
          const entity = detectEntity(f.name);
          if (!entity) { s.skipped.push(`${f.name} (unrecognized)`); continue; }
          const rows = await readCsvFile(f);
          if (entity === 'accounts') accounts = rows;
          else if (entity === 'contacts') contactsRows = rows;
          else if (entity === 'opportunities') opps = rows;
          else if ((entity as any) === 'notes') notesRows = rows;
        }
      }
      setProgress(10);

      // Accounts -> crm_companies
      setStatus('Importing Accounts...');
      const sfIdToCompanyId = new Map<string, string>();
      if (accounts?.length) {
        for (let i = 0; i < accounts.length; i += 200) {
          const chunk = accounts.slice(i, i + 200).map(r => ({
            name: pick(r, 'Name', 'Account Name') || 'Unnamed Account',
            industry: pick(r, 'Industry') || null,
            website: pick(r, 'Website') || null,
            phone: pick(r, 'Phone') || null,
            address: pick(r, 'BillingStreet', 'Billing Street', 'ShippingStreet') || null,
            city: pick(r, 'BillingCity', 'Billing City', 'ShippingCity') || null,
            state: pick(r, 'BillingState', 'Billing State', 'ShippingState') || null,
            zip: pick(r, 'BillingPostalCode', 'Billing Zip/Postal Code', 'ShippingPostalCode') || null,
            notes: pick(r, 'Description') || null,
            annual_revenue: parseNum(pick(r, 'AnnualRevenue', 'Annual Revenue')),
            employee_count: (() => { const n = parseNum(pick(r, 'NumberOfEmployees', 'Employees')); return n == null ? null : Math.round(n); })(),
            salesforce_id: pick(r, 'Id', 'Account ID', 'Account Id', '18 Digit ID', '18-Digit ID') || null,
            owner_id: uid,
            created_by: uid,
          }));
          const sfIds = accounts.slice(i, i + 200).map(r => pick(r, 'Id', 'Account ID', 'Account Id', '18 Digit ID', '18-Digit ID'));
          const { data, error } = await (supabase as any)
            .from('crm_companies')
            .upsert(chunk, { onConflict: 'salesforce_id', ignoreDuplicates: false })
            .select('id, salesforce_id');
          if (error) { s.errors.push(`Accounts: ${error.message}`); break; }
          data?.forEach((row: any) => {
            if (row.salesforce_id) sfIdToCompanyId.set(row.salesforce_id, row.id);
            s.companies++;
          });
          // Also cover 15-char/18-char id lookups
          sfIds.forEach((id) => {
            if (id && id.length === 18) {
              const short = id.slice(0, 15);
              const full = data?.find((r: any) => r.salesforce_id === id);
              if (full) sfIdToCompanyId.set(short, full.id);
            }
          });
          setProgress(10 + Math.round(((i + 200) / accounts.length) * 25));
        }
      } else s.skipped.push('Account.csv');

      // Contacts -> crm_contacts
      setStatus('Importing Contacts...');
      const contacts = contactsRows;
      if (contacts?.length) {
        for (let i = 0; i < contacts.length; i += 200) {
          const chunk = contacts.slice(i, i + 200).map(r => {
            const sfAcctId = pick(r, 'AccountId', 'Account ID', 'Account Id');
            return {
              first_name: pick(r, 'FirstName', 'First Name') || pick(r, 'Name').split(' ')[0] || 'Unknown',
              last_name: pick(r, 'LastName', 'Last Name') || pick(r, 'Name').split(' ').slice(1).join(' ') || null,
              email: pick(r, 'Email') || null,
              phone: pick(r, 'Phone', 'MobilePhone', 'Mobile Phone') || null,
              title: pick(r, 'Title') || null,
              company_id: sfAcctId ? sfIdToCompanyId.get(sfAcctId) || null : null,
              is_primary: false,
              notes: pick(r, 'Description') || null,
              salesforce_id: pick(r, 'Id', 'Contact ID', 'Contact Id', '18 Digit ID') || null,
              owner_id: uid,
              created_by: uid,
            };
          });
          const { error, count } = await (supabase as any)
            .from('crm_contacts')
            .upsert(chunk, { onConflict: 'salesforce_id', ignoreDuplicates: false, count: 'exact' });
          if (error) { s.errors.push(`Contacts: ${error.message}`); break; }
          s.contacts += count || chunk.length;
          setProgress(35 + Math.round(((i + 200) / contacts.length) * 20));
        }
      } else s.skipped.push('Contact.csv');

      // Opportunities -> crm_leads (Opportunities tab)
      setStatus('Importing Opportunities...');
      const sfIdToLeadId = new Map<string, string>();
      if (opps?.length) {
        // Load pipeline stages once so we can also create matching deals with $ value
        const { data: stagesData } = await (supabase as any)
          .from('crm_pipeline_stages').select('*').eq('active', true).order('sort_order');
        const stages: any[] = stagesData || [];
        const firstStage = stages.find(st => !st.is_won && !st.is_lost) || stages[0];
        const wonStage = stages.find(st => st.is_won);
        const lostStage = stages.find(st => st.is_lost);
        const stageByName = (needle: string) => {
          const n = needle.toLowerCase();
          return stages.find(st => (st.name || '').toLowerCase() === n)
              || stages.find(st => (st.name || '').toLowerCase().includes(n));
        };
        for (let i = 0; i < opps.length; i += 200) {
          const oppSlice = opps.slice(i, i + 200);
          const sfOppIds = oppSlice.map(r => pick(r, 'Id', 'Opportunity ID', 'Opportunity Id', '18 Digit ID'));
          const chunk = oppSlice.map(r => {
            const sfStage = pick(r, 'StageName', 'Stage').toLowerCase();
            const isWon = sfStage.includes('closed won') || sfStage === 'won';
            const isLost = sfStage.includes('closed lost') || sfStage === 'lost';
            const status = isWon ? 'converted'
              : isLost ? 'unqualified'
              : sfStage.includes('qualif') || sfStage.includes('proposal') || sfStage.includes('negotiat') ? 'qualified'
              : sfStage.includes('prospect') || sfStage.includes('contact') ? 'contacted'
              : 'new';
            const sfAcctId = pick(r, 'AccountId', 'Account ID');
            const oppName = pick(r, 'Name', 'Opportunity Name');
            const amount = parseNum(pick(r, 'Amount', 'Opportunity Amount', 'ExpectedRevenue'));
            const prob = parseNum(pick(r, 'Probability', 'Probability (%)'));
            return {
              company_name: pick(r, 'Account Name', 'AccountName') || oppName || 'Untitled Opportunity',
              contact_name: oppName || null,
              source: pick(r, 'LeadSource', 'Lead Source', 'Type') || null,
              lead_source: pick(r, 'LeadSource', 'Lead Source') || null,
              service_line: pick(r, 'Service_Line__c', 'Service Line') || null,
              status,
              company_id: sfAcctId ? sfIdToCompanyId.get(sfAcctId) || null : null,
              amount,
              close_date: parseDate(pick(r, 'CloseDate', 'Close Date')),
              probability: prob,
              type: pick(r, 'Type') || null,
              next_step: pick(r, 'NextStep', 'Next Step') || null,
              description: pick(r, 'Description') || null,
              notes: pick(r, 'StageName', 'Stage') ? `Stage: ${pick(r, 'StageName', 'Stage')}` : null,
              salesforce_id: pick(r, 'Id', 'Opportunity ID', 'Opportunity Id', '18 Digit ID') || null,
              owner_id: uid,
              created_by: uid,
            };
          });
          const { data, error } = await (supabase as any)
            .from('crm_leads')
            .upsert(chunk, { onConflict: 'salesforce_id', ignoreDuplicates: false })
            .select('id, salesforce_id');
          if (error) { s.errors.push(`Opportunities: ${error.message}`); break; }
          data?.forEach((row: any) => {
            if (row.salesforce_id) {
              sfIdToLeadId.set(row.salesforce_id, row.id);
              if (row.salesforce_id.length === 18) sfIdToLeadId.set(row.salesforce_id.slice(0, 15), row.id);
            }
            s.opportunities++;
          });

          // Also upsert matching pipeline deals so the Pipeline Value reflects Salesforce Amount
          if (firstStage && data?.length) {
            const bySfId = new Map<string, string>();
            data.forEach((row: any) => { if (row.salesforce_id) bySfId.set(row.salesforce_id, row.id); });
            const dealRows: any[] = [];
            for (const r of oppSlice) {
              const sfId = pick(r, 'Id', 'Opportunity ID', 'Opportunity Id', '18 Digit ID');
              const leadId = sfId ? bySfId.get(sfId) : null;
              if (!leadId) continue;
              const sfStage = pick(r, 'StageName', 'Stage');
              const sfStageLc = sfStage.toLowerCase();
              const isWon = sfStageLc.includes('closed won') || sfStageLc === 'won';
              const isLost = sfStageLc.includes('closed lost') || sfStageLc === 'lost';
              const stage = isWon ? (wonStage || firstStage)
                : isLost ? (lostStage || firstStage)
                : (sfStage ? (stageByName(sfStage) || firstStage) : firstStage);
              const sfAcctId = pick(r, 'AccountId', 'Account ID');
              const oppName = pick(r, 'Name', 'Opportunity Name') || pick(r, 'Account Name', 'AccountName') || 'Untitled Opportunity';
              const amount = parseNum(pick(r, 'Amount', 'Opportunity Amount', 'ExpectedRevenue'));
              const prob = parseNum(pick(r, 'Probability', 'Probability (%)'));
              const closeDate = parseDate(pick(r, 'CloseDate', 'Close Date'));
              dealRows.push({
                name: oppName,
                lead_id: leadId,
                stage_id: stage.id,
                company_id: sfAcctId ? sfIdToCompanyId.get(sfAcctId) || null : null,
                value: amount,
                probability: prob,
                expected_close_date: closeDate,
                won_at: isWon ? new Date().toISOString() : null,
                lost_at: isLost ? new Date().toISOString() : null,
                owner_id: uid,
                created_by: uid,
              });
            }
            if (dealRows.length) {
              const { error: dealErr } = await (supabase as any)
                .from('crm_deals')
                .upsert(dealRows, { onConflict: 'lead_id', ignoreDuplicates: false });
              if (dealErr) s.errors.push(`Pipeline deals: ${dealErr.message}`);
            }
          }
          setProgress(55 + Math.round(((i + 200) / opps.length) * 25));
        }
      } else s.skipped.push('Opportunity.csv');

      // Notes -> crm_lead_notes (attached to opportunities via ParentId)
      setStatus('Importing Notes...');
      if (notesRows?.length) {
        const noteChunk: any[] = [];
        for (const r of notesRows) {
          const parentId = pick(r, 'ParentId', 'Parent ID', 'Parent Id');
          const leadId = parentId ? sfIdToLeadId.get(parentId) : null;
          if (!leadId) continue; // only import notes attached to imported opportunities
          const title = pick(r, 'Title', 'Name');
          const body = pick(r, 'Body', 'TextPreview', 'Description');
          if (!title && !body) continue;
          noteChunk.push({ lead_id: leadId, title: title || null, content: body || title || '', created_by: uid });
        }
        for (let i = 0; i < noteChunk.length; i += 200) {
          const slice = noteChunk.slice(i, i + 200);
          const { error, count } = await (supabase as any).from('crm_lead_notes').insert(slice, { count: 'exact' });
          if (error) { s.errors.push(`Notes: ${error.message}`); break; }
          s.notes += count || slice.length;
          setProgress(80 + Math.round(((i + 200) / noteChunk.length) * 15));
        }
      } else s.skipped.push('Note.csv');

      // Attachments + ContentVersion -> crm_lead_files (only when uploaded via ZIP)
      setStatus('Importing Files...');
      if (sourceZip && (attachmentsRows?.length || contentVersionsRows?.length)) {
        // Build ContentDocumentId -> Opportunity lead_id map from ContentDocumentLink
        const docToLead = new Map<string, string>();
        if (contentDocLinksRows?.length) {
          for (const r of contentDocLinksRows) {
            const linked = pick(r, 'LinkedEntityId', 'Linked Entity ID');
            const docId = pick(r, 'ContentDocumentId', 'Content Document ID');
            const leadId = linked ? sfIdToLeadId.get(linked) : null;
            if (docId && leadId) docToLead.set(docId, leadId);
          }
        }

        const jobs: Array<{ leadId: string; row: Row; kind: 'attachment' | 'file' }> = [];
        for (const r of attachmentsRows || []) {
          const parentId = pick(r, 'ParentId', 'Parent ID');
          const leadId = parentId ? sfIdToLeadId.get(parentId) : null;
          if (leadId) jobs.push({ leadId, row: r, kind: 'attachment' });
        }
        for (const r of contentVersionsRows || []) {
          if (pick(r, 'IsLatest').toLowerCase() === 'false') continue;
          const docId = pick(r, 'ContentDocumentId', 'Content Document ID');
          const leadId = docId ? docToLead.get(docId) : null;
          if (leadId) jobs.push({ leadId, row: r, kind: 'file' });
        }

        let done = 0;
        for (const job of jobs) {
          const sfId = pick(job.row, 'Id');
          const zipEntry = findZipEntryById(sourceZip, sfId);
          if (!zipEntry) { done++; continue; }
          const fileName = job.kind === 'attachment'
            ? (pick(job.row, 'Name') || sfId)
            : (pick(job.row, 'PathOnClient', 'Title') || sfId);
          const contentType = getSafeContentType(job.row, fileName);
          const sfFileType = pick(job.row, 'FileType', 'File Type').toUpperCase();
          const isSnote = sfFileType === 'SNOTE' || /\.snote$/i.test(fileName);
          if (isSnote) {
            try {
              const bytes = await zipEntry.async('uint8array');
              const html = new TextDecoder('utf-8').decode(bytes);
              // Strip HTML tags to plain text
              const text = html
                .replace(/<style[\s\S]*?<\/style>/gi, '')
                .replace(/<script[\s\S]*?<\/script>/gi, '')
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<\/p>/gi, '\n\n')
                .replace(/<[^>]+>/g, '')
                .replace(/&nbsp;/g, ' ')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/\n{3,}/g, '\n\n')
                .trim();
              const rawTitle = pick(job.row, 'Title') || fileName.replace(/\.snote$/i, '');
              const title = rawTitle && rawTitle !== 'Untitled Note' ? rawTitle : null;
              if (text || title) {
                const { error: nErr } = await (supabase as any).from('crm_lead_notes').insert({
                  lead_id: job.leadId, title, content: text || title || '', created_by: uid,
                });
                if (nErr) s.errors.push(`Note ${title || fileName}: ${nErr.message}`);
                else s.notes++;
              }
            } catch (e: any) {
              s.errors.push(`Note ${fileName}: ${e?.message || e}`);
            }
            done++;
            continue;
          }
          try {
            const bytes = await zipEntry.async('uint8array');
            // Supabase storage caps per-file uploads (typically 50MB). Skip larger files with a friendly note.
            const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
            if (bytes.byteLength > MAX_UPLOAD_BYTES) {
              const mb = (bytes.byteLength / (1024 * 1024)).toFixed(1);
              s.errors.push(`File ${fileName} skipped: ${mb} MB exceeds the 50 MB upload limit.`);
              done++;
              continue;
            }
            const path = `crm-leads/${job.leadId}/${crypto.randomUUID()}-${sanitizeStorageFileName(fileName)}`;
            const { error: upErr } = await supabase.storage
              .from('crm-files')
              .upload(path, bytes, { contentType, upsert: false });
            if (upErr) { s.errors.push(`File ${fileName}: ${upErr.message}`); done++; continue; }
            const { error: insErr } = await (supabase as any).from('crm_lead_files').insert({
              lead_id: job.leadId,
              file_path: path,
              file_name: fileName,
              file_size: bytes.byteLength,
              content_type: contentType,
              uploaded_by: uid,
            });
            if (insErr) { s.errors.push(`File ${fileName}: ${insErr.message}`); done++; continue; }
            s.files++;
          } catch (e: any) {
            s.errors.push(`File ${fileName}: ${e?.message || e}`);
          }
          done++;
          if (done % 5 === 0 || done === jobs.length) {
            setProgress(95 + Math.round((done / Math.max(jobs.length, 1)) * 5));
          }
        }
      }

      setProgress(100);
      setStatus('Done');
      setSummary(s);
      onImported();
      toast({ title: 'Import complete', description: `${s.companies} accounts, ${s.contacts} contacts, ${s.opportunities} opportunities, ${s.notes} notes, ${s.files} files` });
    } catch (err: any) {
      s.errors.push(err.message || String(err));
      setSummary(s);
      toast({ title: 'Import failed', description: err.message, variant: 'destructive' });
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!running) { onOpenChange(o); if (!o) reset(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileArchive className="h-5 w-5" /> Import from Salesforce Export</DialogTitle>
          <DialogDescription>
            Upload the <strong>.zip</strong> from <em>Setup → Data Export</em>, or drop in one or more
            Salesforce <strong>.csv</strong> exports (Account, Contact, Opportunity, Note). UTF-8 and UTF-16
            files are both supported. Leads are ignored — only Accounts, their Contacts, their Opportunities,
            Notes, and file Attachments on those Opportunities are imported. Uploading the ZIP is required
            to import file attachments (raw CSVs don't contain the file bytes).
          </DialogDescription>
        </DialogHeader>

        {!summary && (
          <div className="space-y-4">
            <Input
              type="file"
              accept=".zip,.csv,application/zip,application/x-zip-compressed,text/csv"
              multiple
              disabled={running}
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
            />
            {files.length > 0 && (
              <ul className="text-sm text-muted-foreground space-y-0.5">
                {files.map((f, i) => (
                  <li key={i}>{f.name} — {(f.size / 1024 / 1024).toFixed(2)} MB</li>
                ))}
              </ul>
            )}
            {running && (
              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-sm text-muted-foreground">{status}</p>
              </div>
            )}
          </div>
        )}

        {summary && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-green-600"><CheckCircle2 className="h-5 w-5" /> Import finished</div>
            <ul className="text-sm space-y-1">
              <li>Accounts: <strong>{summary.companies}</strong></li>
              <li>Contacts: <strong>{summary.contacts}</strong></li>
              <li>Opportunities: <strong>{summary.opportunities}</strong></li>
              <li>Notes on opportunities: <strong>{summary.notes}</strong></li>
              <li>Files on opportunities: <strong>{summary.files}</strong></li>
            </ul>
            {summary.skipped.length > 0 && (
              <p className="text-sm text-muted-foreground">Not found in ZIP: {summary.skipped.join(', ')}</p>
            )}
            {summary.errors.length > 0 && (
              <div className="text-sm text-destructive space-y-1">
                <div className="flex items-center gap-1"><AlertCircle className="h-4 w-4" /> Errors:</div>
                {summary.errors.map((e, i) => <div key={i} className="pl-5">• {e}</div>)}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {!summary ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={running}>Cancel</Button>
              <Button onClick={handleImport} disabled={!files.length || running}>
                <Upload className="h-4 w-4 mr-2" />{running ? 'Importing...' : 'Import'}
              </Button>
            </>
          ) : (
            <Button onClick={() => { reset(); onOpenChange(false); }}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}