import { supabase } from '@/integrations/supabase/client';
import { k15 } from './sfUtils';

export interface ReconcileRow {
  path: string;
  size: number | null;
  status: 'linked' | 'storage_only' | 'reconnected' | 'needs_review';
  detail: string;
}

export interface ReconcileReport {
  storageObjects: number;
  dbRows: number;
  linked: number;
  storageOnly: number;
  dbOnly: number;
  reconnected: number;
  needsReview: ReconcileRow[];
  dbOnlyRows: ReconcileRow[];
}

async function listAllObjects(prefix: string): Promise<Array<{ name: string; size: number | null }>> {
  const out: Array<{ name: string; size: number | null }> = [];
  const walk = async (dir: string, depth: number) => {
    if (depth > 4) return;
    let offset = 0;
    for (;;) {
      const { data, error } = await supabase.storage.from('crm-files')
        .list(dir, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } });
      if (error || !data?.length) break;
      for (const item of data) {
        const full = dir ? `${dir}/${item.name}` : item.name;
        if (item.id === null) await walk(full, depth + 1);            // folder
        else out.push({ name: full, size: (item.metadata as any)?.size ?? null });
      }
      if (data.length < 100) break;
      offset += 100;
    }
  };
  await walk(prefix, 0);
  return out;
}

/**
 * Read-only scan (plus unambiguous re-linking) of the crm-files bucket.
 * Nothing is ever deleted. A storage object is only reconnected to a database
 * row when its Salesforce identity and parent are unambiguous.
 */
export async function reconcileStorage(opts: { autoReconnect: boolean }): Promise<ReconcileReport> {
  const objects = await listAllObjects('');
  const objectPaths = new Set(objects.map((o) => o.name));

  const rows: any[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await (supabase as any)
      .from('crm_lead_files')
      .select('id, file_path, file_name, file_size, salesforce_id, lead_id, company_id, contact_id, task_id, sf_content_document_id')
      .range(from, from + 999);
    if (error || !data?.length) break;
    rows.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }

  const byPath = new Map<string, any>(rows.map((r) => [r.file_path, r]));
  const bySfId = new Map<string, any[]>();
  rows.forEach((r) => {
    if (!r.salesforce_id) return;
    const key = k15(r.salesforce_id);
    (bySfId.get(key) ?? bySfId.set(key, []).get(key)!).push(r);
  });

  const report: ReconcileReport = {
    storageObjects: objects.length, dbRows: rows.length,
    linked: 0, storageOnly: 0, dbOnly: 0, reconnected: 0,
    needsReview: [], dbOnlyRows: [],
  };

  for (const obj of objects) {
    const row = byPath.get(obj.name);
    if (row) { report.linked++; continue; }
    report.storageOnly++;

    // Can we infer a Salesforce identity from the path? Two known layouts:
    //   salesforce/<sfId>/<name>      (new importer)
    //   crm-leads/<leadUuid>/<uuid>-<name>  (legacy importer — no SF identity)
    const segments = obj.name.split('/');
    const sfSegment = segments.find((s) => /^[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?$/.test(s));
    const candidates = sfSegment ? (bySfId.get(k15(sfSegment)) || []) : [];

    if (opts.autoReconnect && sfSegment && candidates.length === 1 && !objectPaths.has(candidates[0].file_path)) {
      // Exactly one database row claims this Salesforce id and its recorded
      // path does not exist in storage → unambiguous re-link.
      const { error } = await (supabase as any)
        .from('crm_lead_files')
        .update({ file_path: obj.name, file_size: obj.size ?? candidates[0].file_size })
        .eq('id', candidates[0].id);
      if (!error) {
        report.reconnected++;
        report.needsReview.push({ path: obj.name, size: obj.size, status: 'reconnected', detail: `Re-linked to file row ${candidates[0].id}` });
        continue;
      }
    }

    report.needsReview.push({
      path: obj.name,
      size: obj.size,
      status: sfSegment ? 'needs_review' : 'storage_only',
      detail: sfSegment
        ? `Salesforce id ${sfSegment} matches ${candidates.length} database row(s) — manual review`
        : 'No Salesforce identity in path (legacy upload) — kept, not deleted',
    });
  }

  for (const r of rows) {
    if (!objectPaths.has(r.file_path)) {
      report.dbOnly++;
      report.dbOnlyRows.push({ path: r.file_path, size: r.file_size, status: 'needs_review', detail: `Database row ${r.id} (${r.file_name}) has no stored object` });
    }
  }

  return report;
}