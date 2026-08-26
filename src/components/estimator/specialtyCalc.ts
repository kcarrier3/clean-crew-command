/**
 * Project-based (one-time) estimating engines for specialty services.
 *
 * Every service shares the same financial model:
 *   loaded labor rate = base wage * (1 + burden%)
 *   direct cost       = labor + materials + equipment
 *   selling price     = direct cost / (1 - overhead% - target margin%)
 *
 * All production rates and assumptions are stored on the estimate revision and
 * are fully editable — nothing here is treated as immutable industry truth.
 */

import type { ServiceType } from './serviceTypes';

const n = (v: unknown, fallback = 0): number => {
  const x = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(x) ? (x as number) : fallback;
};
const nn = (v: unknown, fallback = 0) => Math.max(0, n(v, fallback));
const safe = (v: number) => (Number.isFinite(v) ? v : 0);

/* ------------------------------------------------------------------ types */

export interface FinancialBase {
  base_wage: number;
  labor_burden_percent: number;
  overhead_percent: number;
  target_margin_percent: number;
  /** Equipment, rental and other direct project cost. */
  equipment_cost: number;
  /** Fixed consumables / materials dollars. */
  materials_cost: number;
  /** Additional consumables assumption, per square foot. */
  materials_cost_per_sqft: number;
  /** Optional floor on the selling price. */
  minimum_charge: number;
}

export const DEFAULT_FINANCIALS: FinancialBase = {
  base_wage: 15,
  labor_burden_percent: 20,
  overhead_percent: 15,
  target_margin_percent: 25,
  equipment_cost: 0,
  materials_cost: 0,
  materials_cost_per_sqft: 0,
  minimum_charge: 0,
};

export interface ConstructionPhase {
  id: string;
  label: string;
  enabled: boolean;
  sqft: number;
  production_rate_sqft_hour: number;
  /** Crew-day model: sq ft one crew covers in a day for this phase (0 = derive from baseline). */
  sqft_per_crew_day?: number;
  extra_hours: number;
  notes: string;
  custom?: boolean;
}

export type ConstructionLaborType = 'standard' | 'prevailing';

export type ConstructionProjectType =
  | 'apartments' | 'schools' | 'open_office' | 'dense_restaurant' | 'custom';

export type ConstructionComplexity =
  | 'very_open' | 'open' | 'typical' | 'detailed' | 'dense';

export type ConstructionPriceBasis = 'cost' | 'day_rate' | 'manual';

export type PricingPosition =
  | 'need_work' | 'competitive' | 'normal' | 'busy' | 'very_busy';

export const CONSTRUCTION_PROJECT_TYPES: {
  value: ConstructionProjectType; label: string; baseline: number;
}[] = [
  { value: 'apartments', label: 'Apartments', baseline: 5000 },
  { value: 'schools', label: 'Schools', baseline: 5000 },
  { value: 'open_office', label: 'Open Office Buildout', baseline: 7500 },
  { value: 'dense_restaurant', label: 'Dense / Restaurant', baseline: 2500 },
  { value: 'custom', label: 'Custom', baseline: 5000 },
];

export const CONSTRUCTION_COMPLEXITY_LEVELS: {
  value: ConstructionComplexity; label: string; multiplier: number;
}[] = [
  { value: 'very_open', label: 'Very Open', multiplier: 1.3 },
  { value: 'open', label: 'Open', multiplier: 1.15 },
  { value: 'typical', label: 'Typical', multiplier: 1 },
  { value: 'detailed', label: 'Detailed', multiplier: 0.8 },
  { value: 'dense', label: 'Dense / Complex', multiplier: 0.6 },
];

export const PRICING_POSITIONS: { value: PricingPosition; label: string }[] = [
  { value: 'need_work', label: 'Need the Work' },
  { value: 'competitive', label: 'Competitive' },
  { value: 'normal', label: 'Normal' },
  { value: 'busy', label: 'Busy' },
  { value: 'very_busy', label: 'Very Busy' },
];

export const complexityMultiplier = (v: unknown): number =>
  CONSTRUCTION_COMPLEXITY_LEVELS.find(c => c.value === v)?.multiplier ?? 1;

/**
 * Default speed of each construction phase relative to the project's baseline
 * production rate (which represents the final clean).
 */
export const PHASE_PRODUCTION_FACTORS: Record<string, number> = {
  rough: 1.6,
  final: 1,
  touchup: 2.5,
};

/**
 * Project-type-specific phase speed factors. When a project type is present,
 * these override the global defaults so each job type cleans at its own rate.
 * Values are relative to the project baseline (final clean = 1×).
 */
export const PROJECT_PHASE_PRODUCTION_FACTORS: Record<ConstructionProjectType, Record<string, number>> = {
  apartments: { rough: 1.5, final: 1, touchup: 0.2 },
  schools: { rough: 1.6, final: 1, touchup: 2.5 },
  open_office: { rough: 1.6, final: 1, touchup: 2.5 },
  dense_restaurant: { rough: 1.6, final: 1, touchup: 2.5 },
  custom: { rough: 1.6, final: 1, touchup: 2.5 },
};

export const phaseProductionFactor = (id: string, projectType?: ConstructionProjectType): number => {
  const projectFactors = projectType ? PROJECT_PHASE_PRODUCTION_FACTORS[projectType] : undefined;
  if (projectFactors && id in projectFactors) return projectFactors[id];
  return PHASE_PRODUCTION_FACTORS[id] ?? 1;
};

/** Linear interpolation of the suggested day rate across the workload scale. */
export function suggestedDayRate(position: unknown, min: number, max: number): number {
  const idx = Math.max(0, PRICING_POSITIONS.findIndex(p => p.value === position));
  const lo = nn(min);
  const hi = nn(max);
  const span = hi - lo;
  return safe(lo + (span * idx) / (PRICING_POSITIONS.length - 1));
}

/* ------------------------------------------------- facility crew-day model */

/**
 * Primary construction-cleaning model: each building / area is estimated in
 * crew-days. Square footage is optional reference data only and never drives
 * the price.
 */
export type FacilityType =
  | 'youth_residential' | 'education' | 'office_admin' | 'facilities_support'
  | 'health_dining' | 'apartment' | 'restaurant' | 'medical' | 'warehouse' | 'other';

export type FacilityComplexity = 'light' | 'normal' | 'heavy';

export type PrevailingRateMode = 'split' | 'combined';

export interface FacilityRow {
  id: string;
  label: string;
  facility_type: FacilityType;
  /** Optional — reference / analytics only. */
  square_feet: number;
  /** Number of identical buildings or units priced on this row. */
  units: number;
  /** 0 = use the project default. */
  crew_size: number;
  /** 0 = use the project default. */
  hours_per_day: number;
  /** Crew-days for ONE unit. Supports quarter-days. */
  crew_days: number;
  /** True once the estimator moved the slider / typed a value themselves. */
  crew_days_touched: boolean;
  complexity: FacilityComplexity;
  /** 0 = use the project default billing rate. */
  billing_rate_per_hour: number;
  notes: string;
  /** Historical feedback (filled in after the job is completed). */
  actual_crew_days?: number;
  actual_labor_hours?: number;
  actual_recorded_at?: string | null;
}

/**
 * Editable starting points, seeded from the Youth Services estimate. These are
 * placeholders for judgement, not hard production claims.
 */
export const FACILITY_TYPES: {
  value: FacilityType; label: string; typical: number; min: number; max: number; hint: string;
}[] = [
  { value: 'youth_residential', label: 'Youth Cottage / Residential Institutional', typical: 2, min: 1, max: 3.5, hint: '~7k sf cottage, 4-person crew' },
  { value: 'education', label: 'School / Education', typical: 6, min: 3, max: 10, hint: 'large school building' },
  { value: 'office_admin', label: 'Office / Admin', typical: 4.5, min: 2, max: 8, hint: 'mid-size admin building' },
  { value: 'facilities_support', label: 'Facilities / Industrial Support', typical: 0.5, min: 0.25, max: 2, hint: 'small shop / support building' },
  { value: 'health_dining', label: 'Health / Dining', typical: 2, min: 1, max: 4, hint: '~9k sf building' },
  { value: 'apartment', label: 'Apartment / Multifamily', typical: 1, min: 0.25, max: 3, hint: 'per building or unit group' },
  { value: 'restaurant', label: 'Restaurant', typical: 2, min: 1, max: 4, hint: 'dense kitchen / dining' },
  { value: 'medical', label: 'Medical / Healthcare', typical: 3, min: 1.5, max: 6, hint: 'detailed finishes' },
  { value: 'warehouse', label: 'Warehouse / Industrial', typical: 1.5, min: 0.5, max: 5, hint: 'open square footage' },
  { value: 'other', label: 'Other / Custom', typical: 1, min: 0.25, max: 5, hint: 'set your own' },
];

export const FACILITY_COMPLEXITY_LEVELS: {
  value: FacilityComplexity; label: string; multiplier: number;
}[] = [
  { value: 'light', label: 'Light', multiplier: 0.8 },
  { value: 'normal', label: 'Normal', multiplier: 1 },
  { value: 'heavy', label: 'Heavy', multiplier: 1.3 },
];

export const facilityComplexityMultiplier = (v: unknown): number =>
  FACILITY_COMPLEXITY_LEVELS.find(c => c.value === v)?.multiplier ?? 1;

const roundQuarter = (v: number) => Math.round(v * 4) / 4;

/** Recommended crew-day range for a facility type at a given complexity. */
export function facilityRecommendation(type: unknown, complexity: unknown) {
  const t = FACILITY_TYPES.find(x => x.value === type) || FACILITY_TYPES[FACILITY_TYPES.length - 1];
  const m = facilityComplexityMultiplier(complexity);
  return {
    typical: roundQuarter(t.typical * m),
    min: roundQuarter(t.min * m),
    max: roundQuarter(t.max * m),
    label: t.label,
    hint: t.hint,
  };
}

/** Where the chosen crew-days sit inside the recommended range. */
export function facilityPositionLabel(days: number, min: number, max: number): 'aggressive' | 'typical' | 'conservative' {
  const span = max - min;
  if (span <= 0) return 'typical';
  const p = (days - min) / span;
  if (p < 0.34) return 'aggressive';
  if (p > 0.66) return 'conservative';
  return 'typical';
}

export const DEFAULT_FACILITY_ROW = (id?: string): FacilityRow => ({
  id: id || `fac-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  label: '',
  facility_type: 'other',
  square_feet: 0,
  units: 1,
  crew_size: 0,
  hours_per_day: 0,
  crew_days: 1,
  crew_days_touched: false,
  complexity: 'normal',
  billing_rate_per_hour: 0,
  notes: '',
});

export type ConstructionEstimatingMode = 'facilities' | 'legacy';

export interface ConstructionInputs extends FinancialBase {
  total_square_feet: number;
  phases: ConstructionPhase[];
  /** Facility crew-day model (primary) vs. the legacy sq-ft / phase model. */
  estimating_mode: ConstructionEstimatingMode;
  facilities: FacilityRow[];
  default_crew_size: number;
  default_hours_per_day: number;
  default_billing_rate_per_hour: number;
  /** Prevailing wage cost inputs — cost/margin only, never production. */
  prevailing_rate_mode: PrevailingRateMode;
  prevailing_combined_rate: number;
  /** Construction projects never carry janitorial consumables — supplies only. */
  union_project: boolean;
  prevailing_wage_project: boolean;
  /** Wage inputs used when union and/or prevailing wage applies. */
  prevailing_base_wage: number;
  prevailing_fringe_per_hour: number;
  prevailing_additional_burden_per_hour: number;
  /** Project cleaning supplies, priced like janitorial: $ per productive labor hour. */
  supply_rate_per_hour: number;
  supply_cost_fixed: number;
  supply_cost_per_sqft: number;
  /** Crew-day estimating (legacy sq-ft model). */
  crew_day_mode: boolean;
  project_type: ConstructionProjectType;
  baseline_sqft_per_crew_day: number;
  complexity: ConstructionComplexity;
  /** >0 overrides the complexity-adjusted production rate. */
  adjusted_sqft_per_crew_day_override: number;
  hours_per_crew_day: number;
  /** Crew composition per crew-day (0 crew size = legacy single-person crew-day). */
  crew_size: number;
  crew_lead_count: number;
  crew_member_wage: number;
  crew_lead_wage: number;
  /** Day-rate pricing + decision support. */
  proposed_day_rate: number;
  pricing_position: PricingPosition;
  suggested_day_rate_min: number;
  suggested_day_rate_max: number;
  price_basis: ConstructionPriceBasis;
  manual_project_price: number;
  /** Day-rate minimums. Single-day jobs hold a higher floor than multi-day work. */
  apply_minimum_day_rate: boolean;
  minimum_day_rate: number;
  multi_day_minimum_day_rate: number;
  /**
   * Union / prevailing-wage jobs: instead of a flat dollar floor, hold a
   * minimum margin over the actual loaded crew-day labor cost so a higher
   * wage scale can never erode the day rate into a loss.
   */
  apply_prevailing_margin_floor: boolean;
  prevailing_min_margin_percent: number;
}


export interface CarpetInputs extends FinancialBase {
  square_feet: number;
  method: string;
  production_rate_sqft_hour: number;
  additional_hours: number;
  stair_steps: number;
  hours_per_stair_step: number;
  soil_multiplier: number;
  soil_extra_hours: number;
  furniture_level: 'none' | 'light' | 'heavy';
  furniture_extra_hours: number;
}

export interface ScrubInputs extends FinancialBase {
  square_feet: number;
  production_rate_sqft_hour: number;
  passes: number;
  soil_multiplier: number;
  edge_detail_hours: number;
}

export interface VctInputs extends FinancialBase {
  square_feet: number;
  strip_rate_sqft_hour: number;
  rinse_rate_sqft_hour: number;
  rinse_extra_hours: number;
  finish_rate_sqft_hour: number;
  finish_coats: number;
  finish_coverage_sqft_gallon: number;
  finish_cost_per_gallon: number;
  edge_detail_hours: number;
}

export type SpecialtyInputs =
  | ConstructionInputs
  | CarpetInputs
  | ScrubInputs
  | VctInputs;

export interface LaborLine {
  label: string;
  hours: number;
  cost: number;
  detail?: string;
  /** Explicit customer price for this line (facility crew-day model). */
  price?: number;
}


export interface SpecialtyOutputs {
  lines: LaborLine[];
  labor_hours: number;
  loaded_labor_rate: number;
  labor_cost: number;
  materials_cost: number;
  equipment_cost: number;
  total_direct_cost: number;
  calculated_price: number;
  project_price: number;
  minimum_applied: boolean;
  overhead_amount: number;
  profit_amount: number;
  gross_margin_percent: number;
  markup_on_direct_percent: number;
  price_per_sqft: number;
  invalid: boolean;
  /** Extra service-specific readouts (e.g. gallons of finish). */
  extras: { label: string; value: string }[];
  /** Construction only — supplies broken out separately from consumables. */
  supply_cost?: number;
  /** Construction only — labor budget analysis. */
  labor_budget?: ConstructionLaborBudget;
  /** Construction only — crew-day / day-rate decision model. */
  day_model?: ConstructionDayModel;
  /** Construction only — facility crew-day model (primary). */
  facility_model?: ConstructionFacilityModel;
}

export interface FacilityRowResult {
  id: string;
  label: string;
  facility_type: FacilityType;
  facility_type_label: string;
  complexity: FacilityComplexity;
  square_feet: number;
  units: number;
  crew_size: number;
  hours_per_day: number;
  crew_days_per_unit: number;
  crew_days: number;
  labor_hours: number;
  billing_rate_per_hour: number;
  price: number;
  labor_cost: number;
  recommended_min: number;
  recommended_typical: number;
  recommended_max: number;
  position: 'aggressive' | 'typical' | 'conservative';
  /** Historical feedback (blank until actuals are recorded). */
  actual_crew_days: number;
  actual_labor_hours: number;
  crew_days_variance: number;
  labor_hours_variance: number;
  sqft_band: string;
}

export interface ConstructionFacilityModel {
  rows: FacilityRowResult[];
  default_crew_size: number;
  default_hours_per_day: number;
  default_billing_rate_per_hour: number;
  total_units: number;
  total_crew_days: number;
  total_labor_hours: number;
  total_square_feet: number;
  total_price: number;
  prevailing: boolean;
  prevailing_rate_mode: PrevailingRateMode;
  labor_cost_rate: number;
  direct_labor_cost: number;
  supply_cost: number;
  equipment_cost: number;
  total_direct_cost: number;
  gross_spread: number;
  gross_spread_percent: number;
  effective_billing_rate: number;
}


export interface ConstructionLaborBudget {
  labor_type: ConstructionLaborType;
  union_project: boolean;
  prevailing_wage_project: boolean;
  base_wage: number;
  burden_percent: number;
  burden_amount: number;
  fringe_per_hour: number;
  additional_burden_per_hour: number;
  /** Fully-loaded hourly labor cost actually used in the estimate. */
  effective_hourly_labor_cost: number;
  /** Supplies consumed per productive labor hour. */
  supply_rate_per_hour: number;
  /** Effective cost of one additional labor hour (labor + hourly supplies). */
  cost_per_labor_hour: number;
  labor_hours: number;
  labor_cost: number;
  /** Non-labor, non-hourly direct cost (equipment + fixed/sq ft supplies). */
  fixed_direct_cost: number;
  /** Max hours spendable while still hitting the target margin at this price. */
  max_hours_at_target_margin: number;
  /** Max hours before the job loses money (overhead still covered). */
  breakeven_hours: number;
}

export interface ConstructionDayModel {
  project_type: ConstructionProjectType;
  baseline_sqft_per_crew_day: number;
  complexity: ConstructionComplexity;
  complexity_label: string;
  complexity_multiplier: number;
  calculated_sqft_per_crew_day: number;
  adjusted_sqft_per_crew_day: number;
  production_overridden: boolean;
  crew_days: number;
  hours_per_crew_day: number;
  labor_hours: number;
  /** Crew composition (0 = legacy one-person crew-day). */
  crew_size: number;
  crew_lead_count: number;
  crew_member_wage: number;
  crew_lead_wage: number;
  blended_hourly_wage: number;
  labor_hours_per_crew_day: number;
  labor_cost_per_crew_day: number;
  /** Cost-based price that exactly hits the target margin. */
  target_margin_price: number;
  /** Price that covers direct cost + overhead with zero profit. */
  breakeven_price: number;
  proposed_day_rate: number;
  suggested_day_rate: number;
  suggested_day_rate_min: number;
  suggested_day_rate_max: number;
  pricing_position: PricingPosition;
  pricing_position_label: string;
  day_rate_project_price: number;
  /** Whole days actually billed (crew-days rounded up). */
  billable_days: number;
  /** Per-phase crew-day breakdown (rough / final / touch-up and custom items). */
  phases: ConstructionPhaseResult[];
  multi_day: boolean;
  applicable_minimum_day_rate: number;
  minimum_day_rate_applied: boolean;
  /** Union / prevailing wage floor: crew-day labor cost held at a minimum margin. */
  prevailing_margin_floor_active: boolean;
  prevailing_min_margin_percent: number;
  prevailing_minimum_day_rate: number;
  prevailing_minimum_applied: boolean;
  price_basis: ConstructionPriceBasis;
  final_project_price: number;
  effective_day_rate: number;
  status: 'target' | 'below_target' | 'below_breakeven';
  status_label: string;
}

export interface ConstructionPhaseResult {
  id: string;
  label: string;
  sqft: number;
  sqft_per_crew_day: number;
  production_overridden: boolean;
  crew_days: number;
  labor_hours: number;
  /** Loaded labor cost for this clean. */
  labor_cost: number;
  /** Labor + its share of supplies, materials and equipment. */
  allocated_cost: number;
  /** Customer price for this clean (share of the final project price). */
  price: number;
}

export const CARPET_METHODS: { value: string; label: string; rate: number }[] = [
  { value: 'hot_water_extraction', label: 'Hot water extraction', rate: 1000 },
  { value: 'encapsulation', label: 'Encapsulation / low moisture', rate: 2500 },
  { value: 'bonnet', label: 'Bonnet / interim', rate: 2000 },
  { value: 'custom', label: 'Custom', rate: 1500 },
];

export const SOIL_LEVELS: { value: string; label: string; multiplier: number }[] = [
  { value: 'light', label: 'Light', multiplier: 0.9 },
  { value: 'normal', label: 'Normal', multiplier: 1 },
  { value: 'heavy', label: 'Heavy', multiplier: 1.3 },
];

export const FURNITURE_LEVELS: { value: CarpetInputs['furniture_level']; label: string; hours: number }[] = [
  { value: 'none', label: 'None', hours: 0 },
  { value: 'light', label: 'Light', hours: 1 },
  { value: 'heavy', label: 'Heavy', hours: 3 },
];

/* --------------------------------------------------------------- defaults */

export const DEFAULT_CONSTRUCTION_PHASES = (): ConstructionPhase[] => [
  { id: 'rough', label: 'Rough Clean', enabled: false, sqft: 0, production_rate_sqft_hour: 1500, sqft_per_crew_day: 0, extra_hours: 0, notes: '' },
  { id: 'final', label: 'Final Clean', enabled: true, sqft: 0, production_rate_sqft_hour: 800, sqft_per_crew_day: 0, extra_hours: 0, notes: '' },
  { id: 'touchup', label: 'Touch-Up Clean', enabled: false, sqft: 0, production_rate_sqft_hour: 2500, sqft_per_crew_day: 0, extra_hours: 0, notes: '' },
];

export const DEFAULT_CONSTRUCTION_LABOR = {
  union_project: false,
  prevailing_wage_project: false,
  prevailing_base_wage: 0,
  prevailing_fringe_per_hour: 0,
  prevailing_additional_burden_per_hour: 0,
  supply_rate_per_hour: 0.35,
  supply_cost_fixed: 0,
  supply_cost_per_sqft: 0,
};

export const DEFAULT_CONSTRUCTION_DAY_MODEL = {
  crew_day_mode: true,
  project_type: 'apartments' as ConstructionProjectType,
  baseline_sqft_per_crew_day: 5000,
  complexity: 'typical' as ConstructionComplexity,
  adjusted_sqft_per_crew_day_override: 0,
  hours_per_crew_day: 9.5,
  crew_size: 5,
  crew_lead_count: 1,
  crew_member_wage: 16,
  crew_lead_wage: 19,
  proposed_day_rate: 0,
  pricing_position: 'normal' as PricingPosition,
  suggested_day_rate_min: 800,
  suggested_day_rate_max: 1600,
  price_basis: 'day_rate' as ConstructionPriceBasis,
  manual_project_price: 0,
  apply_minimum_day_rate: true,
  minimum_day_rate: 1500,
  multi_day_minimum_day_rate: 1250,
  apply_prevailing_margin_floor: true,
  prevailing_min_margin_percent: 41.25,
};

export const DEFAULT_CONSTRUCTION_FACILITY_MODEL = {
  estimating_mode: 'facilities' as ConstructionEstimatingMode,
  facilities: [] as FacilityRow[],
  default_crew_size: 4,
  default_hours_per_day: 8,
  default_billing_rate_per_hour: 0,
  prevailing_rate_mode: 'split' as PrevailingRateMode,
  prevailing_combined_rate: 0,
};

export const DEFAULT_SPECIALTY_INPUTS = (service: ServiceType): SpecialtyInputs => {
  switch (service) {
    case 'construction_cleaning':
      return {
        ...DEFAULT_FINANCIALS,
        ...DEFAULT_CONSTRUCTION_LABOR,
        ...DEFAULT_CONSTRUCTION_DAY_MODEL,
        ...DEFAULT_CONSTRUCTION_FACILITY_MODEL,
        total_square_feet: 0,
        phases: DEFAULT_CONSTRUCTION_PHASES(),
      };

    case 'carpet_cleaning':
      return {
        ...DEFAULT_FINANCIALS,
        square_feet: 0,
        method: 'hot_water_extraction',
        production_rate_sqft_hour: 1000,
        additional_hours: 0,
        stair_steps: 0,
        hours_per_stair_step: 0.05,
        soil_multiplier: 1,
        soil_extra_hours: 0,
        furniture_level: 'none',
        furniture_extra_hours: 0,
      };
    case 'floor_scrubbing':
      return {
        ...DEFAULT_FINANCIALS,
        square_feet: 0,
        production_rate_sqft_hour: 15000,
        passes: 1,
        soil_multiplier: 1,
        edge_detail_hours: 0,
      };
    case 'vct_strip_wax':
      return {
        ...DEFAULT_FINANCIALS,
        square_feet: 0,
        strip_rate_sqft_hour: 700,
        rinse_rate_sqft_hour: 2000,
        rinse_extra_hours: 0,
        finish_rate_sqft_hour: 3000,
        finish_coats: 3,
        finish_coverage_sqft_gallon: 2000,
        finish_cost_per_gallon: 35,
        edge_detail_hours: 0,
      };
    default:
      return { ...DEFAULT_FINANCIALS, square_feet: 0, production_rate_sqft_hour: 0, passes: 1, soil_multiplier: 1, edge_detail_hours: 0 } as ScrubInputs;
  }
};

/* ----------------------------------------------------------------- shared */

export function isPricingSolvable(overheadPercent: number, marginPercent: number): boolean {
  return nn(overheadPercent) + nn(marginPercent) < 100;
}

function price(
  base: FinancialBase,
  lines: LaborLine[],
  sqft: number,
  extraMaterials = 0,
  extras: { label: string; value: string }[] = [],
  opts: { materialsOverride?: number; supplyCost?: number } = {}
): SpecialtyOutputs {
  const laborHours = lines.reduce((s, l) => s + nn(l.hours), 0);
  const laborCost = lines.reduce((s, l) => s + nn(l.cost), 0);
  const loadedRate = nn(base.base_wage) * (1 + nn(base.labor_burden_percent) / 100);
  const materials = opts.materialsOverride !== undefined
    ? nn(opts.materialsOverride)
    : nn(base.materials_cost) + nn(base.materials_cost_per_sqft) * nn(sqft) + nn(extraMaterials);
  const equipment = nn(base.equipment_cost);
  const supply = nn(opts.supplyCost);
  const direct = laborCost + materials + equipment + supply;

  const overheadPct = nn(base.overhead_percent);
  const profitPct = nn(base.target_margin_percent);
  const solvable = isPricingSolvable(overheadPct, profitPct);
  const divisor = 1 - overheadPct / 100 - profitPct / 100;
  const calculated = solvable && divisor > 0 ? direct / divisor : 0;

  const minimum = nn(base.minimum_charge);
  const finalPrice = minimum > calculated ? minimum : calculated;

  return {
    lines,
    labor_hours: safe(laborHours),
    loaded_labor_rate: safe(loadedRate),
    labor_cost: safe(laborCost),
    materials_cost: safe(materials),
    equipment_cost: safe(equipment),
    total_direct_cost: safe(direct),
    calculated_price: safe(calculated),
    project_price: safe(finalPrice),
    minimum_applied: minimum > calculated && minimum > 0,
    supply_cost: opts.supplyCost !== undefined ? safe(supply) : undefined,
    overhead_amount: safe(finalPrice * (overheadPct / 100)),
    profit_amount: safe(finalPrice - direct - finalPrice * (overheadPct / 100)),
    gross_margin_percent: safe(finalPrice > 0 ? ((finalPrice - direct) / finalPrice) * 100 : 0),
    markup_on_direct_percent: safe(direct > 0 ? ((finalPrice - direct) / direct) * 100 : 0),
    price_per_sqft: safe(nn(sqft) > 0 ? finalPrice / nn(sqft) : 0),
    invalid: !solvable,
    extras,
  };
}

const line = (label: string, hours: number, rate: number, detail?: string): LaborLine => ({
  label,
  hours: safe(nn(hours)),
  cost: safe(nn(hours) * rate),
  detail,
});

const loaded = (b: FinancialBase) => nn(b.base_wage) * (1 + nn(b.labor_burden_percent) / 100);

/* -------------------------------------------------------------
 * Construction cleaning
 * ------------------------------------------------------------- */

/**
 * Effective hourly labor cost for a construction project.
 *
 * Standard / non-prevailing: base wage × (1 + burden%)
 * Union / prevailing wage:   prevailing base × (1 + burden%) + fringe + extra hourly burden
 *
 * The existing payroll burden % is applied to the wage only — fringe and any
 * additional hourly burden are already dollar amounts, so they are never
 * burdened again (no double counting).
 */
/**
 * Blended crew wage: leads at the lead wage, everyone else at the member wage.
 * Returns 0 when no crew composition is configured (legacy estimates).
 */
export function crewBlendedWage(i: ConstructionInputs): number {
  const size = nn(i.crew_size);
  if (size <= 0) return 0;
  const leads = Math.min(Math.max(nn(i.crew_lead_count), 0), size);
  const leadWage = nn(i.crew_lead_wage);
  const memberWage = nn(i.crew_member_wage);
  if (leadWage <= 0 && memberWage <= 0) return 0;
  return safe((leads * leadWage + (size - leads) * memberWage) / size);
}

export function constructionLaborRate(i: ConstructionInputs) {
  const prevailing = !!i.union_project || !!i.prevailing_wage_project;
  const combinedMode = prevailing && i.prevailing_rate_mode === 'combined' && nn(i.prevailing_combined_rate) > 0;
  const blended = crewBlendedWage(i);
  const wage = combinedMode
    ? nn(i.prevailing_combined_rate)
    : prevailing
      ? nn(i.prevailing_base_wage) || blended || nn(i.base_wage)
      : blended || nn(i.base_wage);
  const burdenPct = combinedMode ? 0 : nn(i.labor_burden_percent);
  const burdenAmount = wage * (burdenPct / 100);
  const fringe = prevailing && !combinedMode ? nn(i.prevailing_fringe_per_hour) : 0;
  const extra = prevailing && !combinedMode ? nn(i.prevailing_additional_burden_per_hour) : 0;
  return {
    prevailing,
    combined: combinedMode,
    wage,
    burdenPct,
    burdenAmount,
    fringe,
    extra,
    effective: wage + burdenAmount + fringe + extra,
  };
}

/* --------------------------------------------- facility crew-day estimating */

const sqftBand = (sqft: number): string => {
  const s = nn(sqft);
  if (s <= 0) return 'unspecified';
  if (s < 5000) return '<5k';
  if (s < 10000) return '5k-10k';
  if (s < 25000) return '10k-25k';
  if (s < 50000) return '25k-50k';
  if (s < 100000) return '50k-100k';
  return '100k+';
};

export function facilityRowsActive(i: ConstructionInputs): boolean {
  return i.estimating_mode === 'facilities' && Array.isArray(i.facilities) && i.facilities.length > 0;
}

/** Facility-based crew-day estimate: hours × billing rate, cost from wages. */
export function calculateConstructionFacilities(i: ConstructionInputs): SpecialtyOutputs {
  const wageInfo = constructionLaborRate(i);
  const costRate = wageInfo.effective;
  const defCrew = nn(i.default_crew_size) || 4;
  const defHours = nn(i.default_hours_per_day) || 8;
  const defRate = nn(i.default_billing_rate_per_hour);

  const rows: FacilityRowResult[] = (i.facilities || []).map(f => {
    const rec = facilityRecommendation(f.facility_type, f.complexity);
    const units = Math.max(0, nn(f.units, 1) || 0);
    const crew = nn(f.crew_size) || defCrew;
    const hpd = nn(f.hours_per_day) || defHours;
    const cdPerUnit = nn(f.crew_days);
    const crewDays = units * cdPerUnit;
    const hours = crewDays * crew * hpd;
    const rate = nn(f.billing_rate_per_hour) || defRate;
    const actualDays = nn(f.actual_crew_days);
    const actualHours = nn(f.actual_labor_hours);
    return {
      id: f.id,
      label: f.label || rec.label,
      facility_type: f.facility_type || 'other',
      facility_type_label: rec.label,
      complexity: f.complexity || 'normal',
      square_feet: nn(f.square_feet),
      units,
      crew_size: crew,
      hours_per_day: hpd,
      crew_days_per_unit: safe(cdPerUnit),
      crew_days: safe(crewDays),
      labor_hours: safe(hours),
      billing_rate_per_hour: safe(rate),
      price: safe(hours * rate),
      labor_cost: safe(hours * costRate),
      recommended_min: rec.min,
      recommended_typical: rec.typical,
      recommended_max: rec.max,
      position: facilityPositionLabel(cdPerUnit, rec.min, rec.max),
      actual_crew_days: safe(actualDays),
      actual_labor_hours: safe(actualHours),
      crew_days_variance: safe(actualDays > 0 ? actualDays - crewDays : 0),
      labor_hours_variance: safe(actualHours > 0 ? actualHours - hours : 0),
      sqft_band: sqftBand(f.square_feet),
    };
  });

  const totalHours = rows.reduce((s, r) => s + r.labor_hours, 0);
  const totalCrewDays = rows.reduce((s, r) => s + r.crew_days, 0);
  const totalUnits = rows.reduce((s, r) => s + r.units, 0);
  const rowSqft = rows.reduce((s, r) => s + r.square_feet, 0);
  const totalSqft = nn(i.total_square_feet) || rowSqft;
  const laborCost = rows.reduce((s, r) => s + r.labor_cost, 0);
  const supplyCost =
    totalHours * nn(i.supply_rate_per_hour) + nn(i.supply_cost_fixed) + nn(i.supply_cost_per_sqft) * totalSqft;
  const equipment = nn(i.equipment_cost);
  const direct = laborCost + supplyCost + equipment;

  let price = rows.reduce((s, r) => s + r.price, 0);
  if (i.price_basis === 'manual' && nn(i.manual_project_price) > 0) price = nn(i.manual_project_price);
  const minimum = nn(i.minimum_charge);
  const minimumApplied = minimum > price;
  if (minimumApplied) price = minimum;

  const overheadPct = nn(i.overhead_percent);
  const lines: LaborLine[] = rows.map(r => ({
    label: r.label,
    hours: r.labor_hours,
    cost: r.labor_cost,
    price: r.price,
    detail: `${r.units > 1 ? `${r.units} × ` : ''}${r.crew_days_per_unit} crew-day${r.crew_days_per_unit === 1 ? '' : 's'} × ${r.crew_size} crew × ${r.hours_per_day} hr @ ${r.billing_rate_per_hour ? `$${r.billing_rate_per_hour}/hr` : 'no rate set'}`,
  }));

  const spread = price - direct;
  return {
    lines,
    labor_hours: safe(totalHours),
    loaded_labor_rate: safe(costRate),
    labor_cost: safe(laborCost),
    materials_cost: 0,
    equipment_cost: safe(equipment),
    supply_cost: safe(supplyCost),
    total_direct_cost: safe(direct),
    calculated_price: safe(price),
    project_price: safe(price),
    minimum_applied: minimumApplied,
    overhead_amount: safe(price * (overheadPct / 100)),
    profit_amount: safe(price - direct - price * (overheadPct / 100)),
    gross_margin_percent: safe(price > 0 ? (spread / price) * 100 : 0),
    markup_on_direct_percent: safe(direct > 0 ? (spread / direct) * 100 : 0),
    price_per_sqft: safe(totalSqft > 0 ? price / totalSqft : 0),
    invalid: false,
    extras: [],
    facility_model: {
      rows,
      default_crew_size: defCrew,
      default_hours_per_day: defHours,
      default_billing_rate_per_hour: safe(defRate),
      total_units: totalUnits,
      total_crew_days: safe(totalCrewDays),
      total_labor_hours: safe(totalHours),
      total_square_feet: safe(totalSqft),
      total_price: safe(price),
      prevailing: wageInfo.prevailing,
      prevailing_rate_mode: wageInfo.combined ? 'combined' : 'split',
      labor_cost_rate: safe(costRate),
      direct_labor_cost: safe(laborCost),
      supply_cost: safe(supplyCost),
      equipment_cost: safe(equipment),
      total_direct_cost: safe(direct),
      gross_spread: safe(spread),
      gross_spread_percent: safe(price > 0 ? (spread / price) * 100 : 0),
      effective_billing_rate: safe(totalHours > 0 ? price / totalHours : 0),
    },
  };
}

export function calculateConstruction(i: ConstructionInputs): SpecialtyOutputs {
  if (facilityRowsActive(i)) return calculateConstructionFacilities(i);
  const wageInfo = constructionLaborRate(i);
  const rate = wageInfo.effective;

  const totalSqft = nn(i.total_square_feet);
  const crewDayMode = i.crew_day_mode !== false;

  /* ---- crew-day production model ---- */
  const baseline = nn(i.baseline_sqft_per_crew_day);
  const multiplier = complexityMultiplier(i.complexity);
  const calculatedProduction = baseline * multiplier;
  const overrideProduction = nn(i.adjusted_sqft_per_crew_day_override);
  const adjustedProduction = overrideProduction > 0 ? overrideProduction : calculatedProduction;
  const hoursPerDay = nn(i.hours_per_crew_day) || 8;
  const crewSize = nn(i.crew_size);
  const crewMultiplier = crewSize > 0 ? crewSize : 1;
  const hoursPerCrewDay = hoursPerDay * crewMultiplier;

  /* Each selected phase (rough / final / touch-up) carries its own production
     rate in sq ft per crew-day. Unset rates derive from the project baseline
     using the project-type-specific phase speed factor, then the complexity
     multiplier is applied. */
  const enabledPhases = (i.phases || []).filter(p => p.enabled);
  const phaseResults: ConstructionPhaseResult[] = enabledPhases.map(p => {
    const own = nn(p.sqft_per_crew_day);
    const prod = own > 0
      ? own * multiplier
      : adjustedProduction * phaseProductionFactor(p.id, i.project_type);
    const sqft = nn(p.sqft) > 0 ? nn(p.sqft) : totalSqft;
    const days = prod > 0 ? sqft / prod : 0;
    return {
      id: p.id,
      label: p.label || 'Phase',
      sqft: safe(sqft),
      sqft_per_crew_day: safe(prod),
      production_overridden: own > 0,
      crew_days: safe(days),
      labor_hours: safe(days * hoursPerCrewDay),
      labor_cost: safe(days * hoursPerCrewDay * rate),
      allocated_cost: 0,
      price: 0,
    };
  });
  const phaseCrewDays = phaseResults.reduce((s, p) => s + p.crew_days, 0);
  const crewDays = crewDayMode
    ? (phaseResults.length > 0
        ? phaseCrewDays
        : (adjustedProduction > 0 ? totalSqft / adjustedProduction : 0))
    : (adjustedProduction > 0 ? totalSqft / adjustedProduction : 0);

  let lines: LaborLine[];
  if (crewDayMode) {
    lines = phaseResults.length > 0
      ? phaseResults.map(p =>
          line(
            p.label,
            p.labor_hours,
            rate,
            p.sqft_per_crew_day > 0
              ? `${p.sqft.toLocaleString()} sq ft ÷ ${Math.round(p.sqft_per_crew_day).toLocaleString()} sq ft/crew-day = ${p.crew_days.toFixed(2)} crew-days × ${crewMultiplier > 1 ? `${crewMultiplier} workers × ` : ''}${hoursPerDay} hr`
              : undefined
          )
        )
      : [
      line(
        'Construction cleaning crew',
        crewDays * hoursPerCrewDay,
        rate,
        adjustedProduction > 0
          ? `${totalSqft.toLocaleString()} sq ft ÷ ${Math.round(adjustedProduction).toLocaleString()} sq ft/crew-day = ${crewDays.toFixed(2)} crew-days × ${crewMultiplier > 1 ? `${crewMultiplier} workers × ` : ''}${hoursPerDay} hr`
          : undefined
      ),
    ];
  } else {
    lines = (i.phases || []).filter(p => p.enabled).map(p => {
      const sqft = nn(p.sqft) || totalSqft;
      const prod = nn(p.production_rate_sqft_hour);
      const hours = (prod > 0 ? sqft / prod : 0) + nn(p.extra_hours);
      return line(
        p.label || 'Phase',
        hours,
        rate,
        prod > 0 ? `${sqft.toLocaleString()} sq ft @ ${prod.toLocaleString()} sq ft/hr` : undefined
      );
    });
  }

  const laborHours = lines.reduce((s, l) => s + nn(l.hours), 0);
  const supplyRate = nn(i.supply_rate_per_hour);
  const supplyCost =
    laborHours * supplyRate + nn(i.supply_cost_fixed) + nn(i.supply_cost_per_sqft) * totalSqft;

  // Construction carries no consumables — supplies replace that bucket entirely.
  const out = price(i, lines, totalSqft, 0, [], { materialsOverride: 0, supplyCost });
  out.loaded_labor_rate = safe(rate);

  const overheadPct = nn(i.overhead_percent);
  const profitPct = nn(i.target_margin_percent);
  const direct = out.total_direct_cost;
  const solvable = isPricingSolvable(overheadPct, profitPct);

  /* ---- pricing basis: cost-based, day rate, or manual ---- */
  const targetMarginPrice = out.project_price; // cost-based, minimum charge applied
  const breakevenDivisor = 1 - overheadPct / 100;
  const breakevenPrice = breakevenDivisor > 0 ? direct / breakevenDivisor : 0;
  const proposedDayRate = nn(i.proposed_day_rate);
  /* Day-rate minimums: single-day jobs hold the higher floor; multi-day work
     may be sold at the lower multi-day floor. */
  const billableDays = crewDays > 0 ? Math.max(1, Math.ceil(crewDays - 1e-9)) : 0;
  const multiDay = billableDays > 1;
  const applyMin = i.apply_minimum_day_rate !== false;
  const flatMinDayRate = applyMin
    ? (multiDay ? nn(i.multi_day_minimum_day_rate) || nn(i.minimum_day_rate) : nn(i.minimum_day_rate))
    : 0;
  /* Union / prevailing wage: wage scales vary job to job, so the floor is a
     margin over the real loaded crew-day labor cost rather than a fixed dollar. */
  const crewDayLaborCost = safe(hoursPerCrewDay * rate);
  const prevailingFloorActive =
    wageInfo.prevailing && i.apply_prevailing_margin_floor !== false && crewDayLaborCost > 0;
  const prevailingMarginPct = Math.min(99, Math.max(0, nn(i.prevailing_min_margin_percent)));
  const prevailingMinDayRate = prevailingFloorActive
    ? safe(crewDayLaborCost / (1 - prevailingMarginPct / 100))
    : 0;
  const minDayRate = Math.max(flatMinDayRate, prevailingMinDayRate);
  const effectiveDayRate = Math.max(proposedDayRate, minDayRate);
  const minDayRateApplied = minDayRate > 0 && minDayRate > proposedDayRate;
  const dayRatePrice = billableDays * effectiveDayRate;
  const manualPrice = nn(i.manual_project_price);
  const basis: ConstructionPriceBasis =
    i.price_basis === 'day_rate' || i.price_basis === 'manual' ? i.price_basis : 'cost';

  let finalPrice = targetMarginPrice;
  if (basis === 'day_rate' && dayRatePrice > 0) finalPrice = dayRatePrice;
  if (basis === 'manual' && manualPrice > 0) finalPrice = manualPrice;
  const minimum = nn(i.minimum_charge);
  if (minimum > finalPrice) finalPrice = minimum;

  // Re-derive every price-dependent output from the selected final price.
  out.project_price = safe(finalPrice);
  out.overhead_amount = safe(finalPrice * (overheadPct / 100));
  out.profit_amount = safe(finalPrice - direct - finalPrice * (overheadPct / 100));
  out.gross_margin_percent = safe(finalPrice > 0 ? ((finalPrice - direct) / finalPrice) * 100 : 0);
  out.markup_on_direct_percent = safe(direct > 0 ? ((finalPrice - direct) / direct) * 100 : 0);
  out.price_per_sqft = safe(totalSqft > 0 ? finalPrice / totalSqft : 0);
  out.minimum_applied = minimum > 0 && minimum >= finalPrice;

  /* ---- per-clean (rough / final / touch-up) cost and price breakout ----
     Non-labor direct cost and the customer price are allocated to each clean
     in proportion to its share of labor cost. */
  const phaseLaborTotal = phaseResults.reduce((s, p) => s + p.labor_cost, 0);
  const nonLaborDirect = Math.max(0, direct - phaseLaborTotal);
  if (phaseResults.length > 0) {
    phaseResults.forEach((p, idx) => {
      const share = phaseLaborTotal > 0 ? p.labor_cost / phaseLaborTotal : 1 / phaseResults.length;
      p.allocated_cost = safe(p.labor_cost + nonLaborDirect * share);
      p.price = safe(finalPrice * share);
      if (idx === phaseResults.length - 1) {
        const sum = phaseResults.reduce((s, x) => s + x.price, 0);
        p.price = safe(p.price + (finalPrice - sum));
      }
    });
  }

  // Labor budget headroom at the final selling price.
  const priceOut = finalPrice;
  const fixedDirect =
    nn(i.equipment_cost) + nn(i.supply_cost_fixed) + nn(i.supply_cost_per_sqft) * totalSqft;
  const costPerHour = rate + supplyRate;
  const allowanceAtTarget = priceOut * (1 - overheadPct / 100 - profitPct / 100) - fixedDirect;
  const allowanceBreakeven = priceOut * (1 - overheadPct / 100) - fixedDirect;

  out.labor_budget = {
    labor_type: wageInfo.prevailing ? 'prevailing' : 'standard',
    union_project: !!i.union_project,
    prevailing_wage_project: !!i.prevailing_wage_project,
    base_wage: safe(wageInfo.wage),
    burden_percent: safe(wageInfo.burdenPct),
    burden_amount: safe(wageInfo.burdenAmount),
    fringe_per_hour: safe(wageInfo.fringe),
    additional_burden_per_hour: safe(wageInfo.extra),
    effective_hourly_labor_cost: safe(rate),
    supply_rate_per_hour: safe(supplyRate),
    cost_per_labor_hour: safe(costPerHour),
    labor_hours: safe(laborHours),
    labor_cost: safe(out.labor_cost),
    fixed_direct_cost: safe(fixedDirect),
    max_hours_at_target_margin: safe(costPerHour > 0 ? Math.max(0, allowanceAtTarget / costPerHour) : 0),
    breakeven_hours: safe(costPerHour > 0 ? Math.max(0, allowanceBreakeven / costPerHour) : 0),
  };

  const status: ConstructionDayModel['status'] =
    finalPrice + 1e-9 >= targetMarginPrice ? 'target'
      : finalPrice >= breakevenPrice ? 'below_target'
      : 'below_breakeven';

  out.day_model = {
    project_type: i.project_type || 'custom',
    baseline_sqft_per_crew_day: safe(baseline),
    complexity: i.complexity || 'typical',
    complexity_label: CONSTRUCTION_COMPLEXITY_LEVELS.find(c => c.value === i.complexity)?.label || 'Typical',
    complexity_multiplier: multiplier,
    calculated_sqft_per_crew_day: safe(calculatedProduction),
    adjusted_sqft_per_crew_day: safe(adjustedProduction),
    production_overridden: overrideProduction > 0,
    crew_days: safe(crewDays),
    hours_per_crew_day: safe(hoursPerDay),
    labor_hours: safe(laborHours),
    crew_size: safe(crewSize),
    crew_lead_count: safe(nn(i.crew_lead_count)),
    crew_member_wage: safe(nn(i.crew_member_wage)),
    crew_lead_wage: safe(nn(i.crew_lead_wage)),
    blended_hourly_wage: safe(crewBlendedWage(i)),
    labor_hours_per_crew_day: safe(hoursPerCrewDay),
    labor_cost_per_crew_day: safe(hoursPerCrewDay * rate),
    target_margin_price: safe(solvable ? targetMarginPrice : 0),
    breakeven_price: safe(breakevenPrice),
    proposed_day_rate: safe(effectiveDayRate),
    suggested_day_rate: suggestedDayRate(i.pricing_position, i.suggested_day_rate_min, i.suggested_day_rate_max),
    suggested_day_rate_min: nn(i.suggested_day_rate_min),
    suggested_day_rate_max: nn(i.suggested_day_rate_max),
    pricing_position: i.pricing_position || 'normal',
    pricing_position_label: PRICING_POSITIONS.find(p => p.value === i.pricing_position)?.label || 'Normal',
    day_rate_project_price: safe(dayRatePrice),
    billable_days: billableDays,
    phases: phaseResults,
    multi_day: multiDay,
    applicable_minimum_day_rate: safe(minDayRate),
    minimum_day_rate_applied: basis === 'day_rate' && minDayRateApplied,
    prevailing_margin_floor_active: prevailingFloorActive,
    prevailing_min_margin_percent: safe(prevailingMarginPct),
    prevailing_minimum_day_rate: safe(prevailingMinDayRate),
    prevailing_minimum_applied:
      basis === 'day_rate' && prevailingFloorActive &&
      prevailingMinDayRate >= flatMinDayRate && prevailingMinDayRate > proposedDayRate,
    price_basis: basis,
    final_project_price: safe(finalPrice),
    effective_day_rate: safe(crewDays > 0 ? finalPrice / crewDays : 0),
    status,
    status_label:
      status === 'target' ? 'Meets target margin'
        : status === 'below_target' ? 'Below target margin'
        : 'Below break-even',
  };
  return out;
}

/* ------------------------------------------------------------- 
 * Carpet cleaning
 * ------------------------------------------------------------- */
export function calculateCarpet(i: CarpetInputs): SpecialtyOutputs {
  const rate = loaded(i);
  const sqft = nn(i.square_feet);
  const prod = nn(i.production_rate_sqft_hour);
  const baseHours = (prod > 0 ? sqft / prod : 0) * (nn(i.soil_multiplier, 1) || 1);
  const lines: LaborLine[] = [
    line('Carpet cleaning', baseHours, rate, prod > 0 ? `${sqft.toLocaleString()} sq ft @ ${prod.toLocaleString()} sq ft/hr` : undefined),
  ];
  const stairHours = nn(i.stair_steps) * nn(i.hours_per_stair_step);
  if (stairHours > 0) lines.push(line('Stairs', stairHours, rate, `${nn(i.stair_steps)} steps`));
  if (nn(i.soil_extra_hours) > 0) lines.push(line('Spotting / heavy soil', nn(i.soil_extra_hours), rate));
  if (nn(i.furniture_extra_hours) > 0) lines.push(line('Furniture moving', nn(i.furniture_extra_hours), rate));
  if (nn(i.additional_hours) > 0) lines.push(line('Additional labor', nn(i.additional_hours), rate));
  return price(i, lines, sqft);
}

/* ------------------------------------------------------------- 
 * Floor scrubbing
 * ------------------------------------------------------------- */
export function calculateScrub(i: ScrubInputs): SpecialtyOutputs {
  const rate = loaded(i);
  const sqft = nn(i.square_feet);
  const prod = nn(i.production_rate_sqft_hour);
  const passes = Math.max(1, nn(i.passes, 1) || 1);
  const hours = (prod > 0 ? sqft / prod : 0) * passes * (nn(i.soil_multiplier, 1) || 1);
  const lines: LaborLine[] = [
    line('Machine scrubbing', hours, rate, prod > 0 ? `${sqft.toLocaleString()} sq ft × ${passes} pass${passes > 1 ? 'es' : ''} @ ${prod.toLocaleString()} sq ft/hr` : undefined),
  ];
  if (nn(i.edge_detail_hours) > 0) lines.push(line('Edges & detail', nn(i.edge_detail_hours), rate));
  return price(i, lines, sqft);
}

/* ------------------------------------------------------------- 
 * VCT strip & wax
 * ------------------------------------------------------------- */
export function calculateVct(i: VctInputs): SpecialtyOutputs {
  const rate = loaded(i);
  const sqft = nn(i.square_feet);
  const stripRate = nn(i.strip_rate_sqft_hour);
  const rinseRate = nn(i.rinse_rate_sqft_hour);
  const finishRate = nn(i.finish_rate_sqft_hour);
  const coats = Math.max(0, nn(i.finish_coats));

  const stripHours = stripRate > 0 ? sqft / stripRate : 0;
  const rinseHours = (rinseRate > 0 ? sqft / rinseRate : 0) + nn(i.rinse_extra_hours);
  const finishHours = (finishRate > 0 ? sqft / finishRate : 0) * coats;

  const lines: LaborLine[] = [
    line('Stripping', stripHours, rate, stripRate > 0 ? `${sqft.toLocaleString()} sq ft @ ${stripRate.toLocaleString()} sq ft/hr` : undefined),
    line('Rinse / neutralize', rinseHours, rate, rinseRate > 0 ? `${sqft.toLocaleString()} sq ft @ ${rinseRate.toLocaleString()} sq ft/hr` : undefined),
    line('Finish application', finishHours, rate, finishRate > 0 ? `${coats} coat${coats === 1 ? '' : 's'} @ ${finishRate.toLocaleString()} sq ft/hr` : undefined),
  ];
  if (nn(i.edge_detail_hours) > 0) lines.push(line('Edge / detail / scrape', nn(i.edge_detail_hours), rate));

  const coverage = nn(i.finish_coverage_sqft_gallon);
  const rawGallons = coverage > 0 ? (sqft * coats) / coverage : 0;
  const gallons = Math.ceil(rawGallons);
  const finishCost = gallons * nn(i.finish_cost_per_gallon);

  return price(i, lines, sqft, finishCost, [
    {
      label: 'Finish required',
      value: `${gallons} gal (${rawGallons.toFixed(2)} raw${coverage > 0 ? ` · ${coverage.toLocaleString()} sq ft/gal × ${coats} coats` : ''})`,
    },
    { label: 'Finish material cost', value: `$${finishCost.toFixed(2)}` },
  ]);
}

/* ------------------------------------------------------------- dispatcher */

export function calculateSpecialty(service: ServiceType, inputs: SpecialtyInputs): SpecialtyOutputs {
  switch (service) {
    case 'construction_cleaning':
      return calculateConstruction(inputs as ConstructionInputs);
    case 'carpet_cleaning':
      return calculateCarpet(inputs as CarpetInputs);
    case 'floor_scrubbing':
      return calculateScrub(inputs as ScrubInputs);
    case 'vct_strip_wax':
      return calculateVct(inputs as VctInputs);
    default:
      return price(inputs as FinancialBase, [], 0);
  }
}

/** Merges stored JSONB back over the service defaults so new fields appear. */
const FACILITY_TYPE_KEYWORDS: [RegExp, FacilityType][] = [
  [/cottage|residential|dorm|group home/i, 'youth_residential'],
  [/school|education|classroom|academic/i, 'education'],
  [/admin|office/i, 'office_admin'],
  [/facilit|maintenance|shop|support|garage/i, 'facilities_support'],
  [/health|dining|cafeteria|kitchen/i, 'health_dining'],
  [/apartment|multifamily|unit/i, 'apartment'],
  [/restaurant/i, 'restaurant'],
  [/medical|clinic|hospital|dental/i, 'medical'],
  [/warehouse|industrial|distribution/i, 'warehouse'],
];

export const guessFacilityType = (label: string): FacilityType =>
  FACILITY_TYPE_KEYWORDS.find(([re]) => re.test(label || ''))?.[1] ?? 'other';

/**
 * Bring saved construction estimates into the facility crew-day model without
 * changing any of their numbers. Phase rows that were priced on fixed labor
 * hours (the workflow we now standardise on) convert cleanly; anything that
 * still relies on sq-ft production rates stays on the legacy engine.
 */
function migrateConstructionFacilities(c: ConstructionInputs, raw: Record<string, unknown>) {
  if (Array.isArray(c.facilities) && c.facilities.length > 0) {
    c.estimating_mode = 'facilities';
    c.facilities = c.facilities.map(f => ({ ...DEFAULT_FACILITY_ROW(f.id), ...f }));
    return;
  }
  if ('estimating_mode' in raw) return;

  const rows = (c.phases || []).filter(p => p.enabled);
  const hourly = rows.length > 0 && rows.every(p => nn(p.extra_hours) > 0 && !(nn(p.production_rate_sqft_hour) > 0));
  if (!hourly) {
    c.estimating_mode = 'legacy';
    c.facilities = [];
    return;
  }

  const crew = nn(c.default_crew_size) || nn(c.crew_size) || 4;
  const hpd = nn(c.default_hours_per_day) || nn(c.hours_per_crew_day) || 8;
  const totalHours = rows.reduce((s, p) => s + nn(p.extra_hours), 0);
  const savedPrice = nn(c.manual_project_price);
  const rate = nn(c.default_billing_rate_per_hour) || (savedPrice > 0 && totalHours > 0 ? savedPrice / totalHours : 0);

  c.estimating_mode = 'facilities';
  c.default_crew_size = crew;
  c.default_hours_per_day = hpd;
  c.default_billing_rate_per_hour = rate;
  c.price_basis = 'manual' === c.price_basis ? 'manual' : c.price_basis;
  c.facilities = rows.map(p => ({
    ...DEFAULT_FACILITY_ROW(p.id),
    label: p.label,
    facility_type: guessFacilityType(p.label),
    square_feet: nn(p.sqft),
    units: 1,
    crew_size: crew,
    hours_per_day: hpd,
    crew_days: crew * hpd > 0 ? nn(p.extra_hours) / (crew * hpd) : 0,
    crew_days_touched: true,
    billing_rate_per_hour: rate,
    notes: p.notes || '',
  }));
}

export function hydrateSpecialtyInputs(service: ServiceType, stored: unknown): SpecialtyInputs {

  const defaults = DEFAULT_SPECIALTY_INPUTS(service) as unknown as Record<string, unknown>;
  const raw = (stored && typeof stored === 'object' ? stored : {}) as Record<string, unknown>;
  const merged = { ...defaults, ...raw } as unknown as SpecialtyInputs;
  if (service === 'construction_cleaning') {
    const c = merged as ConstructionInputs;
    if (!Array.isArray(c.phases) || c.phases.length === 0) c.phases = DEFAULT_CONSTRUCTION_PHASES();
    // Legacy estimates predate the construction supply model: keep their totals
    // identical by moving old consumables dollars into the supply buckets and
    // defaulting the hourly supply rate to zero rather than the new default.
    const legacy = !('supply_rate_per_hour' in raw);
    if (legacy) {
      c.supply_rate_per_hour = 0;
      c.supply_cost_fixed = nn(raw.materials_cost);
      c.supply_cost_per_sqft = nn(raw.materials_cost_per_sqft);
    }
    // Estimates saved before the crew-day model keep their phase-based math and
    // therefore their historical totals; only new estimates default to crew-days.
    if (!('crew_day_mode' in raw)) c.crew_day_mode = false;
    // Crew composition is new: existing estimates keep one-person crew-day math
    // and their saved wage until a crew is entered.
    if (!('crew_size' in raw)) {
      c.crew_size = 0;
      c.crew_lead_count = 0;
      c.crew_member_wage = 0;
      c.crew_lead_wage = 0;
    }
    // Day-rate minimums are new: saved estimates keep their original pricing basis
    // and are never re-floored to the new minimum.
    if (!('apply_minimum_day_rate' in raw)) {
      c.apply_minimum_day_rate = false;
      if (!('apply_prevailing_margin_floor' in raw)) c.apply_prevailing_margin_floor = false;
      if (!('price_basis' in raw)) c.price_basis = 'cost';
    }
    c.materials_cost = 0;
    c.materials_cost_per_sqft = 0;
    migrateConstructionFacilities(c, raw);
  }

  return merged;
}

export function validateSpecialty(service: ServiceType, i: SpecialtyInputs): string | null {
  if (!isPricingSolvable((i as FinancialBase).overhead_percent, (i as FinancialBase).target_margin_percent)) {
    return 'Overhead % + target profit % must be under 100%.';
  }
  if (nn((i as FinancialBase).base_wage) <= 0) return 'Base wage must be greater than zero.';
  switch (service) {
    case 'construction_cleaning': {
      const c = i as ConstructionInputs;
      if (!(nn(c.total_square_feet) > 0)) return 'Total project square feet must be greater than zero.';
      if ((c.union_project || c.prevailing_wage_project) && !(nn(c.prevailing_base_wage) > 0))
        return 'Enter the union / prevailing base hourly wage.';
      if (c.crew_day_mode !== false) {
        const adjusted = nn(c.adjusted_sqft_per_crew_day_override) > 0
          ? nn(c.adjusted_sqft_per_crew_day_override)
          : nn(c.baseline_sqft_per_crew_day) * complexityMultiplier(c.complexity);
        if (!(adjusted > 0)) return 'Baseline production (sq ft per crew-day) must be greater than zero.';
        if (!(nn(c.hours_per_crew_day) > 0)) return 'Hours per crew-day must be greater than zero.';
        if ((c.phases || []).filter(p => p.enabled).length === 0)
          return 'Select at least one clean (rough, final or touch-up).';
        return null;
      }
      const active = (c.phases || []).filter(p => p.enabled);
      if (active.length === 0) return 'Select at least one phase or work item.';
      if (active.some(p => !(nn(p.production_rate_sqft_hour) > 0) && !(nn(p.extra_hours) > 0)))
        return 'Each selected phase needs a production rate or fixed labor hours.';
      return null;
    }
    case 'carpet_cleaning': {
      const c = i as CarpetInputs;
      if (!(nn(c.square_feet) > 0)) return 'Carpet square feet must be greater than zero.';
      if (!(nn(c.production_rate_sqft_hour) > 0)) return 'Production rate must be greater than zero.';
      return null;
    }
    case 'floor_scrubbing': {
      const c = i as ScrubInputs;
      if (!(nn(c.square_feet) > 0)) return 'Square feet must be greater than zero.';
      if (!(nn(c.production_rate_sqft_hour) > 0)) return 'Production rate must be greater than zero.';
      return null;
    }
    case 'vct_strip_wax': {
      const c = i as VctInputs;
      if (!(nn(c.square_feet) > 0)) return 'VCT square feet must be greater than zero.';
      if (!(nn(c.strip_rate_sqft_hour) > 0)) return 'Strip production rate must be greater than zero.';
      if (!(nn(c.finish_rate_sqft_hour) > 0)) return 'Finish application rate must be greater than zero.';
      if (!(nn(c.finish_coats) > 0)) return 'Number of finish coats must be greater than zero.';
      if (!(nn(c.finish_coverage_sqft_gallon) > 0)) return 'Finish coverage (sq ft/gal) must be greater than zero.';
      return null;
    }
    default:
      return null;
  }
}