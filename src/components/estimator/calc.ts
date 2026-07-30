/**
 * Janitorial Sales Estimator — pure calculation engine.
 *
 * All math lives here so it is unit-testable and so the database only ever
 * stores snapshotted results (never computed/generated columns).
 */

export type SupplyPreset = 'low' | 'standard' | 'high' | 'custom';
export type PricingMode = 'markup' | 'margin';
export type ServiceWindow = 'day' | 'night';
export type TrafficLevel = 'light' | 'medium' | 'heavy';

export interface EstimatorDefaults {
  base_wage: number;
  labor_burden_percent: number;
  supply_low: number;
  supply_standard: number;
  supply_high: number;
  default_production_rate: number;
  weeks_per_month: number;
  default_overhead_percent: number;
  default_target_margin_percent: number;
}

export const FALLBACK_DEFAULTS: EstimatorDefaults = {
  base_wage: 15.0,
  labor_burden_percent: 20,
  supply_low: 0.4,
  supply_standard: 0.55,
  supply_high: 0.85,
  default_production_rate: 3500,
  weeks_per_month: 4.33,
  default_overhead_percent: 15,
  default_target_margin_percent: 25,
};

export interface EstimateInputs {
  square_feet: number;
  building_type: string | null;
  cleanings_per_week: number;
  weeks_per_month: number;
  production_rate_sqft_hour: number;
  restroom_count: number;
  fixture_count: number;
  /** percentages that should sum to ~100 */
  floor_mix: { carpet?: number; hard?: number; tile?: number };
  occupancy_level: string | null;
  traffic_level: TrafficLevel | null;
  service_window: ServiceWindow;
  day_porter_hours_per_week: number;
  windows_hours_per_month: number;
  periodic_floor_care: { hours_per_month?: number };
  base_wage: number;
  labor_burden_percent: number;
  supply_rate_per_hour: number;
  supply_preset: SupplyPreset;
  overhead_percent: number;
  target_margin_percent: number;
  pricing_mode: PricingMode;
}

export interface EstimateOutputs {
  visits_per_month: number;
  cleaning_hours_per_visit: number;
  restroom_hours_per_visit: number;
  labor_hours_per_visit: number;
  monthly_cleaning_hours: number;
  monthly_adder_hours: number;
  monthly_labor_hours: number;
  loaded_labor_rate: number;
  monthly_labor_cost: number;
  monthly_supply_cost: number;
  total_direct_cost: number;
  overhead_amount: number;
  cost_basis: number;
  price_per_visit: number;
  monthly_price: number;
  annual_price: number;
  price_per_sqft: number;
  monthly_profit: number;
  gross_margin_percent: number;
  markup_percent: number;
}

/** Traffic / occupancy difficulty multiplier applied to cleaning hours. */
export const TRAFFIC_MULTIPLIERS: Record<TrafficLevel, number> = {
  light: 0.95,
  medium: 1.0,
  heavy: 1.1,
};

/** Daytime service is slower — occupants, interruptions, extra touchpoints. */
export const DAY_SERVICE_MULTIPLIER = 1.1;

/** Carpet is faster than hard floor to maintain nightly; small nudge only. */
export const FLOOR_MIX_HARD_PENALTY = 0.08;

/** Minutes of cleaning time per restroom fixture. */
export const MINUTES_PER_FIXTURE = 3;
/** Fallback minutes per restroom when fixture count is unknown. */
export const MINUTES_PER_RESTROOM = 15;

const n = (v: unknown, fallback = 0) => {
  const x = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(x) ? (x as number) : fallback;
};

export function supplyRateForPreset(preset: SupplyPreset, d: EstimatorDefaults, custom = 0): number {
  switch (preset) {
    case 'low':
      return n(d.supply_low, FALLBACK_DEFAULTS.supply_low);
    case 'high':
      return n(d.supply_high, FALLBACK_DEFAULTS.supply_high);
    case 'custom':
      return n(custom);
    default:
      return n(d.supply_standard, FALLBACK_DEFAULTS.supply_standard);
  }
}

export function makeDefaultInputs(d: EstimatorDefaults): EstimateInputs {
  return {
    square_feet: 0,
    building_type: 'General',
    cleanings_per_week: 5,
    weeks_per_month: n(d.weeks_per_month, 4.33),
    production_rate_sqft_hour: n(d.default_production_rate, 3500),
    restroom_count: 0,
    fixture_count: 0,
    floor_mix: { carpet: 100, hard: 0, tile: 0 },
    occupancy_level: 'medium',
    traffic_level: 'medium',
    service_window: 'night',
    day_porter_hours_per_week: 0,
    windows_hours_per_month: 0,
    periodic_floor_care: { hours_per_month: 0 },
    base_wage: n(d.base_wage, 15),
    labor_burden_percent: n(d.labor_burden_percent, 20),
    supply_rate_per_hour: n(d.supply_standard, 0.55),
    supply_preset: 'standard',
    overhead_percent: n(d.default_overhead_percent, 15),
    target_margin_percent: n(d.default_target_margin_percent, 25),
    pricing_mode: 'margin',
  };
}

export function calculateEstimate(i: EstimateInputs): EstimateOutputs {
  const sqft = Math.max(0, n(i.square_feet));
  const rate = Math.max(1, n(i.production_rate_sqft_hour, 3500));
  const perWeek = Math.max(0, n(i.cleanings_per_week));
  const weeks = Math.max(0, n(i.weeks_per_month, 4.33));
  const visitsPerMonth = perWeek * weeks;

  // --- Production: square footage -> cleaning hours per visit
  const baseCleaningHours = sqft / rate;

  // Hard floor is slower to maintain than carpet.
  const hardPct = Math.min(100, Math.max(0, n(i.floor_mix?.hard) + n(i.floor_mix?.tile)));
  const floorFactor = 1 + (hardPct / 100) * FLOOR_MIX_HARD_PENALTY;

  const traffic = TRAFFIC_MULTIPLIERS[(i.traffic_level as TrafficLevel) || 'medium'] ?? 1;
  const dayFactor = i.service_window === 'day' ? DAY_SERVICE_MULTIPLIER : 1;

  const cleaningHoursPerVisit = baseCleaningHours * floorFactor * traffic * dayFactor;

  // --- Restrooms are estimated by fixture, not square footage
  const fixtures = Math.max(0, n(i.fixture_count));
  const restrooms = Math.max(0, n(i.restroom_count));
  const restroomHoursPerVisit =
    fixtures > 0
      ? (fixtures * MINUTES_PER_FIXTURE) / 60
      : (restrooms * MINUTES_PER_RESTROOM) / 60;

  const laborHoursPerVisit = cleaningHoursPerVisit + restroomHoursPerVisit;
  const monthlyCleaningHours = laborHoursPerVisit * visitsPerMonth;

  // --- Adders (day porter, windows, periodic floor care)
  const monthlyAdderHours =
    Math.max(0, n(i.day_porter_hours_per_week)) * weeks +
    Math.max(0, n(i.windows_hours_per_month)) +
    Math.max(0, n(i.periodic_floor_care?.hours_per_month));

  const monthlyLaborHours = monthlyCleaningHours + monthlyAdderHours;

  // --- Cost
  const loadedLaborRate = n(i.base_wage, 15) * (1 + n(i.labor_burden_percent, 20) / 100);
  const monthlyLaborCost = monthlyLaborHours * loadedLaborRate;
  // Consumable cleaning supplies are a direct cost per productive labor hour
  // (excludes vacuums, machines and other fixed assets).
  const monthlySupplyCost = monthlyLaborHours * Math.max(0, n(i.supply_rate_per_hour));
  const totalDirectCost = monthlyLaborCost + monthlySupplyCost;

  const overheadAmount = totalDirectCost * (Math.max(0, n(i.overhead_percent)) / 100);
  const costBasis = totalDirectCost + overheadAmount;

  // --- Price
  const target = Math.max(0, n(i.target_margin_percent));
  let monthlyPrice: number;
  if (i.pricing_mode === 'markup') {
    monthlyPrice = costBasis * (1 + target / 100);
  } else {
    const safeMargin = Math.min(target, 95); // guard against divide-by-zero
    monthlyPrice = safeMargin >= 100 ? costBasis : costBasis / (1 - safeMargin / 100);
  }

  const monthlyProfit = monthlyPrice - costBasis;
  const grossMarginPercent = monthlyPrice > 0 ? (monthlyProfit / monthlyPrice) * 100 : 0;
  const markupPercent = costBasis > 0 ? (monthlyProfit / costBasis) * 100 : 0;

  return {
    visits_per_month: visitsPerMonth,
    cleaning_hours_per_visit: cleaningHoursPerVisit,
    restroom_hours_per_visit: restroomHoursPerVisit,
    labor_hours_per_visit: laborHoursPerVisit,
    monthly_cleaning_hours: monthlyCleaningHours,
    monthly_adder_hours: monthlyAdderHours,
    monthly_labor_hours: monthlyLaborHours,
    loaded_labor_rate: loadedLaborRate,
    monthly_labor_cost: monthlyLaborCost,
    monthly_supply_cost: monthlySupplyCost,
    total_direct_cost: totalDirectCost,
    overhead_amount: overheadAmount,
    cost_basis: costBasis,
    price_per_visit: visitsPerMonth > 0 ? monthlyPrice / visitsPerMonth : 0,
    monthly_price: monthlyPrice,
    annual_price: monthlyPrice * 12,
    price_per_sqft: sqft > 0 ? monthlyPrice / sqft : 0,
    monthly_profit: monthlyProfit,
    gross_margin_percent: grossMarginPercent,
    markup_percent: markupPercent,
  };
}

export const money = (v: number, digits = 2) =>
  `$${(Number.isFinite(v) ? v : 0).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;

export const hours = (v: number) => `${(Number.isFinite(v) ? v : 0).toFixed(2)} hr`;

export const pct = (v: number) => `${(Number.isFinite(v) ? v : 0).toFixed(1)}%`;

export const ESTIMATE_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending_approval: 'Pending approval',
  approved: 'Approved',
  rejected: 'Rejected',
  sent: 'Sent',
  won: 'Won',
  lost: 'Lost',
};

export const BUILDING_TYPES = [
  'General',
  'Office',
  'Medical',
  'Retail',
  'Industrial / Warehouse',
  'School',
  'Bank / Financial',
  'Church',
  'Restaurant',
];