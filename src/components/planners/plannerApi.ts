import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type TrainingSession = Tables<'training_sessions'>;
export type AccountEntry = Tables<'new_account_calendar_entries'>;
export type PlannerEntry = TrainingSession | AccountEntry;
export interface PersonOption { id: string; first_name: string; last_name: string }
export interface AccountOption { id: string; name: string }
export const personName = (person?: PersonOption) => person ? `${person.first_name} ${person.last_name}`.trim() : '—';

async function paged<T>(fetch: (start: number, end: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await fetch(offset, offset + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}
export async function plannerOptions() {
  const [people, accounts, roles] = await Promise.all([
    paged<PersonOption>((a,b) => supabase.from('profiles_directory').select('id, first_name, last_name').eq('active',true).order('id').range(a,b)),
    paged<AccountOption>((a,b) => supabase.from('job_sites').select('id, name').eq('active',true).order('id').range(a,b)),
    paged<{ user_id: string }>((a,b) => supabase.from('user_roles').select('user_id').in('role',['manager','admin']).order('id').range(a,b)),
  ]);
  const managerIds = new Set(roles.map(row => row.user_id));
  return { people: people.sort((a,b) => personName(a).localeCompare(personName(b))), accounts: accounts.sort((a,b) => a.name.localeCompare(b.name)), managers: people.filter(row => managerIds.has(row.id)) };
}
export async function plannerEntries(training: boolean, first: string, last: string): Promise<PlannerEntry[]> {
  if (training) return paged<TrainingSession>((a,b) => supabase.from('training_sessions').select('*').gte('session_date',first).lte('session_date',last).order('session_date').order('id').range(a,b));
  return paged<AccountEntry>((a,b) => supabase.from('new_account_calendar_entries').select('*').gte('start_date',first).lte('start_date',last).order('start_date').order('id').range(a,b));
}
export const entryDate = (entry: PlannerEntry) => 'session_date' in entry ? entry.session_date : entry.start_date;