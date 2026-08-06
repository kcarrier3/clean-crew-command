import { supabase } from '@/integrations/supabase/client';
import { k15 } from './sfUtils';

export interface BackfillReport {
  leadsScanned: number;
  linkedBySalesforceId: number;
  accountsCreated: number;
  linkedByName: number;
  dealsLinked: number;
  unresolved: Array<{ opportunity: string; accountName: string; reason: string }>;
}

const norm = (v: string | null | undefined) =>
  (v || '').replace(/\s+/g, ' ').trim().toLowerCase();

async function pageAll(table: string, select: string, apply?: (q: any) => any): Promise<any[]> {
  const out: any[] = [];
  let from = 0;
  for (;;) {
    let q = (supabase as any).from(table).select(select).range(from, from + 999);
    if (apply) q = apply(q);
    const { data, error } = await q;
    if (error || !data?.length) break;
    out.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return out;
}

/**
 * Repairs Opportunity → Account relationships on data that is already in the
 * database, without any re-import. Strictly non-destructive: it only fills
 * `company_id` where it is currently null, and only creates an Account when the
 * opportunity carries a real Salesforce AccountId + Account Name.
 */
export async function backfillOpportunityAccounts(uid: string): Promise<BackfillReport> {
  const report: BackfillReport = {
    leadsScanned: 0, linkedBySalesforceId: 0, accountsCreated: 0,
    linkedByName: 0, dealsLinked: 0, unresolved: [],
  };

  const leads = await pageAll(
    'crm_leads',
    'id, company_id, company_name, contact_name, salesforce_id, sf_account_id, sf_account_name',
    (q) => q.is('company_id', null),
  );
  report.leadsScanned = leads.length;
  if (!leads.length) return report;

  const companies = await pageAll('crm_companies', 'id, name, salesforce_id');
  const bySfId = new Map<string, string>();
  const byName = new Map<string, string[]>();
  for (const c of companies) {
    if (c.salesforce_id) bySfId.set(k15(c.salesforce_id), c.id);
    const key = norm(c.name);
    if (!key) continue;
    byName.set(key, [...(byName.get(key) || []), c.id]);
  }

  // ---- pass 1: create any Account the opportunities reference but that is missing
  const toCreate = new Map<string, { salesforce_id: string; name: string }>();
  for (const l of leads) {
    const sfAcct: string = l.sf_account_id || '';
    if (!sfAcct || bySfId.has(k15(sfAcct))) continue;
    const name = (l.sf_account_name || '').trim();
    if (!name) continue;                       // never invent an account name
    if (!toCreate.has(k15(sfAcct))) toCreate.set(k15(sfAcct), { salesforce_id: sfAcct, name });
  }
  if (toCreate.size) {
    const payload = Array.from(toCreate.values()).map((r) => ({ ...r, owner_id: uid, created_by: uid }));
    for (let i = 0; i < payload.length; i += 200) {
      const { data } = await (supabase as any)
        .from('crm_companies')
        .upsert(payload.slice(i, i + 200), { onConflict: 'salesforce_id', ignoreDuplicates: false })
        .select('id, salesforce_id, name');
      (data || []).forEach((c: any) => {
        bySfId.set(k15(c.salesforce_id), c.id);
        byName.set(norm(c.name), [...(byName.get(norm(c.name)) || []), c.id]);
        report.accountsCreated++;
      });
    }
  }

  // ---- pass 2: resolve every lead
  const updates: Array<{ id: string; company_id: string; company_name: string }> = [];
  for (const l of leads) {
    let companyId: string | null = null;
    let source: 'sf' | 'name' | null = null;

    if (l.sf_account_id) {
      companyId = bySfId.get(k15(l.sf_account_id)) || null;
      if (companyId) source = 'sf';
    }

    if (!companyId) {
      // Only match by name when the stored account name is unambiguous AND it is
      // not simply a copy of the opportunity name (which would create a bogus account).
      const candidate = (l.sf_account_name || '').trim() || (l.company_name || '').trim();
      const looksLikeOpportunityName =
        !l.sf_account_name && norm(candidate) === norm(l.contact_name);
      if (candidate && !looksLikeOpportunityName) {
        const hits = byName.get(norm(candidate)) || [];
        if (hits.length === 1) { companyId = hits[0]; source = 'name'; }
        else if (hits.length > 1) {
          report.unresolved.push({
            opportunity: l.contact_name || l.company_name || l.id,
            accountName: candidate,
            reason: `${hits.length} accounts share this name — left unlinked for manual review`,
          });
        }
      }
      if (!companyId && !source) {
        report.unresolved.push({
          opportunity: l.contact_name || l.company_name || l.id,
          accountName: candidate || '(none)',
          reason: l.sf_account_id
            ? 'Salesforce AccountId present but no matching account and no account name'
            : 'No Salesforce AccountId stored — re-run the Salesforce import to capture it',
        });
      }
    }

    if (!companyId) continue;
    const name = companies.find((c) => c.id === companyId)?.name
      || toCreate.get(k15(l.sf_account_id || ''))?.name
      || l.sf_account_name
      || l.company_name;
    updates.push({ id: l.id, company_id: companyId, company_name: name });
    if (source === 'sf') report.linkedBySalesforceId++; else report.linkedByName++;
  }

  for (const u of updates) {
    const { error } = await (supabase as any)
      .from('crm_leads')
      .update({ company_id: u.company_id, company_name: u.company_name })
      .eq('id', u.id);
    if (error) continue;
    const { error: dealErr } = await (supabase as any)
      .from('crm_deals')
      .update({ company_id: u.company_id })
      .eq('lead_id', u.id)
      .is('company_id', null);
    if (!dealErr) report.dealsLinked++;
  }

  return report;
}
