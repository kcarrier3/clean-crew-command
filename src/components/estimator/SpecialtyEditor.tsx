import { useEffect, useState } from 'react';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { money, pct, hoursFmt } from './calc';
import { SERVICE_LABELS, type ServiceType } from './serviceTypes';
import {
  CARPET_METHODS, FURNITURE_LEVELS, SOIL_LEVELS,
  DEFAULT_CONSTRUCTION_PHASES,
  constructionLaborRate,
  calculateConstruction,
  CONSTRUCTION_COMPLEXITY_LEVELS, CONSTRUCTION_PROJECT_TYPES, PRICING_POSITIONS,
  complexityMultiplier, suggestedDayRate,
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

function FinancialsCard({
  i, patch, readOnly, hideLabor, hideConsumables,
}: { i: FinancialBase; patch: Patch; readOnly?: boolean; hideLabor?: boolean; hideConsumables?: boolean }) {
  const solvable = (i.overhead_percent || 0) + (i.target_margin_percent || 0) < 100;
  return (
    <>
      {!hideLabor && (
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Labor</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <NumField id="wage" label="Base wage" value={i.base_wage} suffix="$/hr" disabled={readOnly} onChange={v => patch({ base_wage: v })} />
          <NumField id="burden" label="Labor burden" value={i.labor_burden_percent} suffix="%" disabled={readOnly} onChange={v => patch({ labor_burden_percent: v })} />
        </CardContent>
      </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">{hideConsumables ? 'Equipment' : 'Materials & equipment'}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          {!hideConsumables && (
            <>
              <NumField id="mat" label="Consumables (fixed)" value={i.materials_cost} suffix="$" disabled={readOnly} onChange={v => patch({ materials_cost: v })} />
              <NumField id="matsf" label="Consumables per sq ft" value={i.materials_cost_per_sqft} suffix="$/sf" disabled={readOnly} onChange={v => patch({ materials_cost_per_sqft: v })} />
            </>
          )}
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
  const wage = constructionLaborRate(i);
  const crewDayMode = i.crew_day_mode !== false;
  const dm = calculateConstruction(i).day_model!;
  const complexityIdx = Math.max(0, CONSTRUCTION_COMPLEXITY_LEVELS.findIndex(c => c.value === i.complexity));
  const positionIdx = Math.max(0, PRICING_POSITIONS.findIndex(p => p.value === i.pricing_position));
  const suggested = suggestedDayRate(i.pricing_position, i.suggested_day_rate_min, i.suggested_day_rate_max);

  return (
    <>
      {/* 1 — bidding settings (auto-populated, replaces crew composition) */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Bidding settings</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-[11px] text-muted-foreground">
            Your standing crew assumptions. They auto-populate on every construction bid and show your daily crew cost — they don&apos;t set the price.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <NumField id="crewsize" label="Workers per crew-day" value={i.crew_size} disabled={readOnly} onChange={v => patch({ crew_size: v })} />
            <NumField id="hpd" label="Hours per crew-day" value={i.hours_per_crew_day} suffix="hr" disabled={readOnly} onChange={v => patch({ hours_per_crew_day: v })} />
            <NumField id="crewwage" label="Worker wage" value={i.crew_member_wage} suffix="$/hr" disabled={readOnly} onChange={v => patch({ crew_member_wage: v })} />
            <NumField id="leadwage" label="Crew lead wage" value={i.crew_lead_wage} suffix="$/hr" disabled={readOnly} onChange={v => patch({ crew_lead_wage: v })} />
            <NumField id="crewleads" label="Crew leads on the crew" value={i.crew_lead_count} disabled={readOnly} onChange={v => patch({ crew_lead_count: v })} />
          </div>
          <div className="rounded-md border border-border bg-muted/40 p-3 space-y-1">
            <Line label="Blended hourly wage" value={dm.blended_hourly_wage > 0 ? money(dm.blended_hourly_wage) : 'Using base wage'} />
            <Line label="Loaded hourly labor cost" value={`${money(wage.effective)}/hr`} />
            <Line label="Labor hours per crew-day" value={hoursFmt(dm.labor_hours_per_crew_day)} />
            <Separator className="my-1" />
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs font-medium">Daily crew cost</span>
              <span className="tabular-nums text-sm font-semibold">{money(dm.labor_cost_per_crew_day)}</span>
            </div>
          </div>
          <Separator />
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                id="union"
                checked={!!i.union_project}
                disabled={readOnly}
                onCheckedChange={c => patch({ union_project: !!c })}
              />
              Union project
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                id="prevailing"
                checked={!!i.prevailing_wage_project}
                disabled={readOnly}
                onCheckedChange={c => patch({ prevailing_wage_project: !!c })}
              />
              Prevailing wage project
            </label>
          </div>

          {!wage.prevailing ? (
            <div className="grid grid-cols-2 gap-3">
              <NumField id="cwage" label="Base wage" value={i.base_wage} suffix="$/hr" disabled={readOnly} onChange={v => patch({ base_wage: v })} />
              <NumField id="cburden" label="Labor burden" value={i.labor_burden_percent} suffix="%" disabled={readOnly} onChange={v => patch({ labor_burden_percent: v })} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <NumField id="pwage" label="Prevailing / union base wage" value={i.prevailing_base_wage} suffix="$/hr" disabled={readOnly} onChange={v => patch({ prevailing_base_wage: v })} />
              <NumField id="pfringe" label="Fringe / benefits" value={i.prevailing_fringe_per_hour} suffix="$/hr" disabled={readOnly} onChange={v => patch({ prevailing_fringe_per_hour: v })} />
              <NumField id="cburden2" label="Payroll burden (on wage)" value={i.labor_burden_percent} suffix="%" disabled={readOnly} onChange={v => patch({ labor_burden_percent: v })} />
              <NumField id="pextra" label="Additional hourly burden" value={i.prevailing_additional_burden_per_hour} suffix="$/hr" disabled={readOnly} onChange={v => patch({ prevailing_additional_burden_per_hour: v })} />
            </div>
          )}
          {wage.prevailing && (
            <p className="text-[11px] text-muted-foreground">
              Prevailing / union rates replace the blended crew wage for costing. Burden % applies to the wage only — fringe dollars are never burdened twice.
            </p>
          )}
        </CardContent>
      </Card>

      {/* 2 — project scope & type */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Project scope &amp; type</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <NumField id="tsqft" label="Total project square feet" value={i.total_square_feet} suffix="sq ft" disabled={readOnly} onChange={v => patch({ total_square_feet: v })} />
          <div className="space-y-1.5">
            <Label className="text-xs">Project type — sets the production rate</Label>
            <ToggleGroup
              type="single"
              value={i.project_type}
              disabled={readOnly}
              onValueChange={v => {
                if (!v) return;
                const t = CONSTRUCTION_PROJECT_TYPES.find(x => x.value === v);
                patch({
                  project_type: v,
                  baseline_sqft_per_crew_day: t && v !== 'custom' ? t.baseline : i.baseline_sqft_per_crew_day,
                  adjusted_sqft_per_crew_day_override: 0,
                });
              }}
              className="justify-start flex-wrap"
            >
              {CONSTRUCTION_PROJECT_TYPES.map(t => (
                <ToggleGroupItem key={t.value} value={t.value} size="sm" className="text-xs">{t.label}</ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Complexity / density</Label>
              <Badge variant="secondary" className="tabular-nums">{dm.complexity_label} ×{dm.complexity_multiplier}</Badge>
            </div>
            <Slider
              value={[complexityIdx]}
              min={0}
              max={CONSTRUCTION_COMPLEXITY_LEVELS.length - 1}
              step={1}
              disabled={readOnly}
              onValueChange={([v]) => patch({ complexity: CONSTRUCTION_COMPLEXITY_LEVELS[v].value, adjusted_sqft_per_crew_day_override: 0 })}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              {CONSTRUCTION_COMPLEXITY_LEVELS.map(c => <span key={c.value}>{c.label}</span>)}
            </div>
          </div>
          <div className="rounded-md border border-brand-orange/40 bg-brand-orange/5 p-3 space-y-1">
            <Line label="Production rate" value={`${Math.round(dm.adjusted_sqft_per_crew_day).toLocaleString()} sf/crew-day`} />
            <Line label="Estimated crew-days" value={`${dm.crew_days.toFixed(2)} (${dm.billable_days} billable)`} />
            <Line label="Estimated labor hours" value={hoursFmt(dm.labor_hours)} muted />
          </div>
          <div className="grid grid-cols-2 gap-3 items-end">
            <NumField id="baseprod" label="Baseline production (editable)" value={i.baseline_sqft_per_crew_day} suffix="sf/crew-day" disabled={readOnly} onChange={v => patch({ baseline_sqft_per_crew_day: v })} />
            <NumField id="prodover" label="Override production (optional)" value={i.adjusted_sqft_per_crew_day_override} suffix="sf/day" disabled={readOnly} onChange={v => patch({ adjusted_sqft_per_crew_day_override: v })} />
          </div>
          {!readOnly && dm.production_overridden && (
            <Button variant="outline" size="sm" onClick={() => patch({ adjusted_sqft_per_crew_day_override: 0 })}>
              Reset to calculated
            </Button>
          )}
          {!crewDayMode && (
            <p className="text-[11px] text-muted-foreground">
              This estimate was saved with the older phase-based model, so its hours still come from the items below.
              <Button variant="link" size="sm" className="h-auto p-0 ml-1 text-[11px]" disabled={readOnly} onClick={() => patch({ crew_day_mode: true })}>
                Switch to crew-day estimating
              </Button>
            </p>
          )}
        </CardContent>
      </Card>

      {/* 3 — pricing & minimums */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Pricing &amp; minimums</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <NumField id="minday" label="Minimum day rate (1 day)" value={i.minimum_day_rate} suffix="$/day" disabled={readOnly} onChange={v => patch({ minimum_day_rate: v })} />
            <NumField id="minmulti" label="Minimum day rate (multi-day)" value={i.multi_day_minimum_day_rate} suffix="$/day" disabled={readOnly} onChange={v => patch({ multi_day_minimum_day_rate: v })} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              id="applymin"
              checked={i.apply_minimum_day_rate !== false}
              disabled={readOnly}
              onCheckedChange={c => patch({ apply_minimum_day_rate: !!c })}
            />
            Enforce the minimum day rate on this bid
          </label>
          <div className="grid grid-cols-2 gap-3 items-end">
            <NumField id="dayrate" label="Proposed day rate" value={i.proposed_day_rate} suffix="$/day" disabled={readOnly} onChange={v => patch({ proposed_day_rate: v })} />
            {!readOnly && (
              <Button variant="outline" size="sm" onClick={() => patch({ proposed_day_rate: Math.round(suggested) })}>
                Use suggested {money(suggested)}
              </Button>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Pricing position / workload — guidance only</Label>
            <Slider
              value={[positionIdx]}
              min={0}
              max={PRICING_POSITIONS.length - 1}
              step={1}
              disabled={readOnly}
              onValueChange={([v]) => patch({ pricing_position: PRICING_POSITIONS[v].value })}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              {PRICING_POSITIONS.map(p => <span key={p.value}>{p.label}</span>)}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <NumField id="drmin" label="Suggested range min" value={i.suggested_day_rate_min} suffix="$" disabled={readOnly} onChange={v => patch({ suggested_day_rate_min: v })} />
              <NumField id="drmax" label="Suggested range max" value={i.suggested_day_rate_max} suffix="$" disabled={readOnly} onChange={v => patch({ suggested_day_rate_max: v })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Final project price basis</Label>
            <ToggleGroup
              type="single"
              value={dm.price_basis}
              disabled={readOnly}
              onValueChange={v => v && patch({ price_basis: v })}
              className="justify-start flex-wrap"
            >
              <ToggleGroupItem value="day_rate" size="sm" className="text-xs">Day rate</ToggleGroupItem>
              <ToggleGroupItem value="cost" size="sm" className="text-xs">Cost-based</ToggleGroupItem>
              <ToggleGroupItem value="manual" size="sm" className="text-xs">Manual price</ToggleGroupItem>
            </ToggleGroup>
          </div>
          {dm.price_basis === 'manual' && (
            <NumField id="manprice" label="Manual final project price" value={i.manual_project_price} suffix="$" disabled={readOnly} onChange={v => patch({ manual_project_price: v })} />
          )}
          <div className="rounded-md border border-border bg-muted/40 p-3 space-y-1">
            <Line label="Billing day rate" value={`${money(dm.proposed_day_rate)}/day${dm.minimum_day_rate_applied ? ' (minimum applied)' : ''}`} />
            <Line label="Day-rate project price" value={`${money(dm.day_rate_project_price)} (${dm.billable_days} day${dm.billable_days === 1 ? '' : 's'})`} />
            <Line label="Cost-based target-margin price" value={money(dm.target_margin_price)} muted />
            <Line label="Break-even price" value={money(dm.breakeven_price)} muted />
            <Separator className="my-1" />
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs font-medium">Final project price</span>
              <span className="tabular-nums text-sm font-semibold">{money(dm.final_project_price)}</span>
            </div>
            <Line label="Effective day rate" value={`${money(dm.effective_day_rate)}/day`} />
          </div>
          {dm.multi_day && (
            <p className="text-[11px] text-muted-foreground">
              Multi-day project — the lower multi-day minimum applies.
            </p>
          )}
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
      <FinancialsCard
        i={inputs as FinancialBase}
        patch={patch}
        readOnly={readOnly}
        hideLabor={service === 'construction_cleaning'}
        hideConsumables={service === 'construction_cleaning'}
      />
    </>
  );
}

/* ---------------------------------------------------------------- summary */

export function SpecialtySummaryPanel({ outputs }: { outputs: SpecialtyOutputs }) {
  const dm = outputs.day_model;
  const statusClass = !dm ? ''
    : dm.status === 'target' ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
    : dm.status === 'below_target' ? 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400'
    : 'border-destructive/50 bg-destructive/10 text-destructive';
  return (
    <>
      <Card className="border-brand-orange/40">
        <CardContent className="pt-6 text-center">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Project price</p>
          <p className="text-3xl font-bold text-brand-orange tabular-nums">{money(outputs.project_price)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {hoursFmt(outputs.labor_hours)} · ${outputs.price_per_sqft.toFixed(4)}/sq ft
          </p>
          {dm && (
            <p className="text-xs text-muted-foreground mt-1">
              {dm.crew_days.toFixed(2)} crew-days · {money(dm.effective_day_rate)}/day effective
            </p>
          )}
          {outputs.minimum_applied && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Minimum charge applied (calculated {money(outputs.calculated_price)})
            </p>
          )}
        </CardContent>
      </Card>
      {dm && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Day &amp; price decision</CardTitle></CardHeader>
          <CardContent className="pt-0 space-y-1">
            <div className={`rounded-md border p-2 text-xs font-medium ${statusClass}`}>{dm.status_label}</div>
            <Line label="Estimated crew-days" value={dm.crew_days.toFixed(2)} />
            <Line label="Estimated labor hours" value={hoursFmt(dm.labor_hours)} />
            <Line label="Adjusted production" value={`${Math.round(dm.adjusted_sqft_per_crew_day).toLocaleString()} sf/crew-day`} muted />
            <Separator className="my-2" />
            <Line label="Cost-based target-margin price" value={money(dm.target_margin_price)} />
            <Line label="Break-even price" value={money(dm.breakeven_price)} />
            <Line label="Selected day rate" value={`${money(dm.proposed_day_rate)}/day`} />
            <Line label="Day-rate project price" value={money(dm.day_rate_project_price)} />
            <Line label="Final project price" value={money(dm.final_project_price)} />
            <Line label="Effective day rate" value={`${money(dm.effective_day_rate)}/day`} />
            <Separator className="my-2" />
            <Line label="Expected profit" value={money(outputs.profit_amount)} />
            <Line label="Expected gross margin" value={pct(outputs.gross_margin_percent)} />
            <Line label="Price / sq ft" value={`$${outputs.price_per_sqft.toFixed(4)}`} />
          </CardContent>
        </Card>
      )}
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
          <Line label="Effective labor rate" value={`${money(outputs.loaded_labor_rate)}/hr`} />
          <Line label="Labor cost" value={money(outputs.labor_cost)} />
          {outputs.supply_cost !== undefined
            ? <Line label="Project supplies" value={money(outputs.supply_cost)} />
            : <Line label="Materials / consumables" value={money(outputs.materials_cost)} />}
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
      {outputs.labor_budget && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Labor budget</CardTitle></CardHeader>
          <CardContent className="pt-0 space-y-1">
            <Line
              label="Labor type"
              value={
                outputs.labor_budget.labor_type === 'standard'
                  ? 'Standard / Non-prevailing'
                  : [outputs.labor_budget.union_project ? 'Union' : null,
                     outputs.labor_budget.prevailing_wage_project ? 'Prevailing wage' : null]
                      .filter(Boolean).join(' + ')
              }
            />
            <Line label="Estimated labor hours" value={hoursFmt(outputs.labor_budget.labor_hours)} />
            <Line label="Effective hourly labor cost" value={`${money(outputs.labor_budget.effective_hourly_labor_cost)}/hr`} />
            <Line label="Total estimated labor cost" value={money(outputs.labor_budget.labor_cost)} />
            <Line label="Cost per labor hour (incl. supplies)" value={`${money(outputs.labor_budget.cost_per_labor_hour)}/hr`} muted />
            <Separator className="my-2" />
            <Line label="Recommended project charge" value={money(outputs.project_price)} />
            <Line label="Expected gross profit" value={money(outputs.project_price - outputs.total_direct_cost)} />
            <Line label="Expected gross margin" value={pct(outputs.gross_margin_percent)} />
            <Separator className="my-2" />
            <Line label="Max hours at target margin" value={hoursFmt(outputs.labor_budget.max_hours_at_target_margin)} />
            <Line label="Break-even hours" value={hoursFmt(outputs.labor_budget.breakeven_hours)} />
            <p className="text-[11px] text-muted-foreground pt-1">
              Max hours keeps the target profit intact. Break-even hours still covers overhead but leaves zero profit.
            </p>
          </CardContent>
        </Card>
      )}
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
    ...(o.day_model ? [
      `Project type: ${o.day_model.project_type}`,
      `Baseline production: ${Math.round(o.day_model.baseline_sqft_per_crew_day).toLocaleString()} sq ft/crew-day`,
      `Complexity: ${o.day_model.complexity_label} (×${o.day_model.complexity_multiplier}) → ${Math.round(o.day_model.adjusted_sqft_per_crew_day).toLocaleString()} sq ft/crew-day${o.day_model.production_overridden ? ' (manual override)' : ''}`,
      `Estimated crew-days: ${o.day_model.crew_days.toFixed(2)} × ${o.day_model.hours_per_crew_day} hr/day`,
    ] : []),
    ...o.lines.map(l => `${l.label}: ${l.hours.toFixed(2)} hr · ${money(l.cost)}${l.detail ? ` (${l.detail})` : ''}`),
    `Total labor hours: ${o.labor_hours.toFixed(2)}`,
    o.labor_budget
      ? `Labor type: ${o.labor_budget.labor_type === 'standard'
          ? 'Standard / Non-prevailing'
          : [o.labor_budget.union_project ? 'Union' : null, o.labor_budget.prevailing_wage_project ? 'Prevailing wage' : null].filter(Boolean).join(' + ')}`
      : null,
    o.labor_budget
      ? `Wage ${money(o.labor_budget.base_wage)}/hr + burden ${pct(o.labor_budget.burden_percent)} (${money(o.labor_budget.burden_amount)}/hr)`
        + (o.labor_budget.fringe_per_hour ? ` + fringe ${money(o.labor_budget.fringe_per_hour)}/hr` : '')
        + (o.labor_budget.additional_burden_per_hour ? ` + additional ${money(o.labor_budget.additional_burden_per_hour)}/hr` : '')
        + ` = effective ${money(o.labor_budget.effective_hourly_labor_cost)}/hr`
      : `Base wage: ${money(f.base_wage)}/hr · burden ${pct(f.labor_burden_percent)} · loaded ${money(o.loaded_labor_rate)}/hr`,
    `Labor cost: ${money(o.labor_cost)}`,
    '',
    'DIRECT COST',
    o.supply_cost !== undefined
      ? `Project supplies: ${money(o.supply_cost)}`
      : `Materials / consumables: ${money(o.materials_cost)}`,
    `Equipment / rental: ${money(o.equipment_cost)}`,
    `Total direct cost: ${money(o.total_direct_cost)}`,
    ...o.extras.map(e => `${e.label}: ${e.value}`),
    '',
    'PRICING',
    `Overhead ${pct(f.overhead_percent)}: ${money(o.overhead_amount)}`,
    `Target profit ${pct(f.target_margin_percent)}: ${money(o.profit_amount)}`,
    o.minimum_applied ? `Minimum charge applied (calculated ${money(o.calculated_price)})` : null,
    `Project price: ${money(o.project_price)}`,
    ...(o.day_model ? [
      `Pricing basis: ${o.day_model.price_basis}`,
      `Pricing position: ${o.day_model.pricing_position_label} (suggested ${money(o.day_model.suggested_day_rate)}/day, range ${money(o.day_model.suggested_day_rate_min)}–${money(o.day_model.suggested_day_rate_max)})`,
      `Selected day rate: ${money(o.day_model.proposed_day_rate)}/day · day-rate price ${money(o.day_model.day_rate_project_price)}`,
      `Cost-based target-margin price: ${money(o.day_model.target_margin_price)} · break-even price ${money(o.day_model.breakeven_price)}`,
      `Effective day rate: ${money(o.day_model.effective_day_rate)}/day`,
      `Status: ${o.day_model.status_label}`,
    ] : []),
    `Price per sq ft: $${o.price_per_sqft.toFixed(4)}`,
    `Gross margin: ${pct(o.gross_margin_percent)} (equivalent markup ${pct(o.markup_on_direct_percent)})`,
    o.labor_budget ? `Max labor hours at target margin: ${o.labor_budget.max_hours_at_target_margin.toFixed(2)} hr` : null,
    o.labor_budget ? `Break-even labor hours: ${o.labor_budget.breakeven_hours.toFixed(2)} hr` : null,
    m.notes ? '' : null,
    m.notes ? 'INTERNAL NOTES' : null,
    m.notes || null,
  ].filter(l => l !== null).join('\n');
}