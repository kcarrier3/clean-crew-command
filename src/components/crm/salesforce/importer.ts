import JSZip from 'jszip';
import { supabase } from '@/integrations/supabase/client';
import {
  Row, pick, k15, isSfId, sfPrefix, parseNum, parseInteger, parseDate, parseTimestamp,
  decodeCsvBytes, parseCsvText, getSafeContentType, sanitizeStorageFileName,
  sanitizeNoteHtml, htmlToPlainText,
} from './sfUtils';

// ---------------------------------------------------------------- reporting -

export interface Outcome {
  sfId: string;
  label: string;
  reason: string;
}

export interface ObjectStat {
  object: string;
  sourceRows: number;
  inserted: number;
  updated: number;
  alreadyPresent: number;
  skipped: Outcome[];
  failed: Outcome[];
}

export interface PreflightPart {
  fileName: string;
  kind: 'zip' | 'csv';
  objects: Record<string, number>;
  binaryEntries: number;
}

export interface ImportReport {
  preflight: PreflightPart[];
  stats: Record<string, ObjectStat>;
  relationshipExceptions: Outcome[];
  bodiesMissing: Outcome[];
  fatalError?: string;
}

const newStat = (object: string): ObjectStat => ({
  object, sourceRows: 0, inserted: 0, updated: 0, alreadyPresent: 0, skipped: [], failed: [],
});

// ------------------------------------------------------------- zip indexing -

interface BinaryEntry { zipFile: JSZip.JSZipObject; path: string; }

/** Every binary in the export, indexed by every id-ish token found in its path. */
class BinaryIndex {
  private byToken = new Map<string, BinaryEntry>();
  private all: BinaryEntry[] = [];

  add(path: string, zipFile: JSZip.JSZipObject) {
    const entry: BinaryEntry = { zipFile, path };
    this.all.push(entry);
    for (const segment of path.split(/[\\/]/)) {
      const bare = segment.replace(/\.[^.]+$/, '');
      for (const candidate of [segment, bare]) {
        if (isSfId(candidate)) {
          const key = k15(candidate);
          if (!this.byToken.has(key)) this.byToken.set(key, entry);
        }
      }
    }
    // Also index by the full relative path (used for ContentVersion.VersionData).
    const normalized = path.replace(/^\/+/, '').toLowerCase();
    if (!this.byToken.has(normalized)) this.byToken.set(normalized, entry);
  }

  find(...candidates: string[]): BinaryEntry | null {
    for (const c of candidates) {
      if (!c) continue;
      const direct = this.byToken.get(k15(c));
      if (direct) return direct;
      const byPath = this.byToken.get(c.replace(/^\/+/, '').toLowerCase());
      if (byPath) return byPath;
    }
    return null;
  }

  get size() { return this.all.length; }
}

// Which CSV inside the export maps to which Salesforce object.
const CSV_MATCHERS: Array<{ object: string; test: RegExp }> = [
  // Related/child objects that are NOT real records — must be checked before the
  // broad /opportunit/ matcher or history snapshots become "Untitled Opportunity".
  { object: '__ignore__', test: /opportunity(history|fieldhistory|lineitem|share|teammember|competitor|partner|stage|split|tag|feed)/i },
  { object: '__ignore__', test: /(accounthistory|contacthistory|leadhistory|casehistory|_history)\b/i },
  // Junction / sharing / feed objects around Account & Contact must never be
  // mistaken for the real Account or Contact export.
  { object: '__ignore__', test: /account(share|teammember|contactrole|contactrelation|partner|feed|tag|brand|cleaninfo)/i },
  { object: '__ignore__', test: /contact(share|feed|tag|cleaninfo|pointofcontact|requestcapture)/i },
  { object: 'ContentDocumentLink', test: /contentdocumentlink/i },
  { object: 'ContentDocument', test: /contentdocument(?!link)/i },
  { object: 'ContentVersion', test: /contentversion/i },
  { object: 'OpportunityContactRole', test: /opportunitycontactrole/i },
  { object: 'Opportunity', test: /opportunit/i },
  { object: 'Attachment', test: /attachment/i },
  { object: 'Note', test: /(^|[\\/_-])notes?\b|notes?\.csv$/i },
  { object: 'Task', test: /(^|[\\/_-])tasks?\b|tasks?\.csv$/i },
  // Real Account exports first: "Account.csv", "Accounts.csv", "001_Account.csv",
  // "WE_Account_1.csv" … Checked before the generic /contact/ matcher so an
  // "Account" file is never swallowed by a contact-ish token in its path.
  { object: 'Account', test: /(^|[\\/_\- ])accounts?([\\/_\- .]|$)/i },
  { object: 'Contact', test: /contact/i },
  { object: 'Account', test: /account/i },
];

function classifyCsv(name: string): string | null {
  const base = name.split(/[\\/]/).pop() || name;
  const object = CSV_MATCHERS.find((m) => m.test.test(base))?.object ?? null;
  return object === '__ignore__' ? null : object;
}

/** True when the file name matched an explicitly ignored child/history object. */
function isIgnoredCsv(name: string): boolean {
  const base = name.split(/[\\/]/).pop() || name;
  return CSV_MATCHERS.find((m) => m.test.test(base))?.object === '__ignore__';
}

