/**
 * Shared janitorial hydration + serialization helpers.
 *
 * Every surface that reads or writes a janitorial revision (Estimating list,
 * EstimatingDetail, opportunity-linked estimate cards) must go through this
 * module so defaults, field interpretation and snapshot columns can never
 * disagree between views.
 */
import {
  DEFAULT_INPUTS, SUPPLY_PRESETS, calculateEstimate, supplyRateForPreset,
  type EstimateInputs, type EstimateOutputs, type SupplyPreset,
} from './calc';
import { isRecurringService, normalizeServiceType } from './serviceTypes';

const num = (v: unknown, fallback = 0): number => {
  const x = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(x) ? (x as number) : fallback;
};

/**
 * Normalize the supply preset / rate pair so the UI can never claim a named
 * preset while the effective rate is something else (including 0).
 *
 * Rule: a saved positive rate always wins (it is what the math used); the
 * preset label is derived from it. When no positive rate is stored, the rate
 * is derived from the named preset. `custom` with no rate stays 0.
 */
export function normalizeSupply(
  presetRaw: unknown,
  rateRaw: unknown,
): { supply_preset: SupplyPreset; supply_rate_per_hour: number } {
  const known = SUPPLY_PRESETS.map(p => p.value);
  const preset = (typeof presetRaw === 'string' && [...known, 'custom'].includes(presetRaw)
    ? presetRaw
    : null) as SupplyPreset | null;
  const rate = num(rateRaw, NaN);

  if (Number.isFinite(rate) && rate > 0) {
    const match = SUPPLY_PRESETS.find(p => Math.abs(p.rate - rate) < 1e-9);
    return { supply_preset: match ? match.value : 'custom', supply_rate_per_hour: rate };
  }

  if (preset && preset !== 'custom') {
    return { supply_preset: preset, supply_rate_per_hour: supplyRateForPreset(preset) };
  }
  if (preset === 'custom') return { supply_preset: 'custom', supply_rate_per_hour: 0 };

  // Nothing usable stored — fall back to the module default pair.
  return {
    supply_preset: DEFAULT_INPUTS.supply_preset,
    supply_rate_per_hour: DEFAULT_INPUTS.supply_rate_per_hour,
  };
}

/** Build calculator inputs from a saved `estimate_revisions` row (or partial). */
export function hydrateJanitorialInputs(rev: Record<string, any> | null | undefined): EstimateInputs {
  const r = rev || {};
  return {
    square_feet: num(r.square_feet),
    cleanings_per_week: num(r.cleanings_per_week),
    weeks_per_month: num(r.weeks_per_month) || 4.33,
    production_rate_sqft_hour: num(r.production_rate_sqft_hour) || 3500,
    minimum_visit_minutes: num(r.minimum_visit_minutes),
    labor_hours_per_visit_override: num(r.labor_hours_per_visit_override),
    base_wage: num(r.base_wage),
    labor_burden_percent: num(r.labor_burden_percent),
    supervision_percent: num(r.supervision_percent),
    overhead_percent: num(r.overhead_percent),
    target_margin_percent: num(r.target_margin_percent),
    periodic_floor_care_percent: num(r.periodic_floor_care_percent),
    ...normalizeSupply(r.supply_preset, r.supply_rate_per_hour),
  };
}

/** The complete janitorial output snapshot persisted on every write path. */
export function janitorialOutputColumns(o: EstimateOutputs) {
  return {
    labor_hours_per_visit: o.labor_hours_per_visit,
    monthly_labor_hours: o.monthly_labor_hours,
    loaded_labor_rate: o.loaded_labor_rate,
    monthly_labor_cost: o.monthly_labor_cost,
    monthly_supply_cost: o.monthly_supply_cost,
    total_direct_cost: o.total_direct_cost,
    overhead_amount: o.overhead_amount,
    supervision_amount: o.monthly_supervision_cost,
    base_monthly_price: o.base_monthly_price,
    periodic_floor_care_amount: o.periodic_floor_care_amount,
    price_per_visit: o.price_per_visit,
    monthly_price: o.monthly_price,
    annual_price: o.annual_price,
    price_per_sqft: o.price_per_sqft,
    gross_margin_percent: o.gross_margin_percent,
    markup_percent: o.markup_on_direct_percent,
  };
}

/** Inputs + complete output snapshot — the single janitorial revision payload. */
export function janitorialRevisionPayload(inputs: EstimateInputs) {
  return { ...inputs, ...janitorialOutputColumns(calculateEstimate(inputs)) };
}

/** Columns any list view must select so it can recompute janitorial pricing. */
export const REVISION_LIST_COLUMNS = [
  'id', 'service_type', 'monthly_price', 'project_price',
  'square_feet', 'cleanings_per_week', 'weeks_per_month', 'production_rate_sqft_hour',
  'minimum_visit_minutes', 'labor_hours_per_visit_override', 'base_wage',
  'labor_burden_percent', 'supervision_percent', 'supply_preset', 'supply_rate_per_hour',
  'overhead_percent', 'target_margin_percent', 'periodic_floor_care_percent',
].join(',');

/**
 * Headline price for a revision row, using the same calculator the detail page
 * uses for janitorial. Specialty/project work keeps its stored project price.
 */
export function revisionDisplayPrice(rev: Record<string, any> | null | undefined): number {
  if (!rev) return 0;
  const service = normalizeServiceType(rev.service_type);
  if (!isRecurringService(service)) return num(rev.project_price);
  return calculateEstimate(hydrateJanitorialInputs(rev)).monthly_price;
}

/** Difference between the stored snapshot and a freshly computed monthly price. */
export function monthlyPriceDrift(rev: Record<string, any> | null | undefined, computed: number) {
  const stored = num(rev?.monthly_price);
  const diff = computed - stored;
  return { stored, computed, diff, drifted: Math.abs(diff) > 0.01 };
}
