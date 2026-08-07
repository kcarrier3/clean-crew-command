/**
 * Janitorial Sales Estimator — pure calculation engine (MVP).
 *
 * Every formula lives here so it is explicit and testable, and so the database
 * only ever stores snapshotted numbers (never generated columns).
 */

export type SupplyPreset = 'low' | 'standard' | 'high' | 'custom';

export const SUPPLY_PRESETS: { value: Exclude<SupplyPreset, 'custom'>; label: string; rate: number }[] = [
  { value: 'low', label: 'Low', rate: 0.4 },
  { value: 'standard', label: 'Standard', rate: 0.55 },
  { value: 'high', label: 'High', rate: 0.85 },
];

export const DEFAULT_INPUTS: EstimateInputs = {
  square_feet: 0,
  cleanings_per_week: 5,
  weeks_per_month: 4.33,
  production_rate_sqft_hour: 3500,
  minimum_visit_minutes: 0,
  base_wage: 15,
  labor_burden_percent: 20,
  supervision_percent: 0,
  supply_preset: 'standard',
  supply_rate_per_hour: 0.55,
  overhead_percent: 15,
  target_margin_percent: 25,
  periodic_floor_care_percent: 0,
};

export interface EstimateInputs {
  square_feet: number;
  cleanings_per_week: number;
  weeks_per_month: number;
  production_rate_sqft_hour: number;
  /** Minimum billable time on site per visit. Hours/visit never drops below this. */
  minimum_visit_minutes: number;
  base_wage: number;
  labor_burden_percent: number;
  /** Supervision allowance as a % of BASE direct wage labor (a cost, not a price margin). */
  supervision_percent: number;
  supply_preset: SupplyPreset;
  supply_rate_per_hour: number;
  overhead_percent: number;
  target_margin_percent: number;
  /** Periodic floor-care allowance as a % of the base janitorial selling price. */
  periodic_floor_care_percent: number;
}

export interface EstimateOutputs {
  visits_per_month: number;
  labor_hours_per_visit: number;
  /** True when the minimum visit time drove hours/visit instead of the production rate. */
  minimum_visit_applied: boolean;
  monthly_labor_hours: number;
  loaded_labor_rate: number;
  loaded_labor_cost_per_visit: number;
  monthly_labor_cost: number;
  /** Base (unburdened) wage labor per month — the basis for the supervision allowance. */
  monthly_base_wage_cost: number;
  monthly_supervision_cost: number;
  supply_cost_per_visit: number;
  monthly_supply_cost: number;
  direct_cost_per_visit: number;
  total_direct_cost: number;
  /** Selling price of the routine janitorial scope, before periodic floor care. */
  base_monthly_price: number;
  periodic_floor_care_amount: number;
  /** Final monthly price = base janitorial price + periodic floor care. */
  monthly_price: number;
  price_per_visit: number;
  annual_price: number;
  price_per_sqft: number;
  overhead_amount: number;
  profit_amount: number;
  /** Target profit as a true margin of the selling price. */
  profit_margin_percent: number;
  /** (price - direct cost) / price — gross margin over direct cost. */
  gross_margin_percent: number;
  /** (price - direct cost) / direct cost — the equivalent markup, not the margin. */
  markup_on_direct_percent: number;
  /** True when overhead % + target profit % >= 100 and pricing cannot be solved. */
  invalid: boolean;
}

const n = (v: unknown, fallback = 0): number => {
  const x = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(x) ? (x as number) : fallback;
};

const safe = (v: number): number => (Number.isFinite(v) ? v : 0);

export function supplyRateForPreset(preset: SupplyPreset, custom = 0): number {
  const found = SUPPLY_PRESETS.find(p => p.value === preset);
  return found ? found.rate : Math.max(0, n(custom));
}

/** Overhead + target profit must leave room in the selling price. */
export function isPricingSolvable(overheadPercent: number, targetMarginPercent: number): boolean {
  return Math.max(0, n(overheadPercent)) + Math.max(0, n(targetMarginPercent)) < 100;
}

export function calculateEstimate(i: EstimateInputs): EstimateOutputs {
  const sqft = Math.max(0, n(i.square_feet));
  const rate = Math.max(0, n(i.production_rate_sqft_hour));
  const perWeek = Math.max(0, n(i.cleanings_per_week));
  const weeks = Math.max(0, n(i.weeks_per_month));
  const overheadPct = Math.max(0, n(i.overhead_percent));
  const profitPct = Math.max(0, n(i.target_margin_percent));

  const visitsPerMonth = perWeek * weeks;

  // Production
  const producedHoursPerVisit = rate > 0 ? sqft / rate : 0;
  const minHoursPerVisit = Math.max(0, n(i.minimum_visit_minutes)) / 60;
  const laborHoursPerVisit = Math.max(producedHoursPerVisit, minHoursPerVisit);
  const monthlyLaborHours = laborHoursPerVisit * visitsPerMonth;

  // Labor
  const baseWage = Math.max(0, n(i.base_wage));
  const loadedLaborRate = baseWage * (1 + Math.max(0, n(i.labor_burden_percent)) / 100);
  const loadedLaborCostPerVisit = laborHoursPerVisit * loadedLaborRate;
  const monthlyLaborCost = monthlyLaborHours * loadedLaborRate;

  // Supervision allowance — a direct cost expressed as a % of base (unburdened) wage labor.
  const monthlyBaseWageCost = monthlyLaborHours * baseWage;
  const supervisionPct = Math.max(0, n(i.supervision_percent));
  const monthlySupervisionCost = monthlyBaseWageCost * (supervisionPct / 100);

  // Consumable cleaning supplies: direct cost per productive labor hour
  // (excludes vacuums, machines and other fixed assets).
  const supplyRate = Math.max(0, n(i.supply_rate_per_hour));
  const supplyCostPerVisit = laborHoursPerVisit * supplyRate;
  const monthlySupplyCost = monthlyLaborHours * supplyRate;

  // Direct cost
  const totalDirectCost = monthlyLaborCost + monthlySupervisionCost + monthlySupplyCost;
  const directCostPerVisit = visitsPerMonth > 0
    ? totalDirectCost / visitsPerMonth
    : loadedLaborCostPerVisit + supplyCostPerVisit;

  // Price — true-margin cost-plus: price = direct cost / (1 - overhead% - profit%)
  const solvable = isPricingSolvable(overheadPct, profitPct);
  const divisor = 1 - overheadPct / 100 - profitPct / 100;
  const baseMonthlyPrice = solvable && divisor > 0 ? totalDirectCost / divisor : 0;

  // Periodic floor care is a % of the base janitorial selling price, broken out separately.
  const floorCarePct = Math.max(0, n(i.periodic_floor_care_percent));
  const floorCareAmount = baseMonthlyPrice * (floorCarePct / 100);
  const monthlyPrice = baseMonthlyPrice + floorCareAmount;

  const overheadAmount = baseMonthlyPrice * (overheadPct / 100);
  const profitAmount = baseMonthlyPrice * (profitPct / 100);
  const grossMargin = monthlyPrice > 0 ? ((monthlyPrice - totalDirectCost) / monthlyPrice) * 100 : 0;
  const markupOnDirect = totalDirectCost > 0 ? ((monthlyPrice - totalDirectCost) / totalDirectCost) * 100 : 0;

  return {
    visits_per_month: safe(visitsPerMonth),
    labor_hours_per_visit: safe(laborHoursPerVisit),
    minimum_visit_applied: minHoursPerVisit > producedHoursPerVisit,
    monthly_labor_hours: safe(monthlyLaborHours),
    loaded_labor_rate: safe(loadedLaborRate),
    loaded_labor_cost_per_visit: safe(loadedLaborCostPerVisit),
    monthly_labor_cost: safe(monthlyLaborCost),
    monthly_base_wage_cost: safe(monthlyBaseWageCost),
    monthly_supervision_cost: safe(monthlySupervisionCost),
    supply_cost_per_visit: safe(supplyCostPerVisit),
    monthly_supply_cost: safe(monthlySupplyCost),
    direct_cost_per_visit: safe(directCostPerVisit),
    total_direct_cost: safe(totalDirectCost),
    base_monthly_price: safe(baseMonthlyPrice),
    periodic_floor_care_amount: safe(floorCareAmount),
    monthly_price: safe(monthlyPrice),
    price_per_visit: safe(visitsPerMonth > 0 ? monthlyPrice / visitsPerMonth : 0),
    annual_price: safe(monthlyPrice * 12),
    price_per_sqft: safe(sqft > 0 ? monthlyPrice / sqft : 0),
    overhead_amount: safe(overheadAmount),
    profit_amount: safe(profitAmount),
    profit_margin_percent: safe(profitPct),
    gross_margin_percent: safe(grossMargin),
    markup_on_direct_percent: safe(markupOnDirect),
    invalid: !solvable,
  };
}

export const money = (v: number, digits = 2) =>
  `$${(Number.isFinite(v) ? v : 0).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;

export const hoursFmt = (v: number) => `${(Number.isFinite(v) ? v : 0).toFixed(2)} hr`;

export const pct = (v: number) => `${(Number.isFinite(v) ? v : 0).toFixed(1)}%`;

export const ESTIMATE_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  completed: 'Completed',
};
