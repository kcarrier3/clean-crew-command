import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, Send, Check, X, History, ClipboardList, Gauge, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { EstimatorShell } from '@/components/estimator/EstimatorShell';
import { ResultsPanel } from '@/components/estimator/ResultsPanel';
import {
  BUILDING_TYPES, ESTIMATE_STATUS_LABELS, FALLBACK_DEFAULTS, calculateEstimate,
  makeDefaultInputs, money, supplyRateForPreset,
  type EstimateInputs, type EstimatorDefaults, type SupplyPreset,
} from '@/components/estimator/calc';

interface EstimateHeader {
  id: string;
  name: string;
  status: string;
  company_id: string | null;
  lead_id: string | null;
  contact_id: string | null;
  current_revision_id: string | null;
  created_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
}

const numField = (v: string) => (v === '' ? 0 : parseFloat(v) || 0);

export default function EstimateDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading, canEstimate, canApproveEstimate } = useAuth();

  const [defaults, setDefaults] = useState<EstimatorDefaults>(FALLBACK_DEFAULTS);
  const [header, setHeader] = useState<EstimateHeader | null>(null);
  const [inputs, setInputs] = useState<EstimateInputs>(makeDefaultInputs(FALLBACK_DEFAULTS));
  const [notes, setNotes] = useState('');
  const [revisions, setRevisions] = useState<any[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [leads, setLeads] = useState<{ id: string; company_name: string; company_id: string | null }[]>([]);
  const [rateOptions, setRateOptions] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [tab, setTab] = useState('survey');

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [loading, user, navigate]);

  const load = useCallback(async () => {
    if (!id) return;
    const [{ data: s }, { data: e }, { data: cos }, { data: lds }, { data: rates }] = await Promise.all([
      (supabase as any).from('estimate_settings').select('*').limit(1).maybeSingle(),
      (supabase as any).from('estimates').select('*').eq('id', id).maybeSingle(),
      (supabase as any).from('crm_companies').select('id,name').order('name').limit(500),
      (supabase as any).from('crm_leads').select('id,company_name,company_id').order('company_name').limit(500),
      (supabase as any).from('estimate_production_rates').select('*').eq('active', true).order('building_type'),
    ]);

    const d: EstimatorDefaults = s
      ? {
          base_wage: Number(s.base_wage),
          labor_burden_percent: Number(s.labor_burden_percent),
          supply_low: Number(s.supply_low),
          supply_standard: Number(s.supply_standard),
          supply_high: Number(s.supply_high),
          default_production_rate: Number(s.default_production_rate),
          weeks_per_month: Number(s.weeks_per_month),
          default_overhead_percent: Number(s.default_overhead_percent),
          default_target_margin_percent: Number(s.default_target_margin_percent),
        }
      : FALLBACK_DEFAULTS;
    setDefaults(d);
    setCompanies(cos || []);
    setLeads(lds || []);
    setRateOptions(rates || []);

    if (!e) {
      toast({ title: 'Estimate not found', variant: 'destructive' });
      navigate('/estimates');
      return;
    }
    setHeader(e);

    const { data: revs } = await (supabase as any)
      .from('estimate_revisions')
      .select('*')
      .eq('estimate_id', id)
      .order('revision_number', { ascending: false });
    setRevisions(revs || []);

    const current = (revs || []).find((r: any) => r.id === e.current_revision_id) || (revs || [])[0];
    if (current) {
      setInputs({
        square_feet: Number(current.square_feet),
        building_type: current.building_type,
        cleanings_per_week: Number(current.cleanings_per_week),
        weeks_per_month: Number(current.weeks_per_month),
        production_rate_sqft_hour: Number(current.production_rate_sqft_hour),
        restroom_count: Number(current.restroom_count),
        fixture_count: Number(current.fixture_count),
        floor_mix: current.floor_mix || { carpet: 100, hard: 0, tile: 0 },
        occupancy_level: current.occupancy_level,
        traffic_level: current.traffic_level,
        service_window: current.service_window,
        day_porter_hours_per_week: Number(current.day_porter_hours_per_week),
        windows_hours_per_month: Number(current.windows_hours_per_month),
        periodic_floor_care: current.periodic_floor_care || { hours_per_month: 0 },
        base_wage: Number(current.base_wage),
        labor_burden_percent: Number(current.labor_burden_percent),
        supply_rate_per_hour: Number(current.supply_rate_per_hour),
        supply_preset: current.supply_preset,
        overhead_percent: Number(current.overhead_percent),
        target_margin_percent: Number(current.target_margin_percent),
        pricing_mode: current.pricing_mode,
      });
      setNotes(current.notes || '');
    } else {
      setInputs(makeDefaultInputs(d));
    }
    setReady(true);
  }, [id, navigate, toast]);

  useEffect(() => { if (user) load(); }, [user, load]);

  const out = useMemo(() => calculateEstimate(inputs), [inputs]);
  const set = <K extends keyof EstimateInputs>(k: K, v: EstimateInputs[K]) =>
    setInputs(prev => ({ ...prev, [k]: v }));

  const locked = header ? ['approved', 'won'].includes(header.status) : false;
  const editable = canEstimate() && !locked;

  const saveRevision = async () => {
    if (!header || !user) return;
    setSaving(true);
    const nextNumber = (revisions[0]?.revision_number || 0) + 1;
    const payload = {
      estimate_id: header.id,
      revision_number: nextNumber,
      status: header.status,
      ...inputs,
      floor_mix: inputs.floor_mix,
      periodic_floor_care: inputs.periodic_floor_care,
      labor_hours_per_visit: out.labor_hours_per_visit,
      monthly_labor_hours: out.monthly_labor_hours,
      loaded_labor_rate: out.loaded_labor_rate,
      monthly_labor_cost: out.monthly_labor_cost,
      monthly_supply_cost: out.monthly_supply_cost,
      total_direct_cost: out.total_direct_cost,
      overhead_amount: out.overhead_amount,
      price_per_visit: out.price_per_visit,
      monthly_price: out.monthly_price,
      annual_price: out.annual_price,
      price_per_sqft: out.price_per_sqft,
      gross_margin_percent: out.gross_margin_percent,
      markup_percent: out.markup_percent,
      notes: notes || null,
      created_by: user.id,
    };
    const { data: rev, error } = await (supabase as any)
      .from('estimate_revisions').insert(payload).select().single();
    if (error) {
      setSaving(false);
      toast({ title: 'Could not save revision', description: error.message, variant: 'destructive' });
      return;
    }
    const { error: hErr } = await (supabase as any)
      .from('estimates')
      .update({
        name: header.name,
        company_id: header.company_id,
        lead_id: header.lead_id,
        current_revision_id: rev.id,
      })
      .eq('id', header.id);
    setSaving(false);
    if (hErr) {
      toast({ title: 'Could not update estimate', description: hErr.message, variant: 'destructive' });
      return;
    }
    toast({ title: `Revision ${nextNumber} saved` });
    load();
  };

  const setStatus = async (status: string, extra: Record<string, any> = {}) => {
    if (!header) return;
    const { error } = await (supabase as any)
      .from('estimates').update({ status, ...extra }).eq('id', header.id);
    if (error) {
      toast({ title: 'Could not update status', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: `Estimate ${ESTIMATE_STATUS_LABELS[status] || status}` });
    load();
  };

  if (loading || !ready || !header) return null;

  if (!canEstimate() && header.created_by !== user?.id) {
    return (
      <EstimatorShell title="Sales Estimator" backTo="/estimates">
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          You do not have access to this estimate.
        </CardContent></Card>
      </EstimatorShell>
    );
  }

  const filteredLeads = header.company_id
    ? leads.filter(l => l.company_id === header.company_id)
    : leads;

  return (
    <EstimatorShell
      title={header.name}
      subtitle={`${ESTIMATE_STATUS_LABELS[header.status] || header.status} · ${money(out.monthly_price)}/mo`}
      backTo="/estimates"
      actions={
        editable ? (
          <Button size="sm" onClick={saveRevision} disabled={saving}>
            <Save className="h-4 w-4 mr-1" /> {saving ? 'Saving…' : 'Save'}
          </Button>
        ) : (
          <Badge variant="secondary">{ESTIMATE_STATUS_LABELS[header.status]}</Badge>
        )
      }
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4 min-w-0">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="survey" className="text-xs"><ClipboardList className="h-3.5 w-3.5 mr-1" />Survey</TabsTrigger>
              <TabsTrigger value="production" className="text-xs"><Gauge className="h-3.5 w-3.5 mr-1" />Production</TabsTrigger>
              <TabsTrigger value="pricing" className="text-xs"><DollarSign className="h-3.5 w-3.5 mr-1" />Pricing</TabsTrigger>
              <TabsTrigger value="history" className="text-xs"><History className="h-3.5 w-3.5 mr-1" />History</TabsTrigger>
            </TabsList>

            {/* ---------------- Site survey ---------------- */}
            <TabsContent value="survey" className="mt-4 space-y-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Site survey</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs">Estimate name</Label>
                    <Input
                      value={header.name}
                      disabled={!editable}
                      onChange={e => setHeader({ ...header, name: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs">Account (existing CRM account)</Label>
                      <Select
                        value={header.company_id || 'none'}
                        disabled={!editable}
                        onValueChange={v => setHeader({ ...header, company_id: v === 'none' ? null : v, lead_id: null })}
                      >
                        <SelectTrigger><SelectValue placeholder="Not linked" /></SelectTrigger>
                        <SelectContent className="max-h-72">
                          <SelectItem value="none">Not linked</SelectItem>
                          {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Opportunity</Label>
                      <Select
                        value={header.lead_id || 'none'}
                        disabled={!editable}
                        onValueChange={v => setHeader({ ...header, lead_id: v === 'none' ? null : v })}
                      >
                        <SelectTrigger><SelectValue placeholder="Not linked" /></SelectTrigger>
                        <SelectContent className="max-h-72">
                          <SelectItem value="none">Not linked</SelectItem>
                          {filteredLeads.map(l => <SelectItem key={l.id} value={l.id}>{l.company_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs">Building square footage</Label>
                      <Input type="number" inputMode="numeric" step="100" disabled={!editable}
                        value={inputs.square_feet}
                        onChange={e => set('square_feet', numField(e.target.value))} />
                    </div>
                    <div>
                      <Label className="text-xs">Building type</Label>
                      <Select value={inputs.building_type || 'General'} disabled={!editable}
                        onValueChange={v => set('building_type', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {BUILDING_TYPES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Restrooms</Label>
                      <Input type="number" inputMode="numeric" disabled={!editable}
                        value={inputs.restroom_count}
                        onChange={e => set('restroom_count', numField(e.target.value))} />
                    </div>
                    <div>
                      <Label className="text-xs">Total restroom fixtures</Label>
                      <Input type="number" inputMode="numeric" disabled={!editable}
                        value={inputs.fixture_count}
                        onChange={e => set('fixture_count', numField(e.target.value))} />
                      <p className="text-[11px] text-muted-foreground mt-1">Used instead of restroom count when provided.</p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <Label className="text-xs">Carpet %</Label>
                      <Input type="number" inputMode="numeric" disabled={!editable}
                        value={inputs.floor_mix.carpet ?? 0}
                        onChange={e => set('floor_mix', { ...inputs.floor_mix, carpet: numField(e.target.value) })} />
                    </div>
                    <div>
                      <Label className="text-xs">Hard floor %</Label>
                      <Input type="number" inputMode="numeric" disabled={!editable}
                        value={inputs.floor_mix.hard ?? 0}
                        onChange={e => set('floor_mix', { ...inputs.floor_mix, hard: numField(e.target.value) })} />
                    </div>
                    <div>
                      <Label className="text-xs">Tile %</Label>
                      <Input type="number" inputMode="numeric" disabled={!editable}
                        value={inputs.floor_mix.tile ?? 0}
                        onChange={e => set('floor_mix', { ...inputs.floor_mix, tile: numField(e.target.value) })} />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs">Occupancy / traffic</Label>
                      <ToggleGroup type="single" className="justify-start mt-1" value={inputs.traffic_level || 'medium'}
                        onValueChange={v => v && editable && set('traffic_level', v as any)}>
                        <ToggleGroupItem value="light" size="sm" className="text-xs">Light</ToggleGroupItem>
                        <ToggleGroupItem value="medium" size="sm" className="text-xs">Medium</ToggleGroupItem>
                        <ToggleGroupItem value="heavy" size="sm" className="text-xs">Heavy</ToggleGroupItem>
                      </ToggleGroup>
                    </div>
                    <div>
                      <Label className="text-xs">Service window</Label>
                      <ToggleGroup type="single" className="justify-start mt-1" value={inputs.service_window}
                        onValueChange={v => v && editable && set('service_window', v as any)}>
                        <ToggleGroupItem value="night" size="sm" className="text-xs">Night</ToggleGroupItem>
                        <ToggleGroupItem value="day" size="sm" className="text-xs">Day (+10%)</ToggleGroupItem>
                      </ToggleGroup>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Adders</CardTitle></CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <Label className="text-xs">Day porter hrs / week</Label>
                    <Input type="number" step="0.5" inputMode="decimal" disabled={!editable}
                      value={inputs.day_porter_hours_per_week}
                      onChange={e => set('day_porter_hours_per_week', numField(e.target.value))} />
                  </div>
                  <div>
                    <Label className="text-xs">Periodic floor care hrs / mo</Label>
                    <Input type="number" step="0.5" inputMode="decimal" disabled={!editable}
                      value={inputs.periodic_floor_care.hours_per_month ?? 0}
                      onChange={e => set('periodic_floor_care', { hours_per_month: numField(e.target.value) })} />
                  </div>
                  <div>
                    <Label className="text-xs">Window cleaning hrs / mo</Label>
                    <Input type="number" step="0.5" inputMode="decimal" disabled={!editable}
                      value={inputs.windows_hours_per_month}
                      onChange={e => set('windows_hours_per_month', numField(e.target.value))} />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ---------------- Production ---------------- */}
            <TabsContent value="production" className="mt-4 space-y-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Frequency & production rate</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs">Cleanings per week</Label>
                      <Input type="number" step="0.5" inputMode="decimal" disabled={!editable}
                        value={inputs.cleanings_per_week}
                        onChange={e => set('cleanings_per_week', numField(e.target.value))} />
                    </div>
                    <div>
                      <Label className="text-xs">Weeks per month</Label>
                      <Input type="number" step="0.01" inputMode="decimal" disabled={!editable}
                        value={inputs.weeks_per_month}
                        onChange={e => set('weeks_per_month', numField(e.target.value))} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Production rate (sq ft / hour)</Label>
                    <Input type="number" step="50" inputMode="numeric" disabled={!editable}
                      value={inputs.production_rate_sqft_hour}
                      onChange={e => set('production_rate_sqft_hour', numField(e.target.value))} />
                    <div className="flex flex-wrap gap-1 mt-2">
                      {rateOptions.map(r => (
                        <Button key={r.id} type="button" variant="outline" size="sm" className="text-[11px] h-7"
                          disabled={!editable}
                          onClick={() => set('production_rate_sqft_hour', Number(r.sqft_per_hour))}>
                          {r.building_type}/{r.area_type}: {r.sqft_per_hour}
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Labor & supplies</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs">Base wage ($/hr)</Label>
                      <Input type="number" step="0.25" inputMode="decimal" disabled={!editable}
                        value={inputs.base_wage}
                        onChange={e => set('base_wage', numField(e.target.value))} />
                    </div>
                    <div>
                      <Label className="text-xs">Labor burden (%)</Label>
                      <Input type="number" step="0.5" inputMode="decimal" disabled={!editable}
                        value={inputs.labor_burden_percent}
                        onChange={e => set('labor_burden_percent', numField(e.target.value))} />
                    </div>
                  </div>
                  <div className="rounded-md bg-muted p-3 text-sm">
                    Loaded labor rate: <strong>{money(out.loaded_labor_rate)}/hr</strong>
                  </div>
                  <div>
                    <Label className="text-xs">Cleaning supply cost per productive labor hour</Label>
                    <ToggleGroup type="single" className="justify-start mt-1 flex-wrap" value={inputs.supply_preset}
                      onValueChange={v => {
                        if (!v || !editable) return;
                        const preset = v as SupplyPreset;
                        setInputs(prev => ({
                          ...prev,
                          supply_preset: preset,
                          supply_rate_per_hour:
                            preset === 'custom'
                              ? prev.supply_rate_per_hour
                              : supplyRateForPreset(preset, defaults),
                        }));
                      }}>
                      <ToggleGroupItem value="low" size="sm" className="text-xs">Low {money(defaults.supply_low)}</ToggleGroupItem>
                      <ToggleGroupItem value="standard" size="sm" className="text-xs">Standard {money(defaults.supply_standard)}</ToggleGroupItem>
                      <ToggleGroupItem value="high" size="sm" className="text-xs">High {money(defaults.supply_high)}</ToggleGroupItem>
                      <ToggleGroupItem value="custom" size="sm" className="text-xs">Custom</ToggleGroupItem>
                    </ToggleGroup>
                    {inputs.supply_preset === 'custom' && (
                      <Input className="mt-2" type="number" step="0.05" inputMode="decimal" disabled={!editable}
                        value={inputs.supply_rate_per_hour}
                        onChange={e => set('supply_rate_per_hour', numField(e.target.value))} />
                    )}
                    <p className="text-[11px] text-muted-foreground mt-2">
                      Consumables only — vacuums, machines and other fixed assets are excluded.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ---------------- Pricing ---------------- */}
            <TabsContent value="pricing" className="mt-4 space-y-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Overhead & profit</CardTitle></CardHeader>
                <CardContent className="space-y-5">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <Label className="text-xs">Overhead</Label>
                      <span className="tabular-nums font-medium">{inputs.overhead_percent.toFixed(1)}%</span>
                    </div>
                    <Slider min={0} max={50} step={0.5} disabled={!editable}
                      value={[inputs.overhead_percent]}
                      onValueChange={v => set('overhead_percent', v[0])} />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Applied to direct cost: {money(out.overhead_amount)}/mo
                    </p>
                  </div>

                  <div>
                    <Label className="text-xs">Price by</Label>
                    <ToggleGroup type="single" className="justify-start mt-1" value={inputs.pricing_mode}
                      onValueChange={v => v && editable && set('pricing_mode', v as any)}>
                      <ToggleGroupItem value="margin" size="sm" className="text-xs">Target margin</ToggleGroupItem>
                      <ToggleGroupItem value="markup" size="sm" className="text-xs">Markup</ToggleGroupItem>
                    </ToggleGroup>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <Label className="text-xs">
                        {inputs.pricing_mode === 'margin' ? 'Target profit margin' : 'Markup on cost'}
                      </Label>
                      <span className="tabular-nums font-medium">{inputs.target_margin_percent.toFixed(1)}%</span>
                    </div>
                    <Slider min={0} max={inputs.pricing_mode === 'margin' ? 80 : 200} step={0.5} disabled={!editable}
                      value={[inputs.target_margin_percent]}
                      onValueChange={v => set('target_margin_percent', v[0])} />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Markup {out.markup_percent.toFixed(1)}% = true margin {out.gross_margin_percent.toFixed(1)}%
                    </p>
                  </div>

                  <div>
                    <Label className="text-xs">Notes for this revision</Label>
                    <Textarea rows={3} disabled={!editable} value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Scope assumptions, exclusions, walkthrough notes…" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Workflow</CardTitle></CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {header.status === 'draft' && canEstimate() && (
                    <Button size="sm" variant="outline" onClick={() => setStatus('pending_approval')}>
                      <Send className="h-4 w-4 mr-1" /> Submit for approval
                    </Button>
                  )}
                  {header.status === 'pending_approval' && canApproveEstimate() && (
                    <>
                      <Button size="sm"
                        onClick={() => setStatus('approved', {
                          approved_by: user?.id, approved_at: new Date().toISOString(), rejection_reason: null,
                        })}>
                        <Check className="h-4 w-4 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => setRejectOpen(true)}>
                        <X className="h-4 w-4 mr-1" /> Reject
                      </Button>
                    </>
                  )}
                  {header.status === 'pending_approval' && !canApproveEstimate() && (
                    <p className="text-sm text-muted-foreground">Waiting on owner approval.</p>
                  )}
                  {header.status === 'approved' && (
                    <>
                      <Badge>Approved</Badge>
                      {canApproveEstimate() && (
                        <Button size="sm" variant="outline" onClick={() => setStatus('draft', { approved_by: null, approved_at: null })}>
                          Reopen as draft
                        </Button>
                      )}
                    </>
                  )}
                  {header.status === 'rejected' && (
                    <div className="space-y-2">
                      <Badge variant="destructive">Rejected</Badge>
                      {header.rejection_reason && (
                        <p className="text-sm text-muted-foreground">{header.rejection_reason}</p>
                      )}
                      {canEstimate() && (
                        <Button size="sm" variant="outline" onClick={() => setStatus('draft')}>Return to draft</Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ---------------- History ---------------- */}
            <TabsContent value="history" className="mt-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Revision history</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {revisions.length === 0 && (
                    <p className="text-sm text-muted-foreground">No saved revisions yet — press Save to capture one.</p>
                  )}
                  {revisions.map(r => (
                    <div key={r.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">
                          Revision {r.revision_number}
                          {r.id === header.current_revision_id && (
                            <Badge variant="secondary" className="ml-2 text-[10px]">Current</Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(r.created_at).toLocaleString()} · {Number(r.monthly_labor_hours).toFixed(1)} hrs/mo
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-semibold tabular-nums">{money(Number(r.monthly_price))}/mo</div>
                        <div className="text-[11px] text-muted-foreground">
                          {Number(r.gross_margin_percent).toFixed(1)}% margin
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <ResultsPanel inputs={inputs} out={out} />
        </div>
      </div>

      <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject this estimate?</AlertDialogTitle>
            <AlertDialogDescription>
              Add a reason so the estimator knows what to change.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)}
            placeholder="Reason for rejection" />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setStatus('rejected', { rejection_reason: rejectReason || null });
                setRejectOpen(false);
                setRejectReason('');
              }}
            >
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </EstimatorShell>
  );
}