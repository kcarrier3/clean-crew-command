import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { hours, money, pct, type EstimateInputs, type EstimateOutputs } from './calc';

const Row = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
  <div className="flex items-baseline justify-between gap-3 py-1">
    <span className={strong ? 'text-sm font-medium' : 'text-sm text-muted-foreground'}>{label}</span>
    <span className={strong ? 'text-sm font-semibold tabular-nums' : 'text-sm tabular-nums'}>{value}</span>
  </div>
);

export function ResultsPanel({ inputs, out }: { inputs: EstimateInputs; out: EstimateOutputs }) {
  return (
    <div className="space-y-4">
      <Card className="border-[hsl(var(--brand-orange))]/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground font-medium">Price</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="text-3xl font-bold text-[hsl(var(--brand-orange))] tabular-nums">
            {money(out.monthly_price)}
            <span className="text-sm font-normal text-muted-foreground"> / month</span>
          </div>
          <Row label="Price per visit" value={money(out.price_per_visit)} />
          <Row label="Annual price" value={money(out.annual_price)} />
          <Row label="Price per sq ft (monthly)" value={money(out.price_per_sqft, 4)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground font-medium">Production</CardTitle>
        </CardHeader>
        <CardContent>
          <Row label="Visits per month" value={out.visits_per_month.toFixed(2)} />
          <Row label="Cleaning hours / visit" value={hours(out.cleaning_hours_per_visit)} />
          <Row label="Restroom hours / visit" value={hours(out.restroom_hours_per_visit)} />
          <Row label="Labor hours / visit" value={hours(out.labor_hours_per_visit)} strong />
          <Row label="Adder hours / month" value={hours(out.monthly_adder_hours)} />
          <Row label="Monthly labor hours" value={hours(out.monthly_labor_hours)} strong />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground font-medium">Monthly cost</CardTitle>
        </CardHeader>
        <CardContent>
          <Row
            label={`Loaded labor rate (${money(inputs.base_wage)} + ${pct(inputs.labor_burden_percent)} burden)`}
            value={`${money(out.loaded_labor_rate)}/hr`}
          />
          <Row label="Loaded labor cost" value={money(out.monthly_labor_cost)} />
          <Row
            label={`Cleaning supplies (${money(inputs.supply_rate_per_hour)}/hr)`}
            value={money(out.monthly_supply_cost)}
          />
          <Row label="Total direct cost" value={money(out.total_direct_cost)} strong />
          <Row label={`Overhead (${pct(inputs.overhead_percent)})`} value={money(out.overhead_amount)} />
          <Row label="Cost basis (direct + overhead)" value={money(out.cost_basis)} strong />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground font-medium">Profit</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Row label="Monthly profit" value={money(out.monthly_profit)} strong />
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="rounded-md border border-border p-3">
              <div className="text-xs text-muted-foreground">True margin</div>
              <div className="text-lg font-semibold tabular-nums">{pct(out.gross_margin_percent)}</div>
              <div className="text-[10px] text-muted-foreground mt-1">profit ÷ price</div>
            </div>
            <div className="rounded-md border border-border p-3">
              <div className="text-xs text-muted-foreground">Markup</div>
              <div className="text-lg font-semibold tabular-nums">{pct(out.markup_percent)}</div>
              <div className="text-[10px] text-muted-foreground mt-1">profit ÷ cost</div>
            </div>
          </div>
          <Badge variant="secondary" className="mt-1">
            Priced by {inputs.pricing_mode === 'margin' ? 'target margin' : 'markup'}
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}

export default ResultsPanel;