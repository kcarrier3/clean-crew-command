import { useEffect, useState } from 'react';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { money, pct, hoursFmt } from './calc';
import { SERVICE_LABELS, type ServiceType } from './serviceTypes';
import {
  CARPET_METHODS, FURNITURE_LEVELS, SOIL_LEVELS,
  DEFAULT_CONSTRUCTION_PHASES,
  type CarpetInputs, type ConstructionInputs, type FinancialBase,
  type ScrubInputs, type SpecialtyInputs, type SpecialtyOutputs, type VctInputs,
} from './specialtyCalc';
import type { SummaryMeta } from './PricingSummary';

/* ------------------------------------------------------------------ atoms */

export function NumField({
  id, label, value, onChange, suffix, disabled,
}: {
  id: string; label: string; value: number; onChange: (v: number) => void;
  suffix?: string; disabled?: boolean;
}) {
  const [text, setText] = useState(value === 0 ? '' : String(value ?? ''));
  useEffect(() => { setText(value === 0 ? '' : String(value)); }, [value]);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          step="any"
          value={text}
          disabled={disabled}
          onChange={e => { setText(e.target.value); onChange(parseFloat(e.target.value) || 0); }}
          className={suffix ? 'pr-12 h-11 text-base' : 'h-11 text-base'}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>
        )}
      </div>
    </div>
  );
}

function Line({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={`text-xs ${muted ? 'text-muted-foreground/70' : 'text-muted-foreground'}`}>{label}</span>
      <span className="tabular-nums text-sm">{value}</span>
    </div>
  );
}

type Patch = (patch: Record<string, unknown>) => void;

/* --------------------------------------------------------------- sections */

