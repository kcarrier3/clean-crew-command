import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Copy, Save, CheckCircle2, Files, AlertTriangle, Building2, Pencil, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { SEO } from '@/components/SEO';
import { EstimatorShell } from '@/components/estimator/EstimatorShell';
import { PricingSummary, buildSummaryText } from '@/components/estimator/PricingSummary';
import { SERVICE_LABELS, normalizeServiceType, type ServiceType } from '@/components/estimator/serviceTypes';
import {
  SpecialtyForm, SpecialtySummaryPanel, buildSpecialtySummaryText,
} from '@/components/estimator/SpecialtyEditor';
import {
  calculateSpecialty, hydrateSpecialtyInputs, validateSpecialty,
  type SpecialtyInputs, type SpecialtyOutputs,
} from '@/components/estimator/specialtyCalc';
import {
  DEFAULT_INPUTS, SUPPLY_PRESETS, calculateEstimate, isPricingSolvable,
  supplyRateForPreset, money, hoursFmt, hourlyRateFmt, pct,
  type EstimateInputs, type SupplyPreset,
} from '@/components/estimator/calc';
import {
  hydrateJanitorialInputs, janitorialRevisionPayload, monthlyPriceDrift,
} from '@/components/estimator/janitorial';
import { ConvertToAccountDialog } from '@/components/estimator/ConvertToAccountDialog';
import {
  CostBreakdown, breakdownText, buildJanitorialBreakdown, buildSpecialtyBreakdown,
} from '@/components/estimator/CostBreakdown';
import { CreateProposalDialog } from '@/components/estimator/CreateProposalDialog';
import { ProposalsList } from '@/components/estimator/ProposalsList';

const SPECIALTY_COLUMNS = (i: SpecialtyInputs, o: SpecialtyOutputs) => ({
  specialty_inputs: i,
  base_wage: (i as any).base_wage,
  labor_burden_percent: (i as any).labor_burden_percent,
  overhead_percent: (i as any).overhead_percent,
  target_margin_percent: (i as any).target_margin_percent,
  loaded_labor_rate: o.loaded_labor_rate,
  project_labor_hours: o.labor_hours,
  project_direct_cost: o.total_direct_cost,
  project_price: o.project_price,
  total_direct_cost: o.total_direct_cost,
  overhead_amount: o.overhead_amount,
  price_per_sqft: o.price_per_sqft,
  gross_margin_percent: o.gross_margin_percent,
  markup_percent: o.markup_on_direct_percent,
});

function NumField({
  id, label, value, onChange, suffix, step = 'any', disabled,
}: {
  id: string; label: string; value: number; onChange: (v: number) => void;
  suffix?: string; step?: string; disabled?: boolean;
}) {
  const [text, setText] = useState(String(value ?? ''));
  useEffect(() => { setText(value === 0 ? '' : String(value)); }, [value]);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          step={step}
          value={text}
          disabled={disabled}
          onChange={e => { setText(e.target.value); onChange(parseFloat(e.target.value) || 0); }}
          className={suffix ? 'pr-10 h-11 text-base' : 'h-11 text-base'}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>
        )}
      </div>
    </div>
  );
}

export default function EstimatingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading, canEstimate, isManager } = useAuth();

  const [estimate, setEstimate] = useState<any>(null);
  const [revision, setRevision] = useState<any>(null);
  const [lead, setLead] = useState<any>(null);
  const [ownerName, setOwnerName] = useState('—');
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [inputs, setInputs] = useState<EstimateInputs>(DEFAULT_INPUTS);
  const [serviceType, setServiceType] = useState<ServiceType>('janitorial');
  const [specialty, setSpecialty] = useState<SpecialtyInputs>(() => hydrateSpecialtyInputs('carpet_cleaning', {}));
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [confirmReopen, setConfirmReopen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [proposalOpen, setProposalOpen] = useState(false);
  const [proposalKey, setProposalKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const dirtyRef = useRef(false);

  const readOnly = estimate?.status === 'completed';
  const isJanitorial = serviceType === 'janitorial';
  const outputs = useMemo(() => calculateEstimate(inputs), [inputs]);
  const specialtyOutputs = useMemo(
    () => calculateSpecialty(serviceType, specialty),
    [serviceType, specialty]
  );
  const solvable = isPricingSolvable(inputs.overhead_percent, inputs.target_margin_percent);
  const breakdown = useMemo(
    () => (isJanitorial
      ? buildJanitorialBreakdown(inputs, outputs)
      : buildSpecialtyBreakdown(serviceType, specialty, specialtyOutputs)),
    [isJanitorial, inputs, outputs, serviceType, specialty, specialtyOutputs]
  );

  // Snapshot drift: the saved monthly_price vs what the current calculator produces
  // from the same saved inputs. Only meaningful before the user starts editing.
  const drift = useMemo(
    () => (isJanitorial && revision && !dirty ? monthlyPriceDrift(revision, outputs.monthly_price) : null),
    [isJanitorial, revision, dirty, outputs.monthly_price]
  );

  useEffect(() => { if (!loading && !user) navigate('/auth'); }, [loading, user, navigate]);

  const load = useCallback(async () => {
    if (!id) return;
    const { data: est } = await (supabase as any).from('estimates').select('*').eq('id', id).maybeSingle();
    if (!est) { setEstimate(null); return; }
    setEstimate(est);
    setName(est.name || '');
    const svc = normalizeServiceType(est.service_type);
    setServiceType(svc);

    const { data: rev } = await (supabase as any)
      .from('estimate_revisions').select('*').eq('id', est.current_revision_id).maybeSingle();
    if (rev) {
      setRevision(rev);
      setNotes(rev.notes || '');
      setSpecialty(hydrateSpecialtyInputs(svc, rev.specialty_inputs));
      setInputs(hydrateJanitorialInputs(rev));
    }

    if (est.lead_id) {
      const { data: l } = await (supabase as any)
        .from('crm_leads').select('id,company_name,contact_name').eq('id', est.lead_id).maybeSingle();
      setLead(l || null);
    }
    if (est.owner_id) {
      const { data: p } = await (supabase as any)
        .from('profiles').select('first_name,last_name').eq('id', est.owner_id).maybeSingle();
      if (p) setOwnerName(`${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || '—');
    }
    setDirty(false);
    dirtyRef.current = false;
  }, [id]);

  useEffect(() => { if (user) load(); }, [user, load]);

  const setInput = (patch: Partial<EstimateInputs>) => {
    setInputs(prev => ({ ...prev, ...patch }));
    setDirty(true);
    dirtyRef.current = true;
  };

  const setSpecialtyInput = (patch: Record<string, unknown>) => {
    setSpecialty(prev => ({ ...(prev as any), ...patch }) as SpecialtyInputs);
    setDirty(true);
    dirtyRef.current = true;
  };

  const saveDraft = useCallback(async (silent = false) => {
    if (!estimate || !revision || estimate.status === 'completed') return;
    setSaving(true);
    const revPayload = isJanitorial
      ? janitorialRevisionPayload(inputs)
      : SPECIALTY_COLUMNS(specialty, calculateSpecialty(serviceType, specialty));
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      (supabase as any).from('estimates').update({ name: name || 'Untitled estimate', updated_at: new Date().toISOString() }).eq('id', estimate.id),
      (supabase as any).from('estimate_revisions').update({
        ...revPayload, service_type: serviceType, notes, updated_at: new Date().toISOString(),
      }).eq('id', revision.id),
    ]);
    setSaving(false);
    if (e1 || e2) {
      toast({ title: 'Save failed', description: (e1 || e2)?.message, variant: 'destructive' });
      return;
    }
    setDirty(false);
    dirtyRef.current = false;
    // Keep the in-memory snapshot in sync so drift detection reflects the save.
    setRevision((prev: any) => (prev ? { ...prev, ...revPayload, notes } : prev));
    if (!silent) toast({ title: 'Draft saved' });
  }, [estimate, revision, inputs, specialty, serviceType, isJanitorial, notes, name, toast]);

  // Autosave drafts a couple of seconds after the last edit.
  useEffect(() => {
    if (!dirty || readOnly) return;
    const t = setTimeout(() => { saveDraft(true); }, 1500);
    return () => clearTimeout(t);
  }, [dirty, inputs, specialty, notes, name, readOnly, saveDraft]);

  const markComplete = async () => {
    if (!estimate || !revision || !user) return;
    setBusy(true);
    const revPayload = isJanitorial
      ? janitorialRevisionPayload(inputs)
      : SPECIALTY_COLUMNS(specialty, calculateSpecialty(serviceType, specialty));
    const now = new Date().toISOString();
    const { error: revErr } = await (supabase as any).from('estimate_revisions').update({
      ...revPayload, service_type: serviceType, notes, status: 'completed', updated_at: now,
    }).eq('id', revision.id);
    if (revErr) {
      setBusy(false);
      toast({ title: 'Could not complete', description: revErr.message, variant: 'destructive' });
      return;
    }
    const { error } = await (supabase as any).from('estimates').update({
      name: name || 'Untitled estimate', status: 'completed', completed_at: now, completed_by: user.id, updated_at: now,
    }).eq('id', estimate.id);
    setBusy(false);
    setConfirmComplete(false);
    if (error) {
      toast({ title: 'Could not complete', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Estimate completed', description: 'It is now read-only.' });
    load();
  };

  // Reopen a completed estimate so revisions can be made in place.
  const reopenForEdits = async () => {
    if (!estimate || !revision) return;
    setBusy(true);
    const now = new Date().toISOString();
    const { error: revErr } = await (supabase as any)
      .from('estimate_revisions').update({ status: 'draft', updated_at: now }).eq('id', revision.id);
    const { error } = revErr ? { error: revErr } : await (supabase as any)
      .from('estimates').update({ status: 'draft', updated_at: now }).eq('id', estimate.id);
    setBusy(false);
    setConfirmReopen(false);
    if (error) {
      toast({ title: 'Could not reopen', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Estimate reopened', description: 'Make your changes, then mark it complete again.' });
    load();
  };

  const duplicateAsDraft = async () => {
    if (!estimate || !revision || !user) return;
    setBusy(true);
    const { data: est, error } = await (supabase as any).from('estimates').insert({
      name: `${estimate.name} (copy)`,
      lead_id: estimate.lead_id,
      company_id: estimate.company_id,
      contact_id: estimate.contact_id,
      status: 'draft',
      service_type: serviceType,
      created_by: user.id,
      owner_id: user.id,
    }).select().single();
    if (error || !est) {
      setBusy(false);
      toast({ title: 'Could not duplicate', description: error?.message, variant: 'destructive' });
      return;
    }
    const revPayload = isJanitorial
      ? janitorialRevisionPayload(inputs)
      : SPECIALTY_COLUMNS(specialty, calculateSpecialty(serviceType, specialty));
    const { data: rev, error: revErr } = await (supabase as any).from('estimate_revisions').insert({
      estimate_id: est.id,
      revision_number: (revision.revision_number || 1) + 1,
      status: 'draft',
      service_type: serviceType,
      created_by: user.id,
      ...revPayload,
      notes,
    }).select().single();
    if (revErr) {
      setBusy(false);
      toast({ title: 'Could not duplicate', description: revErr.message, variant: 'destructive' });
      return;
    }
    await (supabase as any).from('estimates').update({ current_revision_id: rev.id }).eq('id', est.id);
    setBusy(false);
    navigate(`/estimating/${est.id}`);
  };

  const copySummary = async () => {
    const meta = {
      estimateName: name || 'Untitled estimate',
      opportunityName: lead?.company_name || 'Opportunity',
      ownerName,
      completedAt: estimate?.completed_at,
      notes,
    };
    const text = isJanitorial
      ? buildSummaryText(inputs, outputs, meta)
      : buildSpecialtySummaryText(serviceType, specialty, specialtyOutputs, meta);
    try {
      await navigator.clipboard.writeText(`${text}\n${breakdownText(breakdown)}`);
      toast({ title: 'Pricing summary copied' });
    } catch {
      toast({ title: 'Copy failed', description: 'Select and copy the summary manually.', variant: 'destructive' });
    }
  };

  const validationError = (() => {
    if (!name.trim()) return 'Add an estimate name.';
    if (!isJanitorial) return validateSpecialty(serviceType, specialty);
    if (!(inputs.square_feet > 0)) return 'Building square feet must be greater than zero.';
    if (!(inputs.cleanings_per_week > 0)) return 'Cleanings per week must be greater than zero.';
    if (!(inputs.production_rate_sqft_hour > 0)) return 'Production rate must be greater than zero.';
    if (!solvable) return 'Overhead % + target profit % must be under 100%.';
    return null;
  })();

  if (loading) return null;
  if (!canEstimate()) {
    return (
      <EstimatorShell title="Estimating" backTo="/estimating">
        <Card><CardContent className="py-10 text-center text-muted-foreground">You do not have access to Estimating.</CardContent></Card>
      </EstimatorShell>
    );
  }
  if (estimate === null && revision === null) {
    return (
      <EstimatorShell title="Estimate" backTo="/estimating">
        <Card><CardContent className="py-10 text-center text-muted-foreground">Estimate not found.</CardContent></Card>
      </EstimatorShell>
    );
  }

  return (
    <>
      <SEO
        title={`${name || 'Estimate'} — Estimating`}
        description="Estimate pricing worksheet with labor, materials, overhead and margin detail."
        path={`/estimating/${id ?? ''}`}
      />
      <EstimatorShell
        title={name || 'Estimate'}
        subtitle={[SERVICE_LABELS[serviceType], lead?.company_name].filter(Boolean).join(' · ')}
        backTo="/estimating"
        actions={
          readOnly ? (
            <>
              <Button size="sm" variant="outline" onClick={copySummary}>
                <Copy className="h-4 w-4 mr-1" /> Copy
              </Button>
              <Button size="sm" variant="outline" onClick={() => setConfirmReopen(true)} disabled={busy}>
                <Pencil className="h-4 w-4 mr-1" /> Edit estimate
              </Button>
              <Button size="sm" variant="outline" onClick={() => setProposalOpen(true)} disabled={busy}>
                <FileText className="h-4 w-4 mr-1" /> Customer proposal
              </Button>
              {isManager() && !estimate?.converted_job_site_id && (
                <Button size="sm" variant="outline" onClick={() => setConvertOpen(true)} disabled={busy}>
                  <Building2 className="h-4 w-4 mr-1" /> Convert to account
                </Button>
              )}
              {estimate?.converted_job_site_id && (
                <Badge variant="secondary" className="self-center">Converted to account</Badge>
              )}
              <Button size="sm" onClick={duplicateAsDraft} disabled={busy}>
                <Files className="h-4 w-4 mr-1" /> Duplicate
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={() => saveDraft()} disabled={saving}>
                <Save className="h-4 w-4 mr-1" /> {saving ? 'Saving…' : 'Save'}
              </Button>
              <Button size="sm" onClick={() => setConfirmComplete(true)} disabled={busy}>
                <CheckCircle2 className="h-4 w-4 mr-1" /> Complete
              </Button>
            </>
          )
        }
      >
        {drift?.drifted && (
          <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
            <div className="space-y-1">
              <p className="font-medium">Saved snapshot and current calculator disagree</p>
              <p className="text-muted-foreground">
                Saved monthly price {money(drift.stored)} · recalculated {money(drift.computed)}{' '}
                (difference {money(drift.computed - drift.stored)}).
                {readOnly
                  ? ' This estimate is completed and read-only — choose Edit estimate to reopen it and resave with current figures.'
                  : ' Press Save to sync the stored snapshot with these figures. Inputs are unchanged.'}
              </p>
              {!readOnly && (
                <Button size="sm" variant="outline" onClick={() => saveDraft()} disabled={saving}>
                  <Save className="h-4 w-4 mr-1" /> {saving ? 'Saving…' : 'Resave snapshot'}
                </Button>
              )}
            </div>
          </div>
        )}
        {readOnly ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge>Completed</Badge>
              <Badge variant="secondary">{SERVICE_LABELS[serviceType]}</Badge>
              <span className="text-xs text-muted-foreground">Read-only. Choose “Edit estimate” to reopen and revise it.</span>
            </div>
            <CostBreakdown model={breakdown} />
            <ProposalsList
              estimateId={estimate?.id ?? null}
              refreshKey={proposalKey}
              onNew={() => setProposalOpen(true)}
            />
            {isJanitorial ? (
              <PricingSummary
                inputs={inputs}
                outputs={outputs}
                meta={{
                  estimateName: name,
                  opportunityName: lead?.company_name || 'Opportunity',
                  ownerName,
                  completedAt: estimate?.completed_at,
                  notes,
                }}
              />
            ) : (
              <div className="space-y-3">
                <SpecialtySummaryPanel outputs={specialtyOutputs} />
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Record</CardTitle></CardHeader>
                  <CardContent className="pt-0 space-y-1 text-sm">
                    <Line label="Opportunity" value={lead?.company_name || 'Opportunity'} />
                    <Line label="Owner" value={ownerName} />
                    <Line label="Completed" value={estimate?.completed_at ? new Date(estimate.completed_at).toLocaleString() : '—'} />
                    {notes && <p className="text-xs text-muted-foreground whitespace-pre-wrap pt-2">{notes}</p>}
                  </CardContent>
                </Card>
              </div>
            )}
            <Button variant="outline" className="w-full" onClick={copySummary}>
              <Copy className="h-4 w-4 mr-2" /> Copy Pricing Summary
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-[1fr_320px] items-start">
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">Estimate</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="est-name" className="text-xs">Estimate name</Label>
                    <Input
                      id="est-name"
                      value={name}
                      className="h-11 text-base"
                      onChange={e => { setName(e.target.value); setDirty(true); }}
                      placeholder="e.g. Nightly janitorial — 5x/week"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="h-4 w-4" />
                    <span className="truncate">{lead?.company_name || 'Opportunity'}</span>
                    <Badge variant="secondary" className="ml-auto shrink-0">{SERVICE_LABELS[serviceType]}</Badge>
                  </div>
                </CardContent>
              </Card>

              {!isJanitorial && (
                <SpecialtyForm
                  service={serviceType}
                  inputs={specialty}
                  patch={setSpecialtyInput}
                />
              )}

              {isJanitorial && (
              <>
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">Production</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  <NumField id="sqft" label="Building square feet" value={inputs.square_feet} suffix="sq ft" onChange={v => setInput({ square_feet: v })} />
                  <NumField id="cpw" label="Cleanings per week" value={inputs.cleanings_per_week} onChange={v => setInput({ cleanings_per_week: v })} />
                  <NumField id="wpm" label="Weeks per month" value={inputs.weeks_per_month} onChange={v => setInput({ weeks_per_month: v })} />
                  <NumField id="rate" label="Production rate" value={inputs.production_rate_sqft_hour} suffix="/hr" onChange={v => setInput({ production_rate_sqft_hour: v })} />
                  <NumField id="minvisit" label="Minimum visit time" value={inputs.minimum_visit_minutes} suffix="min" onChange={v => setInput({ minimum_visit_minutes: v })} />
                  <NumField id="hoursoverride" label="Labor hours per visit override" value={inputs.labor_hours_per_visit_override} suffix="hr" onChange={v => setInput({ labor_hours_per_visit_override: v })} />
                  <div className="col-span-2 text-[11px] text-muted-foreground">
                    Hours/visit = max(sq ft ÷ production rate, minimum visit ÷ 60).
                    {outputs.minimum_visit_applied && ' Minimum visit time is driving this estimate.'}
                    {outputs.hours_override_applied && (
                      <span className="text-foreground font-medium">
                        {' '}Override active: {inputs.labor_hours_per_visit_override} hr/visit is driving this estimate (production rate and minimum visit are ignored). Set to 0 to disable.
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">Labor &amp; supplies</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <NumField id="wage" label="Base wage" value={inputs.base_wage} suffix="$/hr" onChange={v => setInput({ base_wage: v })} />
                    <NumField id="burden" label="Labor burden" value={inputs.labor_burden_percent} suffix="%" onChange={v => setInput({ labor_burden_percent: v })} />
                  </div>
                  <NumField id="sup" label="Supervision allowance (% of base wage labor)" value={inputs.supervision_percent} suffix="%" onChange={v => setInput({ supervision_percent: v })} />
                  <p className="text-xs text-muted-foreground">
                    Supervision cost: <span className="font-medium text-foreground">{money(outputs.monthly_supervision_cost)}/mo</span> — a direct cost added before profit pricing, not a selling-price margin.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Loaded labor rate: <span className="font-medium text-foreground">{money(outputs.loaded_labor_rate)}/hr</span>
                  </p>
                  <Separator />
                  <div className="space-y-1.5">
                    <Label className="text-xs">Supply cost per productive labor hour</Label>
                    <ToggleGroup
                      type="single"
                      value={inputs.supply_preset}
                      onValueChange={v => {
                        if (!v) return;
                        const preset = v as SupplyPreset;
                        setInput({
                          supply_preset: preset,
                          supply_rate_per_hour: preset === 'custom' ? inputs.supply_rate_per_hour : supplyRateForPreset(preset),
                        });
                      }}
                      className="justify-start flex-wrap"
                    >
                      {SUPPLY_PRESETS.map(p => (
                        <ToggleGroupItem key={p.value} value={p.value} size="sm" className="text-xs">
                          {p.label} ${p.rate.toFixed(2)}
                        </ToggleGroupItem>
                      ))}
                      <ToggleGroupItem value="custom" size="sm" className="text-xs">Custom</ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                  {inputs.supply_preset === 'custom' && (
                    <NumField id="supply" label="Custom supply rate" value={inputs.supply_rate_per_hour} suffix="$/hr" onChange={v => setInput({ supply_rate_per_hour: v })} />
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    Consumables only — vacuums, machines and other fixed assets are not included here.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">Overhead &amp; profit</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <NumField id="oh" label="Overhead" value={inputs.overhead_percent} suffix="%" onChange={v => setInput({ overhead_percent: v })} />
                    <NumField id="profit" label="Target profit margin" value={inputs.target_margin_percent} suffix="%" onChange={v => setInput({ target_margin_percent: v })} />
                  </div>
                  {!solvable && (
                    <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      Overhead % plus target profit % must be less than 100%. Pricing cannot be calculated.
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    Price = monthly direct cost ÷ (1 − overhead% − profit%). Both are true margins of the selling price, not markups on cost.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">Periodic floor care</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <NumField id="floorcare" label="Periodic floor-care allowance" value={inputs.periodic_floor_care_percent} suffix="%" onChange={v => setInput({ periodic_floor_care_percent: v })} />
                  <p className="text-[11px] text-muted-foreground">
                    Percentage of the base janitorial selling price, broken out separately and included in the monthly and annual totals.
                    Currently {money(outputs.periodic_floor_care_amount)}/mo.
                  </p>
                </CardContent>
              </Card>
              </>
              )}

              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">Internal notes &amp; assumptions</CardTitle></CardHeader>
                <CardContent>
                  <Textarea
                    value={notes}
                    onChange={e => { setNotes(e.target.value); setDirty(true); }}
                    rows={4}
                    placeholder="Scope assumptions, walkthrough notes, exclusions…"
                  />
                </CardContent>
              </Card>
            </div>

            <div className="space-y-3 md:sticky md:top-20">
              {isJanitorial ? (
              <>
              <Card className="border-brand-orange/40">
                <CardContent className="pt-6 text-center">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Monthly price</p>
                  <p className="text-3xl font-bold text-brand-orange tabular-nums">{money(outputs.monthly_price)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {money(outputs.price_per_visit)}/visit · {money(outputs.annual_price, 0)}/yr
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Hourly rate {hourlyRateFmt(outputs.hourly_rate)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 space-y-1 text-sm">
                  <Line label="Hours / visit" value={hoursFmt(outputs.labor_hours_per_visit)} />
                  <Line label="Monthly hours" value={hoursFmt(outputs.monthly_labor_hours)} />
                  <Line label="Hourly rate" value={hourlyRateFmt(outputs.hourly_rate)} />
                  <Line label="Visits / month" value={outputs.visits_per_month.toFixed(2)} />
                  <Separator className="my-2" />
                  <Line label="Loaded labor / visit" value={money(outputs.loaded_labor_cost_per_visit)} />
                  <Line label="Supervision / mo" value={money(outputs.monthly_supervision_cost)} />
                  <Line label="Supply / visit" value={money(outputs.supply_cost_per_visit)} />
                  <Line label="Direct cost / visit" value={money(outputs.direct_cost_per_visit)} />
                  <Line label="Monthly direct cost" value={money(outputs.total_direct_cost)} />
                  <Separator className="my-2" />
                  <Line label="Base janitorial price" value={money(outputs.base_monthly_price)} />
                  <Line label={`Periodic floor care (${pct(inputs.periodic_floor_care_percent)})`} value={money(outputs.periodic_floor_care_amount)} />
                  <Line label="Overhead $" value={money(outputs.overhead_amount)} />
                  <Line label="Profit $" value={money(outputs.profit_amount)} />
                  <Line label="Gross margin" value={pct(outputs.gross_margin_percent)} />
                  <Line label="Markup on direct cost" value={pct(outputs.markup_on_direct_percent)} />
                  <Line label="Price / sq ft / mo" value={`$${outputs.price_per_sqft.toFixed(4)}`} />
                </CardContent>
              </Card>
              </>
              ) : (
                <SpecialtySummaryPanel outputs={specialtyOutputs} />
              )}
              <CostBreakdown model={breakdown} />
              <Button variant="outline" className="w-full" onClick={copySummary}>
                <Copy className="h-4 w-4 mr-2" /> Copy Pricing Summary
              </Button>
            </div>
          </div>
        )}
      </EstimatorShell>

      <AlertDialog open={confirmComplete} onOpenChange={setConfirmComplete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark this estimate complete?</AlertDialogTitle>
            <AlertDialogDescription>
              {validationError
                ? validationError
                : 'Completed estimates become read-only. You can reopen it later with “Edit estimate” if the customer wants revisions.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={e => { if (validationError) { e.preventDefault(); return; } markComplete(); }}
              disabled={!!validationError || busy}
            >
              Mark Complete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmReopen} onOpenChange={setConfirmReopen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reopen this estimate for edits?</AlertDialogTitle>
            <AlertDialogDescription>
              It moves back to draft so you can make revisions. Mark it complete again when you're done.
              If you'd rather keep the completed version intact, use Duplicate instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={reopenForEdits} disabled={busy}>Reopen for edits</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {estimate && (
        <ConvertToAccountDialog
          open={convertOpen}
          onOpenChange={setConvertOpen}
          estimateId={estimate.id}
          estimateName={name || estimate.name}
          serviceType={serviceType}
          clientName={lead?.company_name || null}
          hoursPerVisit={outputs.labor_hours_per_visit}
          cleaningsPerWeek={inputs.cleanings_per_week}
          projectHours={specialtyOutputs.labor_hours}
          onConverted={() => load()}
        />
      )}

      <CreateProposalDialog
        open={proposalOpen}
        onOpenChange={setProposalOpen}
        estimateId={estimate?.id ?? null}
        revisionId={revision?.id ?? null}
        leadId={estimate?.lead_id ?? null}
        companyId={estimate?.company_id ?? null}
        defaults={{
          title: name || 'Service Proposal',
          periodLabel: breakdown.periodLabel,
          customerName: lead?.company_name || null,
          customerContactName: lead?.contact_name || null,
          customerEmail: null,
          lines: breakdown.customerLines.map(l => ({
            label: l.label,
            // Drop internal cost-allocation notes; keep customer-safe scope detail.
            detail: (l.detail || '')
              .split(' · ')
              .filter(s => !s.startsWith('includes'))
              .join(' · ') || null,
            amount: l.amount,
          })),
        }}
        onCreated={() => setProposalKey(k => k + 1)}
      />
    </>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
