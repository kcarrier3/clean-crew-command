import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { money, hoursFmt, hourlyRateFmt, pct, type EstimateInputs, type EstimateOutputs } from './calc';

export interface SummaryMeta {
  estimateName: string;
  opportunityName: string;
  ownerName: string;
  completedAt?: string | null;
  notes?: string | null;
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <span className={strong ? 'text-sm font-medium' : 'text-sm text-muted-foreground'}>{label}</span>
      <span className={`tabular-nums ${strong ? 'text-base font-semibold' : 'text-sm'}`}>{value}</span>
    </div>
  );
}

const num = (v: number, digits = 2) =>
  (Number.isFinite(v) ? v : 0).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Plain-text summary for pasting figures into the janitorial service agreement. */
export function buildSummaryText(i: EstimateInputs, o: EstimateOutputs, m: SummaryMeta): string {
  return [
    `INTERNAL PRICING SUMMARY`,
    `Opportunity: ${m.opportunityName}`,
    `Estimate: ${m.estimateName}`,
    m.completedAt ? `Completed: ${new Date(m.completedAt).toLocaleDateString()}` : null,
    `Owner: ${m.ownerName}`,
    ``,
    `SCOPE`,
    `Square footage: ${num(i.square_feet, 0)} sq ft`,
    `Frequency: ${num(i.cleanings_per_week, 2)}x/week (${num(i.weeks_per_month, 2)} weeks/month = ${num(o.visits_per_month, 2)} visits/month)`,
    `Production rate: ${num(i.production_rate_sqft_hour, 0)} sq ft/hour`,
    i.minimum_visit_minutes > 0 ? `Minimum visit time: ${num(i.minimum_visit_minutes, 0)} minutes${o.minimum_visit_applied ? ' (applied)' : ''}` : null,
    o.hours_override_applied ? `Labor hours per visit override: ${num(i.labor_hours_per_visit_override)} hr (applied — overrides production rate and minimum visit time)` : null,
    `Hours per visit: ${num(o.labor_hours_per_visit)}`,
    `Monthly hours: ${num(o.monthly_labor_hours)}`,
    `Hourly rate (billable): ${hourlyRateFmt(o.hourly_rate)}`,
    ``,
    `COST`,
    `Base wage: ${money(i.base_wage)}/hr`,
    `Labor burden: ${num(i.labor_burden_percent, 1)}%`,
    `Loaded labor rate: ${money(o.loaded_labor_rate)}/hr`,
    `Loaded labor cost/visit: ${money(o.loaded_labor_cost_per_visit)}`,
    `Monthly loaded labor cost: ${money(o.monthly_labor_cost)}`,
    `Supervision allowance: ${num(i.supervision_percent, 1)}% of base wage labor = ${money(o.monthly_supervision_cost)}/mo`,
    `Supply rate: ${money(i.supply_rate_per_hour)}/productive labor hour`,
    `Monthly supply allowance: ${money(o.monthly_supply_cost)}`,
    `Monthly direct cost: ${money(o.total_direct_cost)}`,
    ``,
    `PRICING`,
    `Overhead: ${num(i.overhead_percent, 1)}% = ${money(o.overhead_amount)}/mo`,
    `Target profit: ${num(i.target_margin_percent, 1)}% (true margin) = ${money(o.profit_amount)}/mo`,
    `Base janitorial monthly price: ${money(o.base_monthly_price)}`,
    `Periodic floor care: ${num(i.periodic_floor_care_percent, 1)}% of base price = ${money(o.periodic_floor_care_amount)}/mo`,
    `Price per visit: ${money(o.price_per_visit)}`,
    `Monthly contract price (incl. periodic floor care): ${money(o.monthly_price)}`,
    `Annual contract value: ${money(o.annual_price)}`,
    `Price per sq ft/month: $${num(o.price_per_sqft, 4)}`,
    `Gross margin over direct cost: ${pct(o.gross_margin_percent)} (equivalent markup ${pct(o.markup_on_direct_percent)} — markup is not margin)`,
    m.notes ? `` : null,
    m.notes ? `INTERNAL NOTES` : null,
    m.notes || null,
  ]
    .filter(l => l !== null)
    .join('\n');
}

export function PricingSummary({ inputs, outputs, meta }: { inputs: EstimateInputs; outputs: EstimateOutputs; meta: SummaryMeta }) {
  return (
    <div className="space-y-3">
      <Card className="border-brand-orange/40">
        <CardContent className="pt-6 text-center">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Monthly contract price</p>
          <p className="text-3xl font-bold text-brand-orange tabular-nums">{money(outputs.monthly_price)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {money(outputs.price_per_visit)}/visit · {money(outputs.annual_price, 0)}/year · ${num(outputs.price_per_sqft, 4)}/sq ft per month
          </p>
          <p className="text-xs text-muted-foreground mt-1">Hourly rate {hourlyRateFmt(outputs.hourly_rate)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Scope</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <Row label="Opportunity" value={meta.opportunityName} />
          <Row label="Estimate" value={meta.estimateName} />
          <Row label="Square footage" value={`${num(inputs.square_feet, 0)} sq ft`} />
          <Row label="Frequency" value={`${num(inputs.cleanings_per_week, 2)}x/week · ${num(outputs.visits_per_month, 2)} visits/mo`} />
          <Row label="Production rate" value={`${num(inputs.production_rate_sqft_hour, 0)} sq ft/hr`} />
          {inputs.minimum_visit_minutes > 0 && (
            <Row label="Minimum visit time" value={`${num(inputs.minimum_visit_minutes, 0)} min${outputs.minimum_visit_applied ? ' (applied)' : ''}`} />
          )}
          {outputs.hours_override_applied && (
            <Row label="Hours/visit override (applied)" value={hoursFmt(inputs.labor_hours_per_visit_override)} strong />
          )}
          <Row label="Hours per visit" value={hoursFmt(outputs.labor_hours_per_visit)} />
          <Row label="Monthly hours" value={hoursFmt(outputs.monthly_labor_hours)} />
          <Row label="Hourly rate" value={hourlyRateFmt(outputs.hourly_rate)} strong />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Direct cost</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <Row label="Base wage" value={`${money(inputs.base_wage)}/hr`} />
          <Row label="Labor burden" value={pct(inputs.labor_burden_percent)} />
          <Row label="Loaded labor rate" value={`${money(outputs.loaded_labor_rate)}/hr`} />
          <Row label="Loaded labor cost/visit" value={money(outputs.loaded_labor_cost_per_visit)} />
          <Row label="Monthly loaded labor" value={money(outputs.monthly_labor_cost)} />
          <Row label={`Supervision allowance (${pct(inputs.supervision_percent)} of base wage labor)`} value={money(outputs.monthly_supervision_cost)} />
          <Row label="Supply rate" value={`${money(inputs.supply_rate_per_hour)}/labor hr`} />
          <Row label="Monthly supply allowance" value={money(outputs.monthly_supply_cost)} />
          <Separator className="my-2" />
          <Row label="Monthly direct cost" value={money(outputs.total_direct_cost)} strong />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Overhead &amp; profit</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <Row label={`Overhead (${pct(inputs.overhead_percent)} of price)`} value={money(outputs.overhead_amount)} />
          <Row label={`Target profit (${pct(inputs.target_margin_percent)} true margin)`} value={money(outputs.profit_amount)} />
          <Separator className="my-2" />
          <Row label="Base janitorial price" value={money(outputs.base_monthly_price)} strong />
          <Row label={`Periodic floor care (${pct(inputs.periodic_floor_care_percent)} of base price)`} value={money(outputs.periodic_floor_care_amount)} />
          <Row label="Final monthly price" value={money(outputs.monthly_price)} strong />
          <Separator className="my-2" />
          <Row label="Gross margin over direct cost" value={pct(outputs.gross_margin_percent)} />
          <Row label="Equivalent markup on direct cost" value={pct(outputs.markup_on_direct_percent)} />
          <p className="text-[11px] text-muted-foreground pt-2">
            Margin is a share of the selling price. Markup is a share of cost. They are not the same number.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Record</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <Row label="Owner" value={meta.ownerName} />
          <Row label="Completed" value={meta.completedAt ? new Date(meta.completedAt).toLocaleString() : '—'} />
          {meta.notes && (
            <>
              <Separator className="my-2" />
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">{meta.notes}</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default PricingSummary;
