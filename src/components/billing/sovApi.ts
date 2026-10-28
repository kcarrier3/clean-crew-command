import { supabase } from '@/integrations/supabase/client';
import { db } from './billingApi';
import { sovBillingState, type SovBillingState } from '@/lib/billing/sov';

export interface SovCheckpoint {
  phaseId: string;
  name: string;
  sequence: number;
  status: string;
  completedAt: string | null;
  completedBy: string | null;
  completedByName: string | null;
  amount: number | null;
  eventId: string | null;
  eventStatus: string | null;
  invoiceId: string | null;
  billingState: SovBillingState;
}

export interface SovDraftLine {
  phaseId?: string;
  name: string;
  amount: string;
}

const phaseColumns = 'id, name, sequence, status, completed_at, completed_by, completion_notes';

export const canViewSov = async (userId: string): Promise<boolean> => {
  const { data, error } = await supabase.rpc('can_view_sov', { _user_id: userId });
  if (error) return false;
  return !!data;
};

/** Checkpoints plus amounts. Amounts are null when this user cannot read the schedule of values. */
export const fetchProjectSov = async (jobSiteId: string, withAmounts: boolean): Promise<SovCheckpoint[]> => {
  const { data: phases, error } = await db.from('project_phases').select(phaseColumns)
    .eq('job_site_id', jobSiteId).order('sequence');
  if (error) throw error;

  let amounts = new Map<string, number>();
  if (withAmounts) {
    const { data: lines, error: sovErr } = await db.from('project_sov_lines')
      .select('project_phase_id, amount').eq('job_site_id', jobSiteId);
    if (sovErr) throw sovErr;
    amounts = new Map((lines ?? []).map((l: { project_phase_id: string; amount: number }) => [l.project_phase_id, Number(l.amount)]));
  }

  const eventByPhase = new Map<string, { id: string; status: string; invoice_id: string | null }>();
  const ev = await db.from('billing_events')
    .select('id, project_phase_id, status, invoice_id')
    .eq('job_site_id', jobSiteId)
    .not('project_phase_id', 'is', null);
  if (!ev.error) {
    (ev.data ?? []).forEach((e: { id: string; project_phase_id: string; status: string; invoice_id: string | null }) => {
      eventByPhase.set(e.project_phase_id, e);
    });
  }

  const completerIds = [...new Set((phases ?? []).map((p: { completed_by: string | null }) => p.completed_by).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (completerIds.length) {
    const { data: people } = await db.from('profiles').select('id, first_name, last_name').in('id', completerIds);
    (people ?? []).forEach((p: { id: string; first_name: string | null; last_name: string | null }) => {
      names.set(p.id, [p.first_name, p.last_name].filter(Boolean).join(' '));
    });
  }

  return (phases ?? []).map((p: {
    id: string; name: string; sequence: number; status: string;
    completed_at: string | null; completed_by: string | null;
  }) => {
    const ev = eventByPhase.get(p.id);
    return {
      phaseId: p.id,
      name: p.name,
      sequence: p.sequence,
      status: p.status,
      completedAt: p.completed_at,
      completedBy: p.completed_by,
      completedByName: p.completed_by ? (names.get(p.completed_by) || null) : null,
      amount: withAmounts ? (amounts.get(p.id) ?? null) : null,
      eventId: ev?.id ?? null,
      eventStatus: ev?.status ?? null,
      invoiceId: ev?.invoice_id ?? null,
      billingState: sovBillingState(p.status, ev?.status ?? null),
    };
  });
};

export const saveProjectSov = async (jobSiteId: string, lines: SovDraftLine[]) => {
  const cleaned = lines
    .map(l => ({ ...l, name: l.name.trim(), amount: Number(l.amount) }))
    .filter(l => l.name);
  if (!cleaned.length) throw new Error('Add at least one checkpoint.');
  if (cleaned.some(l => !Number.isFinite(l.amount) || l.amount < 0)) {
    throw new Error('Every checkpoint needs an amount of zero or more.');
  }

  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id ?? null;
  const { data: existing, error: loadErr } = await db.from('project_phases')
    .select('id, status').eq('job_site_id', jobSiteId);
  if (loadErr) throw loadErr;
  const existingById = new Map<string, string>(
    (existing ?? []).map((p: { id: string; status: string }) => [p.id, p.status]),
  );
  const kept = new Set<string>();

  for (const [i, line] of cleaned.entries()) {
    let phaseId = line.phaseId && existingById.has(line.phaseId) ? line.phaseId : null;
    if (phaseId) {
      const { error } = await db.from('project_phases').update({ name: line.name, sequence: i + 1 }).eq('id', phaseId);
      if (error) throw error;
    } else {
      const { data, error } = await db.from('project_phases').insert({
        job_site_id: jobSiteId, name: line.name, sequence: i + 1,
      }).select('id').single();
      if (error) throw error;
      phaseId = data.id as string;
    }
    kept.add(phaseId);
    const { data: current } = await db.from('project_sov_lines').select('id').eq('project_phase_id', phaseId).maybeSingle();
    const { error: sovErr } = current?.id
      ? await db.from('project_sov_lines').update({ amount: line.amount }).eq('id', current.id)
      : await db.from('project_sov_lines').insert({
        job_site_id: jobSiteId, project_phase_id: phaseId, amount: line.amount, created_by: uid,
      });
    if (sovErr) throw sovErr;
  }

  for (const [id, status] of existingById) {
    if (kept.has(id) || status === 'complete') continue;
    await db.from('project_sov_lines').delete().eq('project_phase_id', id);
    const { error } = await db.from('project_phases').delete().eq('id', id);
    if (error) throw error;
  }

  const { error: siteErr } = await db.from('job_sites').update({
    is_phased: true,
    billing_mode: 'phased',
  }).eq('id', jobSiteId);
  if (siteErr) throw siteErr;
};