/**
 * A CSV whose file name did not classify can still be identified from its
 * headers + the key prefix of its Id column. This is what keeps the import
 * working for renamed / non-standard export layouts.
 */
function classifyByContent(rows: Row[]): string | null {
  const first = rows[0];
  if (!first) return null;
  const headers = Object.keys(first).map((h) => h.trim().toLowerCase());
  const has = (h: string) => headers.includes(h);
  const id = pick(first, 'Id', '18 Digit ID', 'Record ID');
  const prefix = sfPrefix(id).toUpperCase();
  if (prefix === '001' && has('name')) return 'Account';
  if (prefix === '003') return 'Contact';
  if (prefix === '006' && (has('stagename') || has('closedate'))) return 'Opportunity';
  if (prefix === '00T') return 'Task';
  return null;
}

// ------------------------------------------------------------ upsert plumbing

type ProgressFn = (pct: number, status: string) => void;

async function upsertChunked(
  table: string,
  rows: any[],
  conflict: string,
  stat: ObjectStat,
  existing: Set<string>,
  labelOf: (r: any) => string,
  select = 'id, salesforce_id',
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const { data, error } = await (supabase as any)
      .from(table).upsert(chunk, { onConflict: conflict, ignoreDuplicates: false }).select(select);
    if (error) {
      // One bad row must not lose the rest of the chunk — retry row by row.
      for (const row of chunk) {
        const { data: one, error: rowErr } = await (supabase as any)
          .from(table).upsert([row], { onConflict: conflict, ignoreDuplicates: false }).select(select);
        if (rowErr) {
          stat.failed.push({ sfId: row.salesforce_id || '', label: labelOf(row), reason: rowErr.message });
          continue;
        }
        one?.forEach((r: any) => registerResult(r, out, stat));
      }
      continue;
    }
    data?.forEach((r: any) => registerResult(r, out, stat));
  }
  // inserted vs updated is derived from the pre-import snapshot of salesforce_ids
  out.forEach((_id, sfId) => { if (existing.has(sfId)) stat.updated++; else stat.inserted++; });
  return out;
}

function registerResult(r: any, out: Map<string, string>, _stat: ObjectStat) {
  if (!r?.salesforce_id) return;
  out.set(k15(r.salesforce_id), r.id);
}

async function fetchExistingSfIds(table: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let from = 0;
  for (;;) {
    const { data, error } = await (supabase as any)
      .from(table).select('id, salesforce_id').not('salesforce_id', 'is', null).range(from, from + 999);
    if (error || !data?.length) break;
    data.forEach((r: any) => map.set(k15(r.salesforce_id), r.id));
    if (data.length < 1000) break;
    from += 1000;
  }
  return map;
}

// ------------------------------------------------------------- the resolver -

type ParentKind = 'account' | 'contact' | 'opportunity' | 'task';
interface Resolved { kind: ParentKind; id: string; }

class SfResolver {
  private map = new Map<string, Resolved>();
  set(sfId: string, kind: ParentKind, id: string) {
    if (sfId) this.map.set(k15(sfId), { kind, id });
  }
  get(sfId: string): Resolved | null {
    if (!sfId) return null;
    return this.map.get(k15(sfId)) ?? null;
  }
  /** Parent columns for crm_lead_notes / crm_lead_files. */
  columns(sfId: string): Record<string, string | null> | null {
    const r = this.get(sfId);
    if (!r) return null;
    return {
      parent_type: r.kind,
      lead_id: r.kind === 'opportunity' ? r.id : null,
      company_id: r.kind === 'account' ? r.id : null,
      contact_id: r.kind === 'contact' ? r.id : null,
      task_id: r.kind === 'task' ? r.id : null,
      sf_parent_id: sfId,
    };
  }
}

const describePrefix = (id: string) => {
  switch (sfPrefix(id)) {
    case '001': return 'Account';
    case '003': return 'Contact';
    case '006': return 'Opportunity';
    case '00T': return 'Task';
    case '00U': return 'Event';
    case '00Q': return 'Lead';
    case '005': return 'User';
    default: return 'unsupported object';
  }
};

// ------------------------------------------------------------- stage mapping

const normalizeStageName = (value: string): string =>
  value.toLowerCase().replace(/\([^)]*\)/g, '').replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();
const stageKey = (value: string) => normalizeStageName(value).replace(/\s+/g, '');

// =============================================================== main import =

export async function runSalesforceImport(
  inputFiles: File[],
  uid: string,
  onProgress: ProgressFn,
): Promise<ImportReport> {
  const report: ImportReport = { preflight: [], stats: {}, relationshipExceptions: [], bodiesMissing: [] };
  const stat = (o: string) => (report.stats[o] ??= newStat(o));

  const csvs: Record<string, Row[]> = {};
  const binaries = new BinaryIndex();

  // ---------------------------------------------------------- 1. read parts --
  onProgress(2, 'Reading export parts…');
  for (const file of inputFiles) {
    const isZip = /\.zip$/i.test(file.name) || file.type.includes('zip');
    const part: PreflightPart = { fileName: file.name, kind: isZip ? 'zip' : 'csv', objects: {}, binaryEntries: 0 };
    if (isZip) {
      const zip = await JSZip.loadAsync(file);
      for (const name of Object.keys(zip.files)) {
        const entry = zip.files[name];
        if (entry.dir) continue;
        if (/\.csv$/i.test(name)) {
          const object = classifyCsv(name);
          if (!object) continue;
          const rows = parseCsvText(decodeCsvBytes(await entry.async('uint8array')));
          (csvs[object] ??= []).push(...rows);          // merge across every part
          part.objects[object] = (part.objects[object] || 0) + rows.length;
        } else {
          binaries.add(name, entry);
          part.binaryEntries++;
        }
      }
    } else {
      const object = classifyCsv(file.name);
      if (object) {
        const rows = parseCsvText(decodeCsvBytes(new Uint8Array(await file.arrayBuffer())));
        (csvs[object] ??= []).push(...rows);
        part.objects[object] = rows.length;
      }
    }
    report.preflight.push(part);
  }

  const resolver = new SfResolver();

  // ------------------------------------------------------------ 2. Accounts --
  onProgress(10, 'Importing Accounts…');
  {
    const st = stat('Account');
    const rows = csvs.Account || [];
    st.sourceRows = rows.length;
    const existing = new Set((await fetchExistingSfIds('crm_companies')).keys());
    const payload: any[] = [];
    for (const r of rows) {
      const sfId = pick(r, 'Id', 'Account ID', 'Account Id', '18 Digit ID', '18-Digit ID');
      const name = pick(r, 'Name', 'Account Name');
      if (!sfId) { st.skipped.push({ sfId: '', label: name, reason: 'No Salesforce Id column' }); continue; }
      if (!name) { st.skipped.push({ sfId, label: '(unnamed)', reason: 'Account has no Name' }); continue; }
      payload.push({
        name,                                    // exact Salesforce Account Name
        industry: pick(r, 'Industry') || null,
        website: pick(r, 'Website') || null,
        phone: pick(r, 'Phone') || null,
        address: pick(r, 'BillingStreet', 'Billing Street', 'ShippingStreet') || null,
        city: pick(r, 'BillingCity', 'Billing City', 'ShippingCity') || null,
        state: pick(r, 'BillingState', 'Billing State', 'ShippingState') || null,
        zip: pick(r, 'BillingPostalCode', 'Billing Zip/Postal Code', 'ShippingPostalCode') || null,
        notes: pick(r, 'Description') || null,
        annual_revenue: parseNum(pick(r, 'AnnualRevenue', 'Annual Revenue')),
        employee_count: parseInteger(pick(r, 'NumberOfEmployees', 'Employees')),
        salesforce_id: sfId,
        sf_owner_id: pick(r, 'OwnerId', 'Owner ID') || null,
        sf_created_date: parseTimestamp(pick(r, 'CreatedDate', 'Created Date')),
        sf_last_modified_date: parseTimestamp(pick(r, 'LastModifiedDate', 'Last Modified Date')),
        owner_id: uid,
        created_by: uid,
      });
    }
    const ids = await upsertChunked('crm_companies', payload, 'salesforce_id', st, existing, (r) => r.name);
    ids.forEach((id, sf) => resolver.set(sf, 'account', id));
    // Records that already existed but were not in this export still need resolving.
    (await fetchExistingSfIds('crm_companies')).forEach((id, sf) => { if (!ids.has(sf)) resolver.set(sf, 'account', id); });
  }

  // ------------------------------------------------------------ 3. Contacts --
  onProgress(22, 'Importing Contacts…');
  {
    const st = stat('Contact');
    const rows = csvs.Contact || [];
    st.sourceRows = rows.length;
    const existing = new Set((await fetchExistingSfIds('crm_contacts')).keys());
    const payload: any[] = [];
    for (const r of rows) {
      const sfId = pick(r, 'Id', 'Contact ID', 'Contact Id', '18 Digit ID');
      const fullName = pick(r, 'Name');
      if (!sfId) { st.skipped.push({ sfId: '', label: fullName, reason: 'No Salesforce Id column' }); continue; }
      const sfAcct = pick(r, 'AccountId', 'Account ID', 'Account Id');
      const account = sfAcct ? resolver.get(sfAcct) : null;
      if (sfAcct && !account) {
        report.relationshipExceptions.push({ sfId, label: fullName || sfId, reason: `Contact AccountId ${sfAcct} not found in this import` });
      }
      payload.push({
        first_name: pick(r, 'FirstName', 'First Name') || fullName.split(' ')[0] || 'Unknown',
        last_name: pick(r, 'LastName', 'Last Name') || fullName.split(' ').slice(1).join(' ') || null,
        email: pick(r, 'Email') || null,
        phone: pick(r, 'Phone', 'MobilePhone', 'Mobile Phone') || null,
        title: pick(r, 'Title') || null,
        company_id: account?.kind === 'account' ? account.id : null,
        notes: pick(r, 'Description') || null,
        salesforce_id: sfId,
        sf_owner_id: pick(r, 'OwnerId', 'Owner ID') || null,
        sf_created_date: parseTimestamp(pick(r, 'CreatedDate', 'Created Date')),
        sf_last_modified_date: parseTimestamp(pick(r, 'LastModifiedDate', 'Last Modified Date')),
        owner_id: uid,
        created_by: uid,
      });
    }
    const ids = await upsertChunked('crm_contacts', payload, 'salesforce_id', st, existing, (r) => `${r.first_name} ${r.last_name ?? ''}`);
    ids.forEach((id, sf) => resolver.set(sf, 'contact', id));
    (await fetchExistingSfIds('crm_contacts')).forEach((id, sf) => { if (!ids.has(sf)) resolver.set(sf, 'contact', id); });
  }

  // ------------------------------------------------------- 4. Opportunities --
  onProgress(38, 'Importing Opportunities…');
  {
    const st = stat('Opportunity');
    const rows = csvs.Opportunity || [];
    st.sourceRows = rows.length;
    const existing = new Set((await fetchExistingSfIds('crm_leads')).keys());

    const { data: stagesData } = await (supabase as any)
      .from('crm_pipeline_stages').select('*').eq('active', true).order('sort_order');
    const stages: any[] = stagesData || [];
    const firstStage = stages.find((s) => !s.is_won && !s.is_lost) || stages[0];
    const wonStage = stages.find((s) => s.is_won);
    const lostStage = stages.find((s) => s.is_lost);
    const stageByName = (needle: string) => {
      const n = normalizeStageName(needle);
      const compact = stageKey(needle);
      if (!n) return null;
      const list = stages.map((s) => ({ stage: s, normalized: normalizeStageName(s.name || ''), compact: stageKey(s.name || '') }));
      return list.find((s) => s.normalized === n)?.stage
          || list.find((s) => s.compact === compact)?.stage
          || list.find((s) => s.normalized.includes(n) || n.includes(s.normalized))?.stage
          || null;
    };
    const stageFor = (sfStage: string) => {
      const n = normalizeStageName(sfStage);
      const compact = n.replace(/\s+/g, '');
      if (!n) return firstStage || null;
      if (n.includes('lost')) return lostStage || stageByName('Lost') || firstStage || null;
      if (n.includes('closed won') || n === 'won') return wonStage || stageByName('Closed') || firstStage || null;
      const exact = stageByName(sfStage);
      if (exact) return exact;
      if (compact.includes('prequal')) return stageByName('Pre-Qualification') || firstStage || null;
      if (n.includes('award')) return stageByName('Award Status') || firstStage || null;
      if (n.includes('sched')) return stageByName('Scheduling') || firstStage || null;
      if (n.includes('bill')) return stageByName('Billing') || firstStage || null;
      if (n.includes('proposal') || n.includes('quote')) return stageByName('Proposal') || firstStage || null;
      if (n.includes('analysis')) return stageByName('Analysis') || firstStage || null;
      if (n.includes('lead') || n.includes('prospect')) return stageByName('Lead') || firstStage || null;
      return firstStage || null;
    };
    const statusFor = (sfStage: string) => {
      const n = normalizeStageName(sfStage);
      if (n.includes('lost')) return 'unqualified';
      if (n.includes('closed won') || n === 'won') return 'converted';
      if (n.includes('qualif') || n.includes('proposal') || n.includes('award') || n.includes('sched') || n.includes('bill')) return 'qualified';
      if (n.includes('analysis') || n.includes('contact')) return 'contacted';
      return 'new';
    };

    // OpportunityContactRole → the authoritative primary contact per opportunity.
    const primaryContactBySfOpp = new Map<string, string>();
    for (const r of csvs.OpportunityContactRole || []) {
      const oppId = pick(r, 'OpportunityId', 'Opportunity ID');
      const contactId = pick(r, 'ContactId', 'Contact ID');
      const isPrimary = /^(true|1|yes)$/i.test(pick(r, 'IsPrimary', 'Is Primary'));
      const resolvedContact = resolver.get(contactId);
      if (!oppId || resolvedContact?.kind !== 'contact') continue;
      if (isPrimary || !primaryContactBySfOpp.has(k15(oppId))) primaryContactBySfOpp.set(k15(oppId), resolvedContact.id);
    }
    if (csvs.OpportunityContactRole) stat('OpportunityContactRole').sourceRows = csvs.OpportunityContactRole.length;

    const payload: any[] = [];
    const dealSeed: Array<{ sfId: string; row: Row }> = [];
    for (const r of rows) {
      const sfId = pick(r, 'Id', 'Opportunity ID', 'Opportunity Id', '18 Digit ID');
      const oppName = pick(r, 'Name', 'Opportunity Name');
      if (!sfId) { st.skipped.push({ sfId: '', label: oppName, reason: 'No Salesforce Id column' }); continue; }
      // Real Opportunity records always start with the 006 key prefix. Anything
      // else (008 history, 00k line items, …) is a child object, not an opportunity.
      if (!/^006/i.test(sfId)) {
        st.skipped.push({ sfId, label: oppName || sfId, reason: 'Not an Opportunity record (unexpected Salesforce Id prefix)' });
        continue;
      }
      const sfStage = pick(r, 'StageName', 'Stage');
      const sfAcct = pick(r, 'AccountId', 'Account ID');
      const account = sfAcct ? resolver.get(sfAcct) : null;
      if (sfAcct && !account) {
        report.relationshipExceptions.push({ sfId, label: oppName || sfId, reason: `Opportunity AccountId ${sfAcct} not found in this import` });
      }
      payload.push({
        // Account Name is preserved exactly; opportunity name lives in contact_name,
        // which is what the Opportunity UI already labels "Opportunity Name".
        company_name: pick(r, 'Account Name', 'AccountName') || oppName || 'Untitled Opportunity',
        contact_name: oppName || null,
        source: pick(r, 'LeadSource', 'Lead Source', 'Type') || null,
        lead_source: pick(r, 'LeadSource', 'Lead Source') || null,
        service_line: pick(r, 'Service_Line__c', 'Service Line') || null,
        status: statusFor(sfStage),
        company_id: account?.kind === 'account' ? account.id : null,
        primary_contact_id: primaryContactBySfOpp.get(k15(sfId)) ?? null,
        amount: parseNum(pick(r, 'Amount', 'Opportunity Amount')),
        close_date: parseDate(pick(r, 'CloseDate', 'Close Date')),
        probability: parseInteger(pick(r, 'Probability', 'Probability (%)')),
        stage_id: stageFor(sfStage)?.id || null,
        type: pick(r, 'Type') || null,
        next_step: pick(r, 'NextStep', 'Next Step') || null,
        description: pick(r, 'Description') || null,
        // `notes` is a free-text field owned by the user — never overwrite it
        // with a synthetic "Stage: x" string.
        salesforce_id: sfId,
        sf_owner_id: pick(r, 'OwnerId', 'Owner ID') || null,
        sf_created_date: parseTimestamp(pick(r, 'CreatedDate', 'Created Date')),
        sf_last_modified_date: parseTimestamp(pick(r, 'LastModifiedDate', 'Last Modified Date')),
        owner_id: uid,
        created_by: uid,
      });
      dealSeed.push({ sfId, row: r });
    }
    const ids = await upsertChunked('crm_leads', payload, 'salesforce_id', st, existing, (r) => r.contact_name || r.company_name);
    ids.forEach((id, sf) => resolver.set(sf, 'opportunity', id));
    (await fetchExistingSfIds('crm_leads')).forEach((id, sf) => { if (!ids.has(sf)) resolver.set(sf, 'opportunity', id); });

    // Mirror into crm_deals so Pipeline Value reflects Salesforce Amount.
    const dealStat = stat('Pipeline deal');
    const dealRows: any[] = [];
    for (const { sfId, row: r } of dealSeed) {
      const leadId = ids.get(k15(sfId));
      if (!leadId) continue;
      const sfStage = pick(r, 'StageName', 'Stage');
      const n = normalizeStageName(sfStage);
      const isWon = n.includes('closed won') || n === 'won';
      const isLost = n.includes('lost');
      // Use the Salesforce CloseDate / LastModifiedDate — never the import date.
      const closedAt = parseTimestamp(pick(r, 'CloseDate', 'Close Date'))
        || parseTimestamp(pick(r, 'LastModifiedDate', 'Last Modified Date'));
      const sfAcct = pick(r, 'AccountId', 'Account ID');
      const account = sfAcct ? resolver.get(sfAcct) : null;
      dealRows.push({
        name: pick(r, 'Name', 'Opportunity Name') || 'Untitled Opportunity',
        lead_id: leadId,
        stage_id: stageFor(sfStage)?.id || firstStage?.id || null,
        company_id: account?.kind === 'account' ? account.id : null,
        value: parseNum(pick(r, 'Amount', 'Opportunity Amount')) ?? 0,
        probability: parseInteger(pick(r, 'Probability', 'Probability (%)')),
        expected_close_date: parseDate(pick(r, 'CloseDate', 'Close Date')),
        won_at: isWon ? closedAt : null,
        lost_at: isLost ? closedAt : null,
        owner_id: uid,
        created_by: uid,
      });
    }
    dealStat.sourceRows = dealRows.length;
    for (let i = 0; i < dealRows.length; i += 200) {
      const chunk = dealRows.slice(i, i + 200);
      const { error } = await (supabase as any).from('crm_deals').upsert(chunk, { onConflict: 'lead_id', ignoreDuplicates: false });
      if (error) {
        for (const one of chunk) {
          const { error: e2 } = await (supabase as any).from('crm_deals').upsert([one], { onConflict: 'lead_id' });
          if (e2) dealStat.failed.push({ sfId: '', label: one.name, reason: e2.message });
          else dealStat.updated++;
        }
      } else dealStat.updated += chunk.length;
    }
  }

  // --------------------------------------------------------------- 5. Tasks --
  onProgress(55, 'Importing Tasks…');
  {
    const st = stat('Task');
    const rows = csvs.Task || [];
    st.sourceRows = rows.length;
    const existing = new Set((await fetchExistingSfIds('crm_tasks')).keys());
    const payload: any[] = [];
    for (const r of rows) {
      const sfId = pick(r, 'Id', 'Task ID', 'Task Id', '18 Digit ID');
      const subject = pick(r, 'Subject', 'Title') || '(no subject)';
      if (!sfId) { st.skipped.push({ sfId: '', label: subject, reason: 'No Salesforce Id column' }); continue; }
      const whoId = pick(r, 'WhoId', 'Who ID');      // Contact or Lead
      const whatId = pick(r, 'WhatId', 'What ID');   // Account, Opportunity, …
      const who = whoId ? resolver.get(whoId) : null;
      const what = whatId ? resolver.get(whatId) : null;
      if (whoId && !who) report.relationshipExceptions.push({ sfId, label: subject, reason: `Task WhoId ${whoId} (${describePrefix(whoId)}) not resolvable` });
      if (whatId && !what) report.relationshipExceptions.push({ sfId, label: subject, reason: `Task WhatId ${whatId} (${describePrefix(whatId)}) not resolvable` });
      const sfStatus = pick(r, 'Status');
      const sfPriority = pick(r, 'Priority');
      const isClosed = /^(true|1|yes)$/i.test(pick(r, 'IsClosed')) || /complete|closed/i.test(sfStatus);
      const priorityMap: Record<string, string> = { high: 'high', normal: 'normal', low: 'low', urgent: 'urgent' };
      const statusMap = (s: string): string => {
        const n = s.toLowerCase();
        if (/complete|closed/.test(n)) return 'done';
        if (/progress|started/.test(n)) return 'in_progress';
        if (/defer|cancel/.test(n)) return 'cancelled';
        return 'open';
      };
      payload.push({
        title: subject,
        description: pick(r, 'Description') || null,
        due_at: parseTimestamp(pick(r, 'ActivityDate', 'Due Date Only', 'Due Date')),
        priority: priorityMap[sfPriority.toLowerCase()] || 'normal',
        status: statusMap(sfStatus),
        completed_at: isClosed
          ? (parseTimestamp(pick(r, 'CompletedDateTime', 'Completed Date')) || parseTimestamp(pick(r, 'LastModifiedDate')))
          : null,
        company_id: what?.kind === 'account' ? what.id : (who?.kind === 'account' ? who.id : null),
        lead_id: what?.kind === 'opportunity' ? what.id : null,
        contact_id: who?.kind === 'contact' ? who.id : (what?.kind === 'contact' ? what.id : null),
        salesforce_id: sfId,
        sf_who_id: whoId || null,
        sf_what_id: whatId || null,
        sf_status: sfStatus || null,
        sf_priority: sfPriority || null,
        sf_owner_id: pick(r, 'OwnerId', 'Owner ID') || null,
        sf_created_by_id: pick(r, 'CreatedById', 'Created By ID') || null,
        sf_created_date: parseTimestamp(pick(r, 'CreatedDate', 'Created Date')),
        sf_last_modified_date: parseTimestamp(pick(r, 'LastModifiedDate', 'Last Modified Date')),
        created_by: uid,
      });
    }
    const ids = await upsertChunked('crm_tasks', payload, 'salesforce_id', st, existing, (r) => r.title);
    ids.forEach((id, sf) => resolver.set(sf, 'task', id));
  }

  // --------------------------------------------------------------- 6. Notes --
  onProgress(68, 'Importing Notes…');
  await importNotes(csvs, resolver, uid, report, stat('Note'));

  // ---------------------------------- 7. Files (Attachments + ContentVersion) --
  onProgress(80, 'Importing Files…');
  await importFiles(csvs, binaries, resolver, uid, report, onProgress);

  onProgress(100, 'Done');
  return report;
}

// -------------------------------------------------------------- notes step --

async function importNotes(
  csvs: Record<string, Row[]>, resolver: SfResolver, uid: string,
  report: ImportReport, st: ObjectStat,
) {
  const rows = csvs.Note || [];
  st.sourceRows = rows.length;
  if (!rows.length) return;

  const existing = await fetchExistingSfIds('crm_lead_notes');
  for (const r of rows) {
    const sfId = pick(r, 'Id', 'Note ID', '18 Digit ID');
    const title = pick(r, 'Title', 'Name');
    const body = pick(r, 'Body', 'TextPreview', 'Description');
    const parentSfId = pick(r, 'ParentId', 'Parent ID', 'Parent Id');
    if (!title && !body) { st.skipped.push({ sfId, label: title || sfId, reason: 'Note has no title or body' }); continue; }
    const parent = resolver.columns(parentSfId);
    if (!parent) {
      st.skipped.push({ sfId, label: title || sfId, reason: `ParentId ${parentSfId || '(empty)'} → ${describePrefix(parentSfId)} not present in CrewCompass` });
      report.relationshipExceptions.push({ sfId, label: title || sfId, reason: `Note parent ${parentSfId} unresolved` });
      continue;
    }
    const payload: any = {
      ...parent,
      title: title || null,
      content: body || title || '',
      salesforce_id: sfId || null,
      sf_source_object: 'Note',
      sf_owner_id: pick(r, 'OwnerId', 'Owner ID') || null,
      sf_created_by_id: pick(r, 'CreatedById', 'Created By ID') || null,
      sf_created_date: parseTimestamp(pick(r, 'CreatedDate', 'Created Date')),
      sf_last_modified_date: parseTimestamp(pick(r, 'LastModifiedDate', 'Last Modified Date')),
      created_by: uid,
    };
    await writeNote(payload, sfId, existing, st);
  }
}

/** Insert or update one note, keyed by its Salesforce Id (idempotent re-runs). */
async function writeNote(payload: any, sfId: string, existing: Map<string, string>, st: ObjectStat) {
  const known = sfId ? existing.get(k15(sfId)) : undefined;
  if (known) {
    const { error } = await (supabase as any).from('crm_lead_notes').update(payload).eq('id', known);
    if (error) st.failed.push({ sfId, label: payload.title || sfId, reason: error.message });
    else st.updated++;
    return;
  }
  const { data, error } = await (supabase as any).from('crm_lead_notes').insert(payload).select('id').single();
  if (error) { st.failed.push({ sfId, label: payload.title || sfId, reason: error.message }); return; }
  if (sfId && data?.id) existing.set(k15(sfId), data.id);
  st.inserted++;
}

// -------------------------------------------------------------- files step --

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

async function importFiles(
  csvs: Record<string, Row[]>, binaries: BinaryIndex, resolver: SfResolver,
  uid: string, report: ImportReport, onProgress: ProgressFn,
) {
  const stAttach = report.stats['Attachment'] ??= newStat('Attachment');
  const stFile = report.stats['ContentVersion'] ??= newStat('ContentVersion');
  const stLink = report.stats['ContentDocumentLink'] ??= newStat('ContentDocumentLink');
  const stNote = report.stats['Note'] ??= newStat('Note');

  const existingFiles = await fetchExistingFileKeys();
  const existingNotes = await fetchExistingSfIds('crm_lead_notes');

  interface Job {
    sfId: string; row: Row; kind: 'attachment' | 'file';
    parent: Record<string, string | null>; parentSfId: string;
  }
  const jobs: Job[] = [];

  // --- Classic Attachments: ParentId is polymorphic ---
  const attachments = csvs.Attachment || [];
  stAttach.sourceRows = attachments.length;
  for (const r of attachments) {
    const sfId = pick(r, 'Id');
    const parentSfId = pick(r, 'ParentId', 'Parent ID');
    const name = pick(r, 'Name') || sfId;
    const parent = resolver.columns(parentSfId);
    if (!parent) {
      stAttach.skipped.push({ sfId, label: name, reason: `ParentId ${parentSfId || '(empty)'} → ${describePrefix(parentSfId)} not present in CrewCompass` });
      report.relationshipExceptions.push({ sfId, label: name, reason: `Attachment parent ${parentSfId} unresolved` });
      continue;
    }
    jobs.push({ sfId, row: r, kind: 'attachment', parent, parentSfId });
  }

  // --- Salesforce Files: latest ContentVersion per ContentDocument, fanned out
  //     over every ContentDocumentLink whose LinkedEntityId we can resolve. ---
  const versions = csvs.ContentVersion || [];
  stFile.sourceRows = versions.length;
  const latestByDoc = new Map<string, Row>();
  for (const r of versions) {
    const docId = k15(pick(r, 'ContentDocumentId', 'Content Document ID'));
    if (!docId) continue;
    const isLatest = /^(true|1|yes)$/i.test(pick(r, 'IsLatest', 'Is Latest'));
    const versionNo = parseNum(pick(r, 'VersionNumber', 'Version Number')) ?? 0;
    const current = latestByDoc.get(docId);
    if (!current) { latestByDoc.set(docId, r); continue; }
    const curLatest = /^(true|1|yes)$/i.test(pick(current, 'IsLatest', 'Is Latest'));
    const curVersion = parseNum(pick(current, 'VersionNumber', 'Version Number')) ?? 0;
    if ((isLatest && !curLatest) || (isLatest === curLatest && versionNo > curVersion)) latestByDoc.set(docId, r);
  }

  const links = csvs.ContentDocumentLink || [];
  stLink.sourceRows = links.length;
  const linksByDoc = new Map<string, string[]>();
  for (const r of links) {
    const docId = k15(pick(r, 'ContentDocumentId', 'Content Document ID'));
    const linked = pick(r, 'LinkedEntityId', 'Linked Entity ID');
    if (!docId || !linked) continue;
    (linksByDoc.get(docId) ?? linksByDoc.set(docId, []).get(docId)!).push(linked);
  }

  for (const [docId, r] of latestByDoc) {
    const title = pick(r, 'Title', 'PathOnClient') || docId;
    const linked = linksByDoc.get(docId) || [];
    if (!linked.length) {
      stFile.skipped.push({ sfId: pick(r, 'Id'), label: title, reason: 'No ContentDocumentLink row for this document' });
      continue;
    }
    let any = false;
    for (const entityId of linked) {
      const parent = resolver.columns(entityId);
      if (!parent) {
        stLink.skipped.push({ sfId: entityId, label: title, reason: `LinkedEntityId → ${describePrefix(entityId)} not present in CrewCompass` });
        continue;
      }
      any = true;
      jobs.push({ sfId: pick(r, 'Id'), row: r, kind: 'file', parent, parentSfId: entityId });
    }
    if (!any) report.relationshipExceptions.push({ sfId: pick(r, 'Id'), label: title, reason: 'No supported parent among its ContentDocumentLinks' });
  }

  // --- run the jobs ---
  let done = 0;
  for (const job of jobs) {
    const st = job.kind === 'attachment' ? stAttach : stFile;
    const isVersion = job.kind === 'file';
    const docId = isVersion ? pick(job.row, 'ContentDocumentId', 'Content Document ID') : '';
    const versionData = isVersion ? pick(job.row, 'VersionData', 'Version Data') : pick(job.row, 'Body');
    const fileName = isVersion
      ? (pick(job.row, 'PathOnClient', 'Title') || job.sfId)
      : (pick(job.row, 'Name') || job.sfId);
    const contentType = getSafeContentType(job.row, fileName);
    const sfFileType = pick(job.row, 'FileType', 'File Type').toUpperCase();
    const isEnhancedNote = sfFileType === 'SNOTE' || /\.snote$/i.test(fileName);

    const entry = binaries.find(job.sfId, docId, versionData, fileName);

    // ---- Enhanced Note → rich note record, not a file ----
    if (isEnhancedNote) {
      if (!entry) {
        report.bodiesMissing.push({ sfId: job.sfId, label: fileName, reason: 'Enhanced Note body not found in the uploaded ZIP part(s)' });
        stNote.skipped.push({ sfId: job.sfId, label: fileName, reason: 'Note body missing from export' });
        done++; continue;
      }
      try {
        const raw = new TextDecoder('utf-8').decode(await entry.zipFile.async('uint8array'));
        const html = sanitizeNoteHtml(raw);
        const text = htmlToPlainText(raw);
        const rawTitle = pick(job.row, 'Title') || fileName.replace(/\.snote$/i, '');
        await writeNote({
          ...job.parent,
          title: rawTitle && rawTitle !== 'Untitled Note' ? rawTitle : null,
          content: text || rawTitle || '',
          content_html: html || null,
          salesforce_id: job.sfId || null,
          sf_source_object: 'ContentNote',
          sf_owner_id: pick(job.row, 'OwnerId') || null,
          sf_created_by_id: pick(job.row, 'CreatedById') || null,
          sf_created_date: parseTimestamp(pick(job.row, 'CreatedDate')),
          sf_last_modified_date: parseTimestamp(pick(job.row, 'LastModifiedDate')),
          created_by: uid,
        }, job.sfId, existingNotes, stNote);
      } catch (e: any) {
        stNote.failed.push({ sfId: job.sfId, label: fileName, reason: e?.message || String(e) });
      }
      done++; continue;
    }

    // ---- regular binary ----
    const parentKey = fileParentKey(job.sfId, job.parent);
    try {
      if (!entry) {
        // Record the metadata anyway so nothing is silently lost.
        report.bodiesMissing.push({ sfId: job.sfId, label: fileName, reason: 'Binary not found in the uploaded ZIP part(s)' });
        st.skipped.push({ sfId: job.sfId, label: fileName, reason: 'File body missing from export (metadata only)' });
        done++; continue;
      }
      const bytes = await entry.zipFile.async('uint8array');
      if (bytes.byteLength > MAX_UPLOAD_BYTES) {
        st.skipped.push({ sfId: job.sfId, label: fileName, reason: `${(bytes.byteLength / 1048576).toFixed(1)} MB exceeds the 50 MB browser upload limit` });
        done++; continue;
      }
      // Deterministic, Salesforce-ID based path → re-runs overwrite, never duplicate.
      const path = `salesforce/${job.sfId || docId || 'unknown'}/${sanitizeStorageFileName(fileName)}`;
      const { error: upErr } = await supabase.storage.from('crm-files')
        .upload(path, bytes, { contentType, upsert: true });
      if (upErr) { st.failed.push({ sfId: job.sfId, label: fileName, reason: upErr.message }); done++; continue; }

      const payload: any = {
        ...job.parent,
        file_path: path,
        file_name: fileName,
        file_size: bytes.byteLength,
        content_type: contentType,
        salesforce_id: job.sfId || null,
        sf_source_object: isVersion ? 'ContentVersion' : 'Attachment',
        sf_content_document_id: docId || null,
        sf_content_version_id: isVersion ? job.sfId : null,
        sf_owner_id: pick(job.row, 'OwnerId') || null,
        sf_created_by_id: pick(job.row, 'CreatedById') || null,
        sf_created_date: parseTimestamp(pick(job.row, 'CreatedDate')),
        sf_last_modified_date: parseTimestamp(pick(job.row, 'LastModifiedDate')),
        body_missing: false,
        uploaded_by: uid,
      };
      const known = existingFiles.get(parentKey);
      if (known) {
        const { error } = await (supabase as any).from('crm_lead_files').update(payload).eq('id', known);
        if (error) st.failed.push({ sfId: job.sfId, label: fileName, reason: error.message });
        else st.updated++;
      } else {
        const { data, error } = await (supabase as any).from('crm_lead_files').insert(payload).select('id').single();
        if (error) st.failed.push({ sfId: job.sfId, label: fileName, reason: error.message });
        else { existingFiles.set(parentKey, data.id); st.inserted++; }
      }
    } catch (e: any) {
      st.failed.push({ sfId: job.sfId, label: fileName, reason: e?.message || String(e) });
    }
    done++;
    if (done % 5 === 0 || done === jobs.length) {
      onProgress(80 + Math.round((done / Math.max(jobs.length, 1)) * 19), `Importing Files… ${done}/${jobs.length}`);
    }
  }
}

const fileParentKey = (sfId: string, parent: Record<string, string | null>) =>
  [k15(sfId), parent.lead_id, parent.company_id, parent.contact_id, parent.task_id].join('|');

async function fetchExistingFileKeys(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let from = 0;
  for (;;) {
    const { data, error } = await (supabase as any)
      .from('crm_lead_files')
      .select('id, salesforce_id, lead_id, company_id, contact_id, task_id')
      .not('salesforce_id', 'is', null)
      .range(from, from + 999);
    if (error || !data?.length) break;
    data.forEach((r: any) => map.set(fileParentKey(r.salesforce_id, r), r.id));
    if (data.length < 1000) break;
    from += 1000;
  }
  return map;
}