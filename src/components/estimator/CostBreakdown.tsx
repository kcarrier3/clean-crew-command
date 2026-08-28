import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Wallet, Receipt } from 'lucide-react';
import { money, pct, type EstimateInputs, type EstimateOutputs } from './calc';
import type { SpecialtyInputs, SpecialtyOutputs } from './specialtyCalc';
import { SERVICE_LABELS, type ServiceType } from './serviceTypes';

export interface BreakdownLine {
  label: string;
  amount: number;
  detail?: string;
}

export interface CostBreakdownModel {
  /** e.g. "per month" or "for this project" */
  periodLabel: string;
  costLines: BreakdownLine[];
  totalCost: number;
  customerLines: BreakdownLine[];
  totalPrice: number;
  profit: number;
  overhead: number;
  marginPercent: number;
  footnote?: string;
}

const safe = (v: unknown) => (Number.isFinite(v as number) ? (v as number) : 0);

/** Cost-to-run and cost-to-customer for a monthly janitorial contract. */
export function buildJanitorialBreakdown(i: EstimateInputs, o: EstimateOutputs): CostBreakdownModel {
  const costLines: BreakdownLine[] = [
    {
      label: 'Cleaning labor (loaded wages)',
      amount: safe(o.monthly_labor_cost),
      detail: `${o.monthly_labor_hours.toFixed(2)} hr/mo @ ${money(o.loaded_labor_rate)}/hr (${money(i.base_wage)}/hr wage + ${pct(i.labor_burden_percent)} burden)`,
    },
  ];
  if (o.monthly_supervision_cost > 0) {
    costLines.push({
      label: 'Supervision',
      amount: safe(o.monthly_supervision_cost),
      detail: `${pct(i.supervision_percent)} of base wage labor`,
    });
  }
  costLines.push({
    label: 'Cleaning supplies & consumables',
    amount: safe(o.monthly_supply_cost),
    detail: `${money(i.supply_rate_per_hour)} per productive labor hour`,
  });

  const customerLines: BreakdownLine[] = [
    {
      label: 'Routine janitorial service',
      amount: safe(o.base_monthly_price),
      detail: `${i.cleanings_per_week}x/week · ${o.visits_per_month.toFixed(2)} visits/mo · ${money(o.price_per_visit)} per visit`,
    },
  ];
  if (o.periodic_floor_care_amount > 0) {
    customerLines.push({
      label: 'Periodic floor care',
      amount: safe(o.periodic_floor_care_amount),
      detail: `${pct(i.periodic_floor_care_percent)} of the base janitorial price`,
    });
  }

  return {
    periodLabel: 'per month',
    costLines,
    totalCost: safe(o.total_direct_cost),
    customerLines,
    totalPrice: safe(o.monthly_price),
    profit: safe(o.profit_amount),
    overhead: safe(o.overhead_amount),
    marginPercent: safe(o.gross_margin_percent),
    footnote: `Annual contract value ${money(o.annual_price, 0)}.`,
  };
}

/** Cost-to-run and cost-to-customer for a one-time / project specialty estimate. */
export function buildSpecialtyBreakdown(
  service: ServiceType,
  i: SpecialtyInputs,
  o: SpecialtyOutputs
): CostBreakdownModel {
  const supplyCost = safe((o as any).supply_cost);
  const costLines: BreakdownLine[] = [];

  for (const l of o.lines) {
    if (!l.cost && !l.hours) continue;
    costLines.push({
      label: `${l.label} — labor`,
      amount: safe(l.cost),
      detail: [l.hours ? `${l.hours.toFixed(2)} hr @ ${money(o.loaded_labor_rate)}/hr` : null, l.detail]
        .filter(Boolean)
        .join(' · '),
    });
  }
  if (costLines.length === 0 && o.labor_cost > 0) {
    costLines.push({
      label: 'Labor',
      amount: safe(o.labor_cost),
      detail: `${o.labor_hours.toFixed(2)} hr @ ${money(o.loaded_labor_rate)}/hr`,
    });
  }
  if (supplyCost > 0) costLines.push({ label: 'Project cleaning supplies', amount: supplyCost });
  if (o.materials_cost > 0) costLines.push({ label: 'Materials & chemicals', amount: safe(o.materials_cost) });
  if (o.equipment_cost > 0) costLines.push({ label: 'Equipment & rentals', amount: safe(o.equipment_cost) });

  // Distribute the customer price across scope items in proportion to their cost.
  const totalCost = safe(o.total_direct_cost);
  const price = safe(o.project_price);
  const factor = totalCost > 0 ? price / totalCost : 0;
  const serviceLabel = SERVICE_LABELS[service] || 'Service';

  const laborLines = o.lines.filter(l => l.cost > 0);
  const customerLines: BreakdownLine[] = [];
  const nonLabor = supplyCost + safe(o.materials_cost) + safe(o.equipment_cost);
  const laborTotal = laborLines.reduce((s, l) => s + l.cost, 0);
  // Facility crew-day rows carry their own quoted price. Those prices only foot
  // to the quoted project price when there is no manual override or minimum
  // charge, so scale them to the actual price instead of dumping the whole
  // difference onto the final line.
  const usePriced = laborLines.length > 0 && laborLines.every(l => typeof l.price === 'number' && l.price > 0);
  const pricedTotal = usePriced ? laborLines.reduce((s, l) => s + safe(l.price), 0) : 0;
  const priceScale = usePriced && pricedTotal > 0 ? price / pricedTotal : 0;
  if ((priceScale > 0 || factor > 0) && laborLines.length > 0) {
    for (const l of laborLines) {
      // Bake supplies, materials and equipment into each scope item,
      // allocated in proportion to that item's share of labor.
      const share = laborTotal > 0 ? l.cost / laborTotal : 1 / laborLines.length;
      const allocatedCost = l.cost + nonLabor * share;
      customerLines.push({
        label: `${serviceLabel} — ${l.label}`,
        amount: safe(priceScale > 0 ? safe(l.price) * priceScale : allocatedCost * factor),
        detail: [
          l.hours ? `${l.hours.toFixed(2)} labor hr` : null,
          nonLabor > 0 ? `includes ${money(nonLabor * share)} supplies, materials & equipment` : null,
        ]
          .filter(Boolean)
          .join(' · ') || undefined,
      });
    }
  } else {
    customerLines.push({ label: serviceLabel, amount: price });
  }


  // Rounding guard so the customer lines always foot to the quoted price.
  const sum = customerLines.reduce((s, l) => s + l.amount, 0);
  if (customerLines.length > 0 && Math.abs(sum - price) > 0.005) {
    customerLines[customerLines.length - 1].amount += price - sum;
  }

  return {
    periodLabel: 'for this project',
    costLines,
    totalCost,
    customerLines,
    totalPrice: price,
    profit: safe(o.profit_amount),
    overhead: safe(o.overhead_amount),
    marginPercent: safe(o.gross_margin_percent),
    footnote:
      factor > 0 && laborLines.length > 0
        ? 'Supplies, materials, equipment, overhead and profit are baked into each scope item in proportion to its labor.'
        : undefined,
  };
}

function BreakdownRow({ line, tone }: { line: BreakdownLine; tone: 'cost' | 'price' }) {
  return (
    <div className="py-1">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-sm">{line.label}</span>
        <span className={`text-sm tabular-nums font-medium ${tone === 'price' ? 'text-brand-orange' : ''}`}>
          {money(line.amount)}
        </span>
      </div>
      {line.detail && <p className="text-[11px] text-muted-foreground">{line.detail}</p>}
    </div>
  );
}

/** Two clearly labeled blocks: what the job costs us, and what the customer pays. */
export function CostBreakdown({ model }: { model: CostBreakdownModel }) {
  return (
    <div className="space-y-3">
      <Card className="border-2 border-muted-foreground/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 uppercase tracking-wide">
            <Wallet className="h-4 w-4" /> Cost to run project
          </CardTitle>
          <p className="text-[11px] text-muted-foreground">
            Internal only — every direct cost we incur {model.periodLabel}.
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          {model.costLines.map((l, idx) => <BreakdownRow key={idx} line={l} tone="cost" />)}
          <Separator className="my-2" />
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-sm font-semibold">Total cost to run {model.periodLabel}</span>
            <span className="text-base font-bold tabular-nums">{money(model.totalCost)}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-brand-orange/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 uppercase tracking-wide text-brand-orange">
            <Receipt className="h-4 w-4" /> Cost to customer
          </CardTitle>
          <p className="text-[11px] text-muted-foreground">
            What we bill {model.periodLabel}, by service. Includes overhead and profit.
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          {model.customerLines.map((l, idx) => <BreakdownRow key={idx} line={l} tone="price" />)}
          <Separator className="my-2" />
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-sm font-semibold">Total price to customer {model.periodLabel}</span>
            <span className="text-lg font-bold tabular-nums text-brand-orange">{money(model.totalPrice)}</span>
          </div>
          <Separator className="my-2" />
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">Overhead</p>
              <p className="text-sm font-semibold tabular-nums">{money(model.overhead)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">Profit</p>
              <p className="text-sm font-semibold tabular-nums">{money(model.profit)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">Gross margin</p>
              <p className="text-sm font-semibold tabular-nums">{pct(model.marginPercent)}</p>
            </div>
          </div>
          {model.footnote && <p className="text-[11px] text-muted-foreground pt-2">{model.footnote}</p>}
        </CardContent>
      </Card>
    </div>
  );
}

/** Plain-text version for the copyable pricing summary. */
export function breakdownText(m: CostBreakdownModel): string {
  return [
    ``,
    `COST TO RUN PROJECT (${m.periodLabel})`,
    ...m.costLines.map(l => `  ${l.label}: ${money(l.amount)}${l.detail ? ` (${l.detail})` : ''}`),
    `  TOTAL COST TO RUN: ${money(m.totalCost)}`,
    ``,
    `COST TO CUSTOMER (${m.periodLabel})`,
    ...m.customerLines.map(l => `  ${l.label}: ${money(l.amount)}${l.detail ? ` (${l.detail})` : ''}`),
    `  TOTAL PRICE TO CUSTOMER: ${money(m.totalPrice)}`,
    `  Overhead ${money(m.overhead)} · Profit ${money(m.profit)} · Gross margin ${pct(m.marginPercent)}`,
    m.footnote ? `  ${m.footnote}` : null,
  ]
    .filter(l => l !== null)
    .join('\n');
}

export default CostBreakdown;