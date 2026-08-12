import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ArrowDown, ArrowUp, Info, Loader2, Plus, Receipt, Trash2,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { db } from './billingApi';
import { CrmLinkPicker } from './CrmLinkPicker';
import { BILLING_MODES, money, type BillingMode } from '@/lib/billing/types';

interface Props { jobSiteId: string; jobSiteName: string }

interface PhaseRow {
  id: string; name: string; sequence: number; status: string;
  billing_percent: number | null; billing_amount: number | null;
}
interface MilestoneRow {
  id: string; name: string; sequence: number; status: string;
  billing_percent: number | null; billing_amount: number | null;
  _new?: boolean;
}

const TERMS = ['Due on receipt', 'Net 15', 'Net 30', 'Net 45', 'Net 60'];

const TRIGGER_HELP: Record<BillingMode, string> = {
  completion: 'Ready to Bill is created when a manager marks the whole job complete in Job Completion below.',
  progress: 'Ready to Bill is created when a progress milestone is marked complete here.',
  phased: 'Ready to Bill is created when a crew marks one of the project phases complete in Job Completion below.',
  manual: 'Nothing enters Ready to Bill automatically — create invoices by hand in Billing.',
};

export const ProjectBillingSetupCard = ({ jobSiteId, jobSiteName }: Props) => {
  const { isManager } = useAuth();
  const { toast } = useToast();
  const manager = typeof isManager === 'function' ? isManager() : !!isManager;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    billing_mode: 'completion' as BillingMode,
    contract_amount: '' as string,
    billing_terms: 'Net 30',
    billing_po_number: '',
    billing_contact_name: '',
    billing_email: '',
    billing_notes: '',
    crm_company_id: null as string | null,
    crm_deal_id: null as string | null,
  });
  const [phases, setPhases] = useState<PhaseRow[]>([]);
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const [usePercent, setUsePercent] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: site }, { data: ph }, { data: ms }] = await Promise.all([
      db.from('job_sites')
        .select('billing_mode, contract_amount, billing_terms, billing_po_number, billing_contact_name, billing_email, billing_notes, crm_company_id, crm_deal_id')
        .eq('id', jobSiteId).maybeSingle(),
      db.from('project_phases').select('id, name, sequence, status, billing_percent, billing_amount')
        .eq('job_site_id', jobSiteId).order('sequence'),
      db.from('billing_milestones').select('*').eq('job_site_id', jobSiteId).order('sequence'),
    ]);
    if (site) {
      setForm({
        billing_mode: (site.billing_mode ?? 'completion') as BillingMode,
        contract_amount: site.contract_amount == null ? '' : String(site.contract_amount),
        billing_terms: site.billing_terms ?? 'Net 30',
        billing_po_number: site.billing_po_number ?? '',
        billing_contact_name: site.billing_contact_name ?? '',
        billing_email: site.billing_email ?? '',
        billing_notes: site.billing_notes ?? '',
        crm_company_id: site.crm_company_id ?? null,
        crm_deal_id: site.crm_deal_id ?? null,
      });
    }
    setPhases((ph ?? []) as PhaseRow[]);
    setMilestones((ms ?? []) as MilestoneRow[]);
    const rows = [...(ph ?? []), ...(ms ?? [])] as any[];
    setUsePercent(!rows.some(r => r.billing_amount != null && r.billing_percent == null));
    setLoading(false);
  };

  useEffect(() => { load(); }, [jobSiteId]);

  const contract = Number(form.contract_amount || 0);
  const dollarsFor = (pct: number | null) =>
    contract > 0 && pct != null ? Math.round(contract * (Number(pct) / 100) * 100) / 100 : null;

  const scheduleRows: (PhaseRow | MilestoneRow)[] =
    form.billing_mode === 'phased' ? phases : form.billing_mode === 'progress' ? milestones : [];
  const pctTotal = scheduleRows.reduce((s, r) => s + Number(r.billing_percent || 0), 0);
  const pctValid = !usePercent || scheduleRows.length === 0 || Math.abs(pctTotal - 100) < 0.01;

  const patchRow = (id: string, patch: Partial<MilestoneRow>) => {
    if (form.billing_mode === 'phased') setPhases(p => p.map(r => (r.id === id ? { ...r, ...patch } : r)));
    else setMilestones(m => m.map(r => (r.id === id ? { ...r, ...patch } : r)));
  };

  const addMilestone = () => setMilestones(m => [...m, {
    id: `new-${Date.now()}-${m.length}`,
    name: '',
    sequence: (m[m.length - 1]?.sequence ?? 0) + 1,
    status: 'pending',
    billing_percent: null,
    billing_amount: null,
    _new: true,
  }]);

  const moveMilestone = (idx: number, dir: -1 | 1) => {
    setMilestones(m => {
      const next = [...m];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return m;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next.map((r, i) => ({ ...r, sequence: i + 1 }));
    });
  };

  const removeMilestone = async (row: MilestoneRow) => {
    if (!row._new) {
      const { error } = await db.from('billing_milestones').delete().eq('id', row.id);
      if (error) return toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
    setMilestones(m => m.filter(r => r.id !== row.id));
  };

  const save = async () => {
    if (!pctValid) {
      toast({
        title: 'Percentages must total 100%',
        description: `Current total is ${pctTotal.toFixed(2)}%.`,
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      const { error } = await db.from('job_sites').update({
        billing_mode: form.billing_mode,
        contract_amount: form.contract_amount === '' ? null : Number(form.contract_amount),
        billing_terms: form.billing_terms || null,
        billing_po_number: form.billing_po_number || null,
        billing_contact_name: form.billing_contact_name || null,
        billing_email: form.billing_email || null,
        billing_notes: form.billing_notes || null,
        crm_company_id: form.crm_company_id,
        crm_deal_id: form.crm_deal_id,
      }).eq('id', jobSiteId);
      if (error) throw error;

      if (form.billing_mode === 'phased') {
        for (const p of phases) {
          const { error: e } = await db.from('project_phases').update({
            billing_percent: usePercent ? (p.billing_percent ?? null) : null,
            billing_amount: usePercent ? null : (p.billing_amount ?? null),
          }).eq('id', p.id);
          if (e) throw e;
        }
      }

      if (form.billing_mode === 'progress') {
        for (const [i, m] of milestones.entries()) {
          if (!m.name.trim()) continue;
          const payload = {
            job_site_id: jobSiteId,
            name: m.name.trim(),
            sequence: i + 1,
            billing_percent: usePercent ? (m.billing_percent ?? null) : null,
            billing_amount: usePercent ? null : (m.billing_amount ?? null),
          };
          const { error: e } = m._new
            ? await db.from('billing_milestones').insert(payload)
            : await db.from('billing_milestones').update(payload).eq('id', m.id);
          if (e) throw e;
        }
      }

      toast({ title: 'Billing setup saved' });
      await load();
    } catch (e: any) {
      toast({ title: 'Could not save billing setup', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const completeMilestone = async (row: MilestoneRow) => {
    const { error } = await db.from('billing_milestones').update({
      status: 'complete', completed_at: new Date().toISOString(),
    }).eq('id', row.id);
    if (error) return toast({ title: 'Error', description: error.message, variant: 'destructive' });
    toast({ title: 'Milestone complete', description: 'Sent to Ready to Bill.' });
    load();
  };

  if (!manager || loading) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Receipt className="h-4 w-4" /> Project Billing Setup
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>How is this project billed?</Label>
            <Select value={form.billing_mode}
                    onValueChange={v => setForm(f => ({ ...f, billing_mode: v as BillingMode }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BILLING_MODES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground flex items-start gap-1">
              <Info className="h-3 w-3 mt-0.5 shrink-0" /> {TRIGGER_HELP[form.billing_mode]}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contract_amount">Contract amount ($)</Label>
            <Input id="contract_amount" type="number" step="0.01" value={form.contract_amount}
                   onChange={e => setForm(f => ({ ...f, contract_amount: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Payment terms</Label>
            <Select value={form.billing_terms} onValueChange={v => setForm(f => ({ ...f, billing_terms: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TERMS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="po">PO number</Label>
            <Input id="po" value={form.billing_po_number}
                   onChange={e => setForm(f => ({ ...f, billing_po_number: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bcontact">Billing contact</Label>
            <Input id="bcontact" value={form.billing_contact_name}
                   onChange={e => setForm(f => ({ ...f, billing_contact_name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bemail">Billing email</Label>
            <Input id="bemail" type="email" value={form.billing_email}
                   onChange={e => setForm(f => ({ ...f, billing_email: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Waypoint account</Label>
            <CrmLinkPicker kind="company" value={form.crm_company_id}
                           onChange={id => setForm(f => ({ ...f, crm_company_id: id }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Waypoint opportunity</Label>
            <CrmLinkPicker kind="deal" value={form.crm_deal_id} companyId={form.crm_company_id}
                           onChange={id => setForm(f => ({ ...f, crm_deal_id: id }))} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="bnotes">Billing notes</Label>
            <Textarea id="bnotes" rows={2} value={form.billing_notes}
                      onChange={e => setForm(f => ({ ...f, billing_notes: e.target.value }))} />
          </div>
        </div>

        {(form.billing_mode === 'phased' || form.billing_mode === 'progress') && (
          <div className="space-y-2 rounded-md border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">
                {form.billing_mode === 'phased' ? 'Phase billing schedule' : 'Progress milestones'}
              </p>
              <label className="flex items-center gap-2 text-xs">
                <Switch checked={usePercent} onCheckedChange={setUsePercent} />
                {usePercent ? '% of contract' : 'Fixed dollar amounts'}
              </label>
            </div>

            {form.billing_mode === 'phased' && !phases.length && (
              <p className="text-xs text-muted-foreground">
                No project phases yet — add them in Job Completion below, then set each phase's share here.
              </p>
            )}

            {scheduleRows.map((r, idx) => (
              <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2">
                {form.billing_mode === 'progress' ? (
                  <Input className="flex-1 min-w-[10rem]" placeholder="Milestone name" value={r.name}
                         onChange={e => patchRow(r.id, { name: e.target.value })} />
                ) : (
                  <span className="flex-1 min-w-[10rem] text-sm truncate">{r.name}</span>
                )}
                {usePercent ? (
                  <div className="flex items-center gap-1">
                    <Input className="w-24" type="number" step="0.01" placeholder="%"
                           value={r.billing_percent ?? ''}
                           onChange={e => patchRow(r.id, {
                             billing_percent: e.target.value === '' ? null : Number(e.target.value),
                           })} />
                    <span className="text-xs text-muted-foreground w-24 tabular-nums">
                      {dollarsFor(r.billing_percent) != null ? money(dollarsFor(r.billing_percent)) : '—'}
                    </span>
                  </div>
                ) : (
                  <Input className="w-32" type="number" step="0.01" placeholder="$"
                         value={r.billing_amount ?? ''}
                         onChange={e => patchRow(r.id, {
                           billing_amount: e.target.value === '' ? null : Number(e.target.value),
                         })} />
                )}
                {r.status === 'complete' && <Badge className="bg-green-100 text-green-800">Complete</Badge>}
                {form.billing_mode === 'progress' && (
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" aria-label="Move up" onClick={() => moveMilestone(idx, -1)}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" aria-label="Move down" onClick={() => moveMilestone(idx, 1)}>
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    {!(r as MilestoneRow)._new && r.status !== 'complete' && (
                      <Button size="sm" variant="outline" onClick={() => completeMilestone(r as MilestoneRow)}>
                        Bill it
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" aria-label="Remove milestone"
                            onClick={() => removeMilestone(r as MilestoneRow)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))}

            {form.billing_mode === 'progress' && (
              <Button size="sm" variant="outline" onClick={addMilestone}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add milestone
              </Button>
            )}

            {usePercent && scheduleRows.length > 0 && (
              <p className={`text-xs ${pctValid ? 'text-muted-foreground' : 'text-destructive'}`}>
                Schedule totals {pctTotal.toFixed(2)}% {pctValid ? '' : '— must equal 100% before saving.'}
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end">
          <Button size="sm" onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Save billing setup
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProjectBillingSetupCard;
