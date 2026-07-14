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
  leads: number;
  deals: number;
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
  if (/lead/.test(n)) return 'leads';
  if (/contact/.test(n)) return 'contacts';
  if (/account/.test(n)) return 'accounts';
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
    const s: Summary = { companies: 0, contacts: 0, leads: 0, deals: 0, skipped: [], errors: [] };

    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) throw new Error('You must be signed in.');

      setStatus('Reading files...');
      // Assemble entity-to-rows map from either a ZIP or one/many CSVs
      let accounts: Row[] | null = null;
      let contactsRows: Row[] | null = null;
      let leadsRows: Row[] | null = null;
      let opps: Row[] | null = null;

      for (const f of files) {
        const isZip = /\.zip$/i.test(f.name) || f.type.includes('zip');
        if (isZip) {
          const zip = await JSZip.loadAsync(f);
          accounts = accounts ?? await readCsvFromZip(zip, [/(^|\/)Account(s)?\.csv$/i, /accounts?_/i]);
          contactsRows = contactsRows ?? await readCsvFromZip(zip, [/(^|\/)Contact(s)?\.csv$/i, /contacts?_/i]);
          leadsRows = leadsRows ?? await readCsvFromZip(zip, [/(^|\/)Lead(s)?\.csv$/i, /leads?_/i]);
          opps = opps ?? await readCsvFromZip(zip, [/(^|\/)Opportunit(y|ies)\.csv$/i, /opportunit/i]);
        } else {
          const entity = detectEntity(f.name);
          if (!entity) { s.skipped.push(`${f.name} (unrecognized)`); continue; }
          const rows = await readCsvFile(f);
          if (entity === 'accounts') accounts = rows;
          else if (entity === 'contacts') contactsRows = rows;
          else if (entity === 'leads') leadsRows = rows;
          else if (entity === 'opportunities') opps = rows;
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
            owner_id: uid,
            created_by: uid,
          }));
          const sfIds = accounts.slice(i, i + 200).map(r => pick(r, 'Id', 'Account ID', 'Account Id', '18 Digit ID', '18-Digit ID'));
          const { data, error } = await (supabase as any).from('crm_companies').insert(chunk).select('id');
          if (error) { s.errors.push(`Accounts: ${error.message}`); break; }
          data?.forEach((row: any, idx: number) => {
            if (sfIds[idx]) sfIdToCompanyId.set(sfIds[idx], row.id);
            s.companies++;
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
              owner_id: uid,
              created_by: uid,
            };
          });
          const { error, count } = await (supabase as any).from('crm_contacts').insert(chunk, { count: 'exact' });
          if (error) { s.errors.push(`Contacts: ${error.message}`); break; }
          s.contacts += count || chunk.length;
          setProgress(35 + Math.round(((i + 200) / contacts.length) * 20));
        }
      } else s.skipped.push('Contact.csv');

      // Leads -> crm_leads
      setStatus('Importing Leads...');
      const leads = leadsRows;
      if (leads?.length) {
        for (let i = 0; i < leads.length; i += 200) {
          const chunk = leads.slice(i, i + 200).map(r => {
            const first = pick(r, 'FirstName', 'First Name');
            const last = pick(r, 'LastName', 'Last Name');
            const name = [first, last].filter(Boolean).join(' ') || pick(r, 'Name') || 'Unknown Lead';
            const sfStatus = pick(r, 'Status').toLowerCase();
            const status = sfStatus.includes('qualified') ? 'qualified'
              : sfStatus.includes('working') || sfStatus.includes('contacted') ? 'contacted'
              : sfStatus.includes('unqualified') || sfStatus.includes('lost') ? 'lost'
              : 'new';
            return {
              name,
              email: pick(r, 'Email') || null,
              phone: pick(r, 'Phone', 'MobilePhone') || null,
              company: pick(r, 'Company') || null,
              source: pick(r, 'LeadSource', 'Lead Source') || null,
              status,
              notes: pick(r, 'Description') || null,
              owner_id: uid,
              created_by: uid,
            };
          });
          const { error, count } = await (supabase as any).from('crm_leads').insert(chunk, { count: 'exact' });
          if (error) { s.errors.push(`Leads: ${error.message}`); break; }
          s.leads += count || chunk.length;
          setProgress(55 + Math.round(((i + 200) / leads.length) * 20));
        }
      } else s.skipped.push('Lead.csv');

      // Opportunities -> crm_deals (needs stage_id)
      setStatus('Importing Opportunities...');
      if (opps?.length) {
        const { data: stagesData } = await (supabase as any)
          .from('crm_pipeline_stages').select('*').eq('active', true).order('sort_order');
        const stages = stagesData || [];
        const wonStage = stages.find((s: any) => s.is_won) || stages[stages.length - 1];
        const lostStage = stages.find((s: any) => s.is_lost) || stages[stages.length - 1];
        const defaultStage = stages.find((s: any) => !s.is_won && !s.is_lost) || stages[0];

        if (!defaultStage) {
          s.errors.push('Opportunities: no pipeline stages configured.');
        } else {
          for (let i = 0; i < opps.length; i += 200) {
            const chunk = opps.slice(i, i + 200).map(r => {
              const sfStage = pick(r, 'StageName', 'Stage').toLowerCase();
              const isWon = sfStage.includes('closed won') || sfStage === 'won';
              const isLost = sfStage.includes('closed lost') || sfStage === 'lost';
              const stage = isWon ? wonStage : isLost ? lostStage : defaultStage;
              const sfAcctId = pick(r, 'AccountId', 'Account ID');
              const closeDate = parseDate(pick(r, 'CloseDate', 'Close Date'));
              return {
                name: pick(r, 'Name', 'Opportunity Name') || 'Untitled Opportunity',
                stage_id: stage.id,
                value: parseNum(pick(r, 'Amount')),
                expected_close_date: closeDate,
                probability: Number(pick(r, 'Probability')) || null,
                company_id: sfAcctId ? sfIdToCompanyId.get(sfAcctId) || null : null,
                won_at: isWon ? (closeDate ? new Date(closeDate).toISOString() : new Date().toISOString()) : null,
                lost_at: isLost ? (closeDate ? new Date(closeDate).toISOString() : new Date().toISOString()) : null,
                lost_reason: isLost ? pick(r, 'LossReason', 'Loss Reason') || null : null,
                notes: pick(r, 'Description') || null,
                owner_id: uid,
                created_by: uid,
              };
            });
            const { error, count } = await (supabase as any).from('crm_deals').insert(chunk, { count: 'exact' });
            if (error) { s.errors.push(`Opportunities: ${error.message}`); break; }
            s.deals += count || chunk.length;
            setProgress(75 + Math.round(((i + 200) / opps.length) * 20));
          }
        }
      } else s.skipped.push('Opportunity.csv');

      setProgress(100);
      setStatus('Done');
      setSummary(s);
      onImported();
      toast({ title: 'Import complete', description: `${s.companies} companies, ${s.contacts} contacts, ${s.leads} leads, ${s.deals} deals` });
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
            Upload the <strong>.zip</strong> file Salesforce emails you from <em>Setup → Data Export</em>.
            We'll map Accounts → Companies, Contacts, Leads, and Opportunities → Deals.
          </DialogDescription>
        </DialogHeader>

        {!summary && (
          <div className="space-y-4">
            <Input
              type="file"
              accept=".zip,application/zip,application/x-zip-compressed"
              disabled={running}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            {file && <p className="text-sm text-muted-foreground">{file.name} — {(file.size / 1024 / 1024).toFixed(2)} MB</p>}
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
              <li>Companies: <strong>{summary.companies}</strong></li>
              <li>Contacts: <strong>{summary.contacts}</strong></li>
              <li>Leads: <strong>{summary.leads}</strong></li>
              <li>Deals: <strong>{summary.deals}</strong></li>
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
              <Button onClick={handleImport} disabled={!file || running}>
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