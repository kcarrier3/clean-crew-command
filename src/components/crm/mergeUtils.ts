import { supabase } from '@/integrations/supabase/client';

const db = supabase as any;

/** Tables + columns that point at crm_companies.id */
const COMPANY_REFS: [string, string][] = [
  ['crm_contacts', 'company_id'],
  ['crm_deals', 'company_id'],
  ['crm_email_logs', 'company_id'],
  ['crm_invoices', 'company_id'],
  ['crm_lead_files', 'company_id'],
  ['crm_lead_notes', 'company_id'],
  ['crm_leads', 'company_id'],
  ['crm_meetings', 'company_id'],
  ['crm_tasks', 'company_id'],
  ['estimates', 'company_id'],
];

/** Tables + columns that point at crm_leads.id */
const LEAD_REFS: [string, string][] = [
  ['crm_activities', 'lead_id'],
  ['crm_contacts', 'lead_id'],
  ['crm_deals', 'lead_id'],
  ['crm_email_logs', 'lead_id'],
  ['crm_lead_files', 'lead_id'],
  ['crm_lead_notes', 'lead_id'],
  ['crm_meetings', 'lead_id'],
  ['crm_tasks', 'lead_id'],
  ['estimates', 'lead_id'],
];

async function repoint(refs: [string, string][], loserIds: string[], winnerId: string) {
  for (const [table, column] of refs) {
    const { error } = await db.from(table).update({ [column]: winnerId }).in(column, loserIds);
    if (error) throw new Error(`${table}.${column}: ${error.message}`);
  }
}

/**
 * Merge duplicate accounts into a single surviving account.
 * All related records (contacts, opportunities, notes, files, estimates…)
 * are repointed to the winner, then the duplicates are deleted.
 */
export async function mergeAccounts(winnerId: string, loserIds: string[], winnerName: string) {
  const losers = loserIds.filter(id => id !== winnerId);
  if (!losers.length) return;
  await repoint(COMPANY_REFS, losers, winnerId);
  // Keep the denormalised opportunity company_name in sync with the survivor.
  await db.from('crm_leads').update({ company_name: winnerName }).eq('company_id', winnerId);
  const { error } = await db.from('crm_companies').delete().in('id', losers);
  if (error) throw new Error(error.message);
}

/** Merge duplicate opportunities into one, moving all related records over. */
export async function mergeOpportunities(winnerId: string, loserIds: string[]) {
  const losers = loserIds.filter(id => id !== winnerId);
  if (!losers.length) return;
  await repoint(LEAD_REFS, losers, winnerId);
  const { error } = await db.from('crm_leads').delete().in('id', losers);
  if (error) throw new Error(error.message);
}

/** Move contacts to a different account (or detach when accountId is null). */
export async function moveContactsToAccount(contactIds: string[], accountId: string | null) {
  if (!contactIds.length) return;
  const { error } = await db.from('crm_contacts').update({ company_id: accountId }).in('id', contactIds);
  if (error) throw new Error(error.message);
}