function FinancialsCard({ i, patch, readOnly }: { i: FinancialBase; patch: Patch; readOnly?: boolean }) {
  const solvable = (i.overhead_percent || 0) + (i.target_margin_percent || 0) < 100;
  return (
    <>
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Labor</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <NumField id="wage" label="Base wage" value={i.base_wage} suffix="$/hr" disabled={readOnly} onChange={v => patch({ base_wage: v })} />
          <NumField id="burden" label="Labor burden" value={i.labor_burden_percent} suffix="%" disabled={readOnly} onChange={v => patch({ labor_burden_percent: v })} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Materials &amp; equipment</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <NumField id="mat" label="Consumables (fixed)" value={i.materials_cost} suffix="$" disabled={readOnly} onChange={v => patch({ materials_cost: v })} />
          <NumField id="matsf" label="Consumables per sq ft" value={i.materials_cost_per_sqft} suffix="$/sf" disabled={readOnly} onChange={v => patch({ materials_cost_per_sqft: v })} />
          <NumField id="equip" label="Equipment / rental" value={i.equipment_cost} suffix="$" disabled={readOnly} onChange={v => patch({ equipment_cost: v })} />
          <NumField id="min" label="Minimum charge (optional)" value={i.minimum_charge} suffix="$" disabled={readOnly} onChange={v => patch({ minimum_charge: v })} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Overhead &amp; profit</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <NumField id="oh" label="Overhead" value={i.overhead_percent} suffix="%" disabled={readOnly} onChange={v => patch({ overhead_percent: v })} />
            <NumField id="profit" label="Target profit margin" value={i.target_margin_percent} suffix="%" disabled={readOnly} onChange={v => patch({ target_margin_percent: v })} />
          </div>
          {!solvable && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              Overhead % plus target profit % must be less than 100%. Pricing cannot be calculated.
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            Project price = direct cost ÷ (1 − overhead% − profit%). Both are true margins of the selling price, not markups on cost.
          </p>
        </CardContent>
      </Card>
    </>
  );
}

function ConstructionForm({ i, patch, readOnly }: { i: ConstructionInputs; patch: Patch; readOnly?: boolean }) {
  const phases = i.phases?.length ? i.phases : DEFAULT_CONSTRUCTION_PHASES();
  const setPhase = (id: string, p: Partial<ConstructionInputs['phases'][number]>) =>
    patch({ phases: phases.map(x => (x.id === id ? { ...x, ...p } : x)) });

  return (
    <>
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Project scope</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <NumField id="tsqft" label="Total project square feet" value={i.total_square_feet} suffix="sq ft" disabled={readOnly} onChange={v => patch({ total_square_feet: v })} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">Phases &amp; work items</CardTitle>
          {!readOnly && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => patch({
                phases: [...phases, {
                  id: `custom-${Date.now()}`, label: 'Custom work item', enabled: true,
                  sqft: 0, production_rate_sqft_hour: 1000, extra_hours: 0, notes: '', custom: true,
                }],
              })}
            >
              <Plus className="h-4 w-4 mr-1" /> Add item
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {phases.map(p => (
            <div key={p.id} className="rounded-lg border border-border p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={p.enabled}
                  disabled={readOnly}
                  onCheckedChange={c => setPhase(p.id, { enabled: !!c })}
                  id={`ph-${p.id}`}
                />
                {p.custom ? (
                  <Input
                    value={p.label}
                    disabled={readOnly}
                    onChange={e => setPhase(p.id, { label: e.target.value })}
                    className="h-9"
                  />
                ) : (
                  <Label htmlFor={`ph-${p.id}`} className="text-sm font-medium">{p.label}</Label>
                )}
                {p.custom && !readOnly && (
                  <Button variant="ghost" size="icon" className="ml-auto" onClick={() => patch({ phases: phases.filter(x => x.id !== p.id) })}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {p.enabled && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <NumField
                      id={`sf-${p.id}`}
                      label="Square feet"
                      value={p.sqft || 0}
                      suffix="sq ft"
                      disabled={readOnly}
                      onChange={v => setPhase(p.id, { sqft: v })}
                    />
                    <NumField id={`pr-${p.id}`} label="Production rate" value={p.production_rate_sqft_hour} suffix="sf/hr" disabled={readOnly} onChange={v => setPhase(p.id, { production_rate_sqft_hour: v })} />
                    <NumField id={`xh-${p.id}`} label="Additional fixed hours" value={p.extra_hours} suffix="hr" disabled={readOnly} onChange={v => setPhase(p.id, { extra_hours: v })} />
                    <div className="space-y-1.5">
                      <Label htmlFor={`nt-${p.id}`} className="text-xs">Notes</Label>
                      <Input id={`nt-${p.id}`} value={p.notes || ''} disabled={readOnly} onChange={e => setPhase(p.id, { notes: e.target.value })} className="h-11" />
                    </div>
                  </div>
                  {!p.sqft && (
                    <p className="text-[11px] text-muted-foreground">Blank square feet uses the total project square feet.</p>
                  )}
                </>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}

function CarpetForm({ i, patch, readOnly }: { i: CarpetInputs; patch: Patch; readOnly?: boolean }) {
  return (
    <>
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Scope &amp; method</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Cleaning method</Label>
            <ToggleGroup
              type="single"
              value={i.method}
              disabled={readOnly}
              onValueChange={v => {
                if (!v) return;
                const m = CARPET_METHODS.find(x => x.value === v);
                patch({ method: v, production_rate_sqft_hour: m && v !== 'custom' ? m.rate : i.production_rate_sqft_hour });
              }}
              className="justify-start flex-wrap"
            >
              {CARPET_METHODS.map(m => (
                <ToggleGroupItem key={m.value} value={m.value} size="sm" className="text-xs">{m.label}</ToggleGroupItem>
              ))}
            </ToggleGroup>
            <p className="text-[11px] text-muted-foreground">Method only sets a starting production rate — edit the rate freely.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumField id="csf" label="Carpet square feet" value={i.square_feet} suffix="sq ft" disabled={readOnly} onChange={v => patch({ square_feet: v })} />
            <NumField id="crate" label="Production rate" value={i.production_rate_sqft_hour} suffix="sf/hr" disabled={readOnly} onChange={v => patch({ production_rate_sqft_hour: v })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Adjustments</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Soil / spotting multiplier</Label>
            <ToggleGroup
              type="single"
              value={SOIL_LEVELS.find(s => s.multiplier === i.soil_multiplier)?.value || 'custom'}
              disabled={readOnly}
              onValueChange={v => { const s = SOIL_LEVELS.find(x => x.value === v); if (s) patch({ soil_multiplier: s.multiplier }); }}
              className="justify-start flex-wrap"
            >
              {SOIL_LEVELS.map(s => (
                <ToggleGroupItem key={s.value} value={s.value} size="sm" className="text-xs">{s.label} ×{s.multiplier}</ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumField id="cmult" label="Multiplier (editable)" value={i.soil_multiplier} suffix="×" disabled={readOnly} onChange={v => patch({ soil_multiplier: v })} />
            <NumField id="csoilhrs" label="Extra spotting hours" value={i.soil_extra_hours} suffix="hr" disabled={readOnly} onChange={v => patch({ soil_extra_hours: v })} />
            <NumField id="csteps" label="Stair steps" value={i.stair_steps} disabled={readOnly} onChange={v => patch({ stair_steps: v })} />
            <NumField id="cstephr" label="Hours per step" value={i.hours_per_stair_step} suffix="hr" disabled={readOnly} onChange={v => patch({ hours_per_stair_step: v })} />
          </div>
          <Separator />
          <div className="space-y-1.5">
            <Label className="text-xs">Furniture moving</Label>
            <ToggleGroup
              type="single"
              value={i.furniture_level}
              disabled={readOnly}
              onValueChange={v => {
                if (!v) return;
                const f = FURNITURE_LEVELS.find(x => x.value === v);
                patch({ furniture_level: v, furniture_extra_hours: f ? f.hours : i.furniture_extra_hours });
              }}
              className="justify-start flex-wrap"
            >
              {FURNITURE_LEVELS.map(f => (
                <ToggleGroupItem key={f.value} value={f.value} size="sm" className="text-xs">{f.label}</ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumField id="cfurn" label="Furniture hours" value={i.furniture_extra_hours} suffix="hr" disabled={readOnly} onChange={v => patch({ furniture_extra_hours: v })} />
            <NumField id="cadd" label="Additional labor hours" value={i.additional_hours} suffix="hr" disabled={readOnly} onChange={v => patch({ additional_hours: v })} />
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function ScrubForm({ i, patch, readOnly }: { i: ScrubInputs; patch: Patch; readOnly?: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-sm">Scope &amp; production</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <NumField id="ssf" label="Square feet" value={i.square_feet} suffix="sq ft" disabled={readOnly} onChange={v => patch({ square_feet: v })} />
          <NumField id="srate" label="Production rate" value={i.production_rate_sqft_hour} suffix="sf/hr" disabled={readOnly} onChange={v => patch({ production_rate_sqft_hour: v })} />
          <NumField id="spasses" label="Number of passes" value={i.passes} disabled={readOnly} onChange={v => patch({ passes: v })} />
          <NumField id="sedge" label="Edges / detail hours" value={i.edge_detail_hours} suffix="hr" disabled={readOnly} onChange={v => patch({ edge_detail_hours: v })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Soil level</Label>
          <ToggleGroup
            type="single"
            value={SOIL_LEVELS.find(s => s.multiplier === i.soil_multiplier)?.value || 'custom'}
            disabled={readOnly}
            onValueChange={v => { const s = SOIL_LEVELS.find(x => x.value === v); if (s) patch({ soil_multiplier: s.multiplier }); }}
            className="justify-start flex-wrap"
          >
            {SOIL_LEVELS.map(s => (
              <ToggleGroupItem key={s.value} value={s.value} size="sm" className="text-xs">{s.label} ×{s.multiplier}</ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <NumField id="smult" label="Soil multiplier (editable)" value={i.soil_multiplier} suffix="×" disabled={readOnly} onChange={v => patch({ soil_multiplier: v })} />
      </CardContent>
    </Card>
  );
}

function VctForm({ i, patch, readOnly }: { i: VctInputs; patch: Patch; readOnly?: boolean }) {
  return (
    <>
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Strip &amp; rinse</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <NumField id="vsf" label="VCT square feet" value={i.square_feet} suffix="sq ft" disabled={readOnly} onChange={v => patch({ square_feet: v })} />
          <NumField id="vstrip" label="Strip production rate" value={i.strip_rate_sqft_hour} suffix="sf/hr" disabled={readOnly} onChange={v => patch({ strip_rate_sqft_hour: v })} />
          <NumField id="vrinse" label="Rinse / neutralize rate" value={i.rinse_rate_sqft_hour} suffix="sf/hr" disabled={readOnly} onChange={v => patch({ rinse_rate_sqft_hour: v })} />
          <NumField id="vrinsex" label="Rinse extra hours" value={i.rinse_extra_hours} suffix="hr" disabled={readOnly} onChange={v => patch({ rinse_extra_hours: v })} />
          <NumField id="vedge" label="Edge / detail / scrape hours" value={i.edge_detail_hours} suffix="hr" disabled={readOnly} onChange={v => patch({ edge_detail_hours: v })} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Finish</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <NumField id="vfin" label="Finish application rate" value={i.finish_rate_sqft_hour} suffix="sf/hr" disabled={readOnly} onChange={v => patch({ finish_rate_sqft_hour: v })} />
          <NumField id="vcoats" label="Number of coats" value={i.finish_coats} disabled={readOnly} onChange={v => patch({ finish_coats: v })} />
          <NumField id="vcov" label="Finish coverage" value={i.finish_coverage_sqft_gallon} suffix="sf/gal" disabled={readOnly} onChange={v => patch({ finish_coverage_sqft_gallon: v })} />
          <NumField id="vcost" label="Finish cost" value={i.finish_cost_per_gallon} suffix="$/gal" disabled={readOnly} onChange={v => patch({ finish_cost_per_gallon: v })} />
        </CardContent>
      </Card>
    </>
  );
}

/* ------------------------------------------------------------------ forms */

export function SpecialtyForm({
  service, inputs, patch, readOnly,
}: { service: ServiceType; inputs: SpecialtyInputs; patch: Patch; readOnly?: boolean }) {
  return (
    <>
      {service === 'construction_cleaning' && <ConstructionForm i={inputs as ConstructionInputs} patch={patch} readOnly={readOnly} />}
      {service === 'carpet_cleaning' && <CarpetForm i={inputs as CarpetInputs} patch={patch} readOnly={readOnly} />}
      {service === 'floor_scrubbing' && <ScrubForm i={inputs as ScrubInputs} patch={patch} readOnly={readOnly} />}
      {service === 'vct_strip_wax' && <VctForm i={inputs as VctInputs} patch={patch} readOnly={readOnly} />}
      <FinancialsCard i={inputs as FinancialBase} patch={patch} readOnly={readOnly} />
    </>
  );
}

/* ---------------------------------------------------------------- summary */

export function SpecialtySummaryPanel({ outputs }: { outputs: SpecialtyOutputs }) {
  return (
    <>
      <Card className="border-brand-orange/40">
        <CardContent className="pt-6 text-center">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Project price</p>
          <p className="text-3xl font-bold text-brand-orange tabular-nums">{money(outputs.project_price)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {hoursFmt(outputs.labor_hours)} · ${outputs.price_per_sqft.toFixed(4)}/sq ft
          </p>
          {outputs.minimum_applied && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Minimum charge applied (calculated {money(outputs.calculated_price)})
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 space-y-1 text-sm">
          {outputs.lines.map((l, idx) => (
            <div key={idx}>
              <Line label={l.label} value={`${hoursFmt(l.hours)} · ${money(l.cost)}`} />
              {l.detail && <p className="text-[10px] text-muted-foreground/80 -mt-0.5">{l.detail}</p>}
            </div>
          ))}
          <Separator className="my-2" />
          <Line label="Total labor hours" value={hoursFmt(outputs.labor_hours)} />
          <Line label="Loaded labor rate" value={`${money(outputs.loaded_labor_rate)}/hr`} />
          <Line label="Labor cost" value={money(outputs.labor_cost)} />
          <Line label="Materials / consumables" value={money(outputs.materials_cost)} />
          <Line label="Equipment / direct" value={money(outputs.equipment_cost)} />
          <Line label="Total direct cost" value={money(outputs.total_direct_cost)} />
          {outputs.extras.map((e, idx) => <Line key={idx} label={e.label} value={e.value} muted />)}
          <Separator className="my-2" />
          <Line label="Overhead $" value={money(outputs.overhead_amount)} />
          <Line label="Profit $" value={money(outputs.profit_amount)} />
          <Line label="Gross margin" value={pct(outputs.gross_margin_percent)} />
          <Line label="Markup on direct cost" value={pct(outputs.markup_on_direct_percent)} />
          <Line label="Price / sq ft" value={`$${outputs.price_per_sqft.toFixed(4)}`} />
        </CardContent>
      </Card>
    </>
  );
}

export function buildSpecialtySummaryText(
  service: ServiceType,
  inputs: SpecialtyInputs,
  o: SpecialtyOutputs,
  m: SummaryMeta
): string {
  const f = inputs as FinancialBase;
  return [
    'INTERNAL PRICING SUMMARY',
    `Service: ${SERVICE_LABELS[service] || service}`,
    `Opportunity: ${m.opportunityName}`,
    `Estimate: ${m.estimateName}`,
    m.completedAt ? `Completed: ${new Date(m.completedAt).toLocaleDateString()}` : null,
    `Owner: ${m.ownerName}`,
    '',
    'LABOR',
    ...o.lines.map(l => `${l.label}: ${l.hours.toFixed(2)} hr · ${money(l.cost)}${l.detail ? ` (${l.detail})` : ''}`),
    `Total labor hours: ${o.labor_hours.toFixed(2)}`,
    `Base wage: ${money(f.base_wage)}/hr · burden ${pct(f.labor_burden_percent)} · loaded ${money(o.loaded_labor_rate)}/hr`,
    `Labor cost: ${money(o.labor_cost)}`,
    '',
    'DIRECT COST',
    `Materials / consumables: ${money(o.materials_cost)}`,
    `Equipment / rental: ${money(o.equipment_cost)}`,
    `Total direct cost: ${money(o.total_direct_cost)}`,
    ...o.extras.map(e => `${e.label}: ${e.value}`),
    '',
    'PRICING',
    `Overhead ${pct(f.overhead_percent)}: ${money(o.overhead_amount)}`,
    `Target profit ${pct(f.target_margin_percent)}: ${money(o.profit_amount)}`,
    o.minimum_applied ? `Minimum charge applied (calculated ${money(o.calculated_price)})` : null,
    `Project price: ${money(o.project_price)}`,
    `Price per sq ft: $${o.price_per_sqft.toFixed(4)}`,
    `Gross margin: ${pct(o.gross_margin_percent)} (equivalent markup ${pct(o.markup_on_direct_percent)})`,
    m.notes ? '' : null,
    m.notes ? 'INTERNAL NOTES' : null,
    m.notes || null,
  ].filter(l => l !== null).join('\n');
}