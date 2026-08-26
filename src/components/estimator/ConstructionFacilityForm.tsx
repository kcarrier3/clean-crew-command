import { useState } from 'react';
import { Plus, Trash2, Copy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { money, hoursFmt, pct } from './calc';
import { NumField } from './SpecialtyEditor';
import {
  DEFAULT_FACILITY_ROW, FACILITY_TYPES, FACILITY_COMPLEXITY_LEVELS,
  calculateConstruction, constructionLaborRate, facilityRecommendation, guessFacilityType,
  type ConstructionInputs, type FacilityRow, type FacilityComplexity,
} from './specialtyCalc';

type Patch = (p: Record<string, unknown>) => void;

const POSITION_STYLES: Record<string, string> = {
  aggressive: 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  typical: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  conservative: 'border-sky-500/50 bg-sky-500/10 text-sky-700 dark:text-sky-400',
};

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={strong ? 'text-sm font-medium' : 'text-xs text-muted-foreground'}>{label}</span>
      <span className={`tabular-nums ${strong ? 'text-sm font-semibold' : 'text-xs'}`}>{value}</span>
    </div>
  );
}

function FacilityCard({
  row, index, defaults, patch, remove, duplicate, readOnly,
}: {
  row: FacilityRow;
  index: number;
  defaults: { crew: number; hours: number; rate: number };
  patch: (p: Partial<FacilityRow>) => void;
  remove: () => void;
  duplicate: () => void;
  readOnly?: boolean;
}) {
  const rec = facilityRecommendation(row.facility_type, row.complexity);
  const crew = row.crew_size || defaults.crew;
  const hpd = row.hours_per_day || defaults.hours;
  const rate = row.billing_rate_per_hour || defaults.rate;
  const units = Math.max(0, row.units || 0);
  const hours = units * (row.crew_days || 0) * crew * hpd;
  const price = hours * rate;
  const position = row.crew_days < rec.min ? 'aggressive' : row.crew_days > rec.max ? 'conservative'
    : row.crew_days <= rec.min + (rec.max - rec.min) * 0.34 ? 'aggressive'
    : row.crew_days >= rec.min + (rec.max - rec.min) * 0.66 ? 'conservative' : 'typical';
  const sliderMax = Math.max(rec.max * 1.5, row.crew_days + 2, 4);

  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm">Facility {index + 1}</CardTitle>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={readOnly} onClick={duplicate} aria-label="Duplicate facility">
            <Copy className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" disabled={readOnly} onClick={remove} aria-label="Remove facility">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs" htmlFor={`fl-${row.id}`}>Facility / area name</Label>
          <Input
            id={`fl-${row.id}`}
            className="h-11 text-base"
            value={row.label}
            disabled={readOnly}
            placeholder="Youth Cottages, Education Building…"
            onChange={e => {
              const label = e.target.value;
              patch(row.facility_type === 'other' ? { label, facility_type: guessFacilityType(label) } : { label });
            }}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Facility type</Label>
            <Select value={row.facility_type} disabled={readOnly} onValueChange={v => patch({ facility_type: v as FacilityRow['facility_type'] })}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FACILITY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Complexity</Label>
            <ToggleGroup
              type="single"
              className="justify-start"
              value={row.complexity}
              disabled={readOnly}
              onValueChange={v => v && patch({ complexity: v as FacilityComplexity })}
            >
              {FACILITY_COMPLEXITY_LEVELS.map(c => (
                <ToggleGroupItem key={c.value} value={c.value} className="text-xs px-3">{c.label}</ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <NumField id={`fu-${row.id}`} label="Identical units" value={row.units} disabled={readOnly} onChange={v => patch({ units: v })} />
          <NumField id={`fs-${row.id}`} label="Sq ft (optional)" value={row.square_feet} suffix="sq ft" disabled={readOnly} onChange={v => patch({ square_feet: v })} />
          <NumField id={`fc-${row.id}`} label={`Crew size (${defaults.crew})`} value={row.crew_size} disabled={readOnly} onChange={v => patch({ crew_size: v })} />
          <NumField id={`fh-${row.id}`} label={`Hours/day (${defaults.hours})`} value={row.hours_per_day} suffix="hr" disabled={readOnly} onChange={v => patch({ hours_per_day: v })} />
        </div>

        <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3">
          <div className="flex items-center justify-between gap-3">
            <Label className="text-xs">Crew-days per unit</Label>
            <Badge variant="outline" className={`text-[10px] capitalize ${POSITION_STYLES[position]}`}>{position}</Badge>
          </div>
          <Slider
            value={[Math.min(row.crew_days || 0, sliderMax)]}
            min={0.25}
            max={sliderMax}
            step={0.25}
            disabled={readOnly}
            onValueChange={([v]) => patch({ crew_days: v, crew_days_touched: true })}
          />
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step="0.25"
                inputMode="decimal"
                className="h-9 w-24 text-base"
                value={row.crew_days || ''}
                disabled={readOnly}
                onChange={e => patch({ crew_days: parseFloat(e.target.value) || 0, crew_days_touched: true })}
              />
              <span className="text-xs text-muted-foreground">crew-days</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              disabled={readOnly}
              onClick={() => patch({ crew_days: rec.typical, crew_days_touched: true })}
            >
              Use typical ({rec.typical})
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Recommended {rec.min}–{rec.max} crew-days (typical {rec.typical}) · {rec.hint}. Aggressive = fewer days, conservative = more.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <NumField
            id={`fr-${row.id}`}
            label={`Billing rate (default ${defaults.rate ? `$${defaults.rate}` : 'not set'})`}
            value={row.billing_rate_per_hour}
            suffix="$/labor hr"
            disabled={readOnly}
            onChange={v => patch({ billing_rate_per_hour: v })}
          />
          <div className="rounded-md border border-border p-3 space-y-1">
            <Line label="Crew-days" value={`${(units * (row.crew_days || 0)).toFixed(2)}`} />
            <Line label="Labor hours" value={hoursFmt(hours)} />
            <Line label="Facility price" value={money(price)} strong />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs" htmlFor={`fn-${row.id}`}>Notes</Label>
          <Textarea
            id={`fn-${row.id}`}
            rows={2}
            value={row.notes}
            disabled={readOnly}
            onChange={e => patch({ notes: e.target.value })}
          />
        </div>

        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">Actuals (fill in after the job)</summary>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <NumField id={`fad-${row.id}`} label="Actual crew-days" value={row.actual_crew_days || 0} disabled={readOnly} onChange={v => patch({ actual_crew_days: v, actual_recorded_at: new Date().toISOString() })} />
            <NumField id={`fah-${row.id}`} label="Actual labor hours" value={row.actual_labor_hours || 0} suffix="hr" disabled={readOnly} onChange={v => patch({ actual_labor_hours: v, actual_recorded_at: new Date().toISOString() })} />
          </div>
          <p className="text-[11px] text-muted-foreground pt-2">
            Recorded against facility type, complexity, crew size and square-foot band so future estimates can learn from our own completed jobs.
          </p>
        </details>
      </CardContent>
    </Card>
  );
}

export function ConstructionFacilityForm({
  i, patch, readOnly,
}: { i: ConstructionInputs; patch: Patch; readOnly?: boolean }) {
  const [advanced, setAdvanced] = useState(false);
  const rows = i.facilities || [];
  const defaults = {
    crew: i.default_crew_size || 4,
    hours: i.default_hours_per_day || 8,
    rate: i.default_billing_rate_per_hour || 0,
  };
  const o = calculateConstruction(i);
  const fm = o.facility_model;
  const wage = constructionLaborRate(i);
  const prevailing = !!i.prevailing_wage_project || !!i.union_project;
  const combined = i.prevailing_rate_mode === 'combined';

  const setRow = (id: string, p: Partial<FacilityRow>) =>
    patch({ facilities: rows.map(r => (r.id === id ? { ...r, ...p } : r)) });

  return (
    <>
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">1. Project defaults</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <NumField id="dcrew" label="Crew size" value={i.default_crew_size} disabled={readOnly} onChange={v => patch({ default_crew_size: v })} />
            <NumField id="dhrs" label="Hours per crew-day" value={i.default_hours_per_day} suffix="hr" disabled={readOnly} onChange={v => patch({ default_hours_per_day: v })} />
            <NumField id="drate" label="Billing rate" value={i.default_billing_rate_per_hour} suffix="$/labor hr" disabled={readOnly} onChange={v => patch({ default_billing_rate_per_hour: v })} />
          </div>
          <NumField id="tsqft" label="Total building square feet (reference only)" value={i.total_square_feet} suffix="sq ft" disabled={readOnly} onChange={v => patch({ total_square_feet: v })} />
          <p className="text-[11px] text-muted-foreground">
            Price is driven by crew-days × crew size × hours × billing rate. Square footage is stored for reference and future analytics only.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">2. Labor cost assumption</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-start gap-3">
            <Checkbox
              checked={prevailing}
              disabled={readOnly}
              onCheckedChange={c => patch({ prevailing_wage_project: !!c, union_project: !!c })}
            />
            <span>
              <span className="text-sm font-medium">Prevailing wage / union project</span>
              <span className="block text-[11px] text-muted-foreground">
                Affects cost and margin only — it never changes crew-days or hours.
              </span>
            </span>
          </label>

          {prevailing && (
            <>
              <ToggleGroup
                type="single"
                className="justify-start"
                value={combined ? 'combined' : 'split'}
                disabled={readOnly}
                onValueChange={v => v && patch({ prevailing_rate_mode: v })}
              >
                <ToggleGroupItem value="split" className="text-xs px-3">Base + fringe</ToggleGroupItem>
                <ToggleGroupItem value="combined" className="text-xs px-3">Combined package</ToggleGroupItem>
              </ToggleGroup>
              {combined ? (
                <NumField id="pcomb" label="Combined loaded prevailing rate" value={i.prevailing_combined_rate} suffix="$/hr" disabled={readOnly} onChange={v => patch({ prevailing_combined_rate: v })} />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <NumField id="pbase" label="Base wage" value={i.prevailing_base_wage} suffix="$/hr" disabled={readOnly} onChange={v => patch({ prevailing_base_wage: v })} />
                  <NumField id="pfr" label="Fringe" value={i.prevailing_fringe_per_hour} suffix="$/hr" disabled={readOnly} onChange={v => patch({ prevailing_fringe_per_hour: v })} />
                  <NumField id="pex" label="Additional burden" value={i.prevailing_additional_burden_per_hour} suffix="$/hr" disabled={readOnly} onChange={v => patch({ prevailing_additional_burden_per_hour: v })} />
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                Use either the split fields or the combined package — not both. The combined package ignores the base/fringe fields and the burden %.
              </p>
            </>
          )}

          {!prevailing && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <NumField id="bwage" label="Crew wage" value={i.base_wage} suffix="$/hr" disabled={readOnly} onChange={v => patch({ base_wage: v })} />
              <NumField id="bburden" label="Labor burden" value={i.labor_burden_percent} suffix="%" disabled={readOnly} onChange={v => patch({ labor_burden_percent: v })} />
            </div>
          )}

          <div className="rounded-md border border-border bg-muted/40 p-3">
            <Line label="Loaded labor cost" value={`${money(wage.effective)}/hr`} strong />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">3. Facilities &amp; crew-days</h3>
          <Button
            size="sm"
            variant="outline"
            disabled={readOnly}
            onClick={() => patch({
              facilities: [...rows, { ...DEFAULT_FACILITY_ROW(), crew_size: defaults.crew, hours_per_day: defaults.hours, billing_rate_per_hour: defaults.rate }],
            })}
          >
            <Plus className="h-4 w-4 mr-1" /> Add facility
          </Button>
        </div>
        {rows.length === 0 && (
          <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">
            Add each building or area you are cleaning and set its crew-days.
          </CardContent></Card>
        )}
        {rows.map((r, idx) => (
          <FacilityCard
            key={r.id}
            row={r}
            index={idx}
            defaults={defaults}
            readOnly={readOnly}
            patch={p => setRow(r.id, p)}
            remove={() => patch({ facilities: rows.filter(x => x.id !== r.id) })}
            duplicate={() => patch({ facilities: [...rows, { ...r, id: DEFAULT_FACILITY_ROW().id }] })}
          />
        ))}
      </div>

      {fm && (
        <Card className="border-brand-orange/40">
          <CardHeader className="pb-3"><CardTitle className="text-sm">4. Project totals</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            <Line label="Total crew-days" value={fm.total_crew_days.toFixed(2)} />
            <Line label="Total labor hours" value={hoursFmt(fm.total_labor_hours)} />
            <Line label="Effective billing rate" value={`${money(fm.effective_billing_rate)}/labor hr`} />
            <Separator className="my-2" />
            <Line label="Total quoted price" value={money(fm.total_price)} strong />
            <Line label="Estimated direct labor cost" value={money(fm.direct_labor_cost)} />
            {fm.supply_cost > 0 && <Line label="Supplies" value={money(fm.supply_cost)} />}
            {fm.equipment_cost > 0 && <Line label="Equipment" value={money(fm.equipment_cost)} />}
            <Line label="Total direct cost" value={money(fm.total_direct_cost)} />
            <Separator className="my-2" />
            <Line label="Gross spread" value={money(fm.gross_spread)} strong />
            <Line label="Gross spread %" value={pct(fm.gross_spread_percent)} strong />
          </CardContent>
        </Card>
      )}

      <Button variant="outline" size="sm" className="w-full" onClick={() => setAdvanced(a => !a)}>
        {advanced ? 'Hide advanced settings' : 'Advanced settings (supplies, equipment, overhead, margin)'}
      </Button>

      {advanced && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Advanced</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <NumField id="asr" label="Supplies per labor hour" value={i.supply_rate_per_hour} suffix="$/hr" disabled={readOnly} onChange={v => patch({ supply_rate_per_hour: v })} />
              <NumField id="asf" label="Fixed supply cost" value={i.supply_cost_fixed} suffix="$" disabled={readOnly} onChange={v => patch({ supply_cost_fixed: v })} />
              <NumField id="aeq" label="Equipment & rentals" value={i.equipment_cost} suffix="$" disabled={readOnly} onChange={v => patch({ equipment_cost: v })} />
              <NumField id="amin" label="Minimum project charge" value={i.minimum_charge} suffix="$" disabled={readOnly} onChange={v => patch({ minimum_charge: v })} />
              <NumField id="aoh" label="Overhead" value={i.overhead_percent} suffix="%" disabled={readOnly} onChange={v => patch({ overhead_percent: v })} />
              <NumField id="atm" label="Target margin (reference)" value={i.target_margin_percent} suffix="%" disabled={readOnly} onChange={v => patch({ target_margin_percent: v })} />
            </div>
            <Separator />
            <div className="space-y-2">
              <Label className="text-xs">Manual price override</Label>
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={i.price_basis === 'manual'}
                  disabled={readOnly}
                  onCheckedChange={c => patch({ price_basis: c ? 'manual' : 'day_rate' })}
                />
                <span className="text-xs text-muted-foreground">Quote a fixed price instead of hours × rate</span>
              </div>
              {i.price_basis === 'manual' && (
                <NumField id="amp" label="Manual project price" value={i.manual_project_price} suffix="$" disabled={readOnly} onChange={v => patch({ manual_project_price: v })} />
              )}
            </div>
            <Separator />
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              disabled={readOnly}
              onClick={() => patch({ estimating_mode: 'legacy' })}
            >
              Switch to the legacy square-foot production estimator
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  );
}

export default ConstructionFacilityForm;
