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
  const [people, accounts] = await Promise.all([
    paged<PersonOption>((a,b) => supabase.from('profiles_directory').select('id, first_name, last_name').eq('active',true).order('id').range(a,b)),
    paged<AccountOption>((a,b) => supabase.from('job_sites').select('id, name').eq('active',true).order('id').range(a,b)),
  ]);
  const managers: PersonOption[] = [];
  // Existing authenticated role helpers avoid widening access to user_roles.
  for (let offset = 0; offset < people.length; offset += 12) {
    const checked = await Promise.all(people.slice(offset,offset+12).map(async person => {
      const results = await Promise.all([
        supabase.rpc('has_role', { _user_id: person.id, _role: 'manager' }),
        supabase.rpc('has_role', { _user_id: person.id, _role: 'admin' }),
      ]);
      for (const result of results) if (result.error) throw new Error(result.error.message);
      return results.some(result => result.data) ? person : null;
    }));
    checked.forEach(person => { if (person) managers.push(person); });
  }
  return { people: people.sort((a,b) => personName(a).localeCompare(personName(b))), accounts: accounts.sort((a,b) => a.name.localeCompare(b.name)), managers };
}
export async function plannerEntries(training: boolean, first: string, last: string): Promise<PlannerEntry[]> {
  if (training) return paged<TrainingSession>((a,b) => supabase.from('training_sessions').select('*').gte('session_date',first).lte('session_date',last).order('session_date').order('id').range(a,b));
  return paged<AccountEntry>((a,b) => supabase.from('new_account_calendar_entries').select('*').gte('start_date',first).lte('start_date',last).order('start_date').order('id').range(a,b));
}
export const entryDate = (entry: PlannerEntry) => 'session_date' in entry ? entry.session_date : entry.start_date;