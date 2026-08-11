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
  extra_hours: number;
  notes: string;
  custom?: boolean;
}

export type ConstructionLaborType = 'standard' | 'prevailing';

export interface ConstructionInputs extends FinancialBase {
  total_square_feet: number;
  phases: ConstructionPhase[];
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
  { id: 'rough', label: 'Rough Clean', enabled: false, sqft: 0, production_rate_sqft_hour: 1500, extra_hours: 0, notes: '' },
  { id: 'final', label: 'Final Clean', enabled: true, sqft: 0, production_rate_sqft_hour: 800, extra_hours: 0, notes: '' },
  { id: 'touchup', label: 'Touch-Up / Punch Clean', enabled: false, sqft: 0, production_rate_sqft_hour: 2500, extra_hours: 0, notes: '' },
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

export const DEFAULT_SPECIALTY_INPUTS = (service: ServiceType): SpecialtyInputs => {
  switch (service) {
    case 'construction_cleaning':
      return {
        ...DEFAULT_FINANCIALS,
        ...DEFAULT_CONSTRUCTION_LABOR,
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
export function calculateConstruction(i: ConstructionInputs): SpecialtyOutputs {
  const rate = loaded(i);
  const phases = (i.phases || []).filter(p => p.enabled);
  const lines = phases.map(p => {
    const sqft = nn(p.sqft) || nn(i.total_square_feet);
    const prod = nn(p.production_rate_sqft_hour);
    const hours = (prod > 0 ? sqft / prod : 0) + nn(p.extra_hours);
    return line(
      p.label || 'Phase',
      hours,
      rate,
      prod > 0 ? `${sqft.toLocaleString()} sq ft @ ${prod.toLocaleString()} sq ft/hr` : undefined
    );
  });
  return price(i, lines, nn(i.total_square_feet));
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
export function hydrateSpecialtyInputs(service: ServiceType, stored: unknown): SpecialtyInputs {
  const defaults = DEFAULT_SPECIALTY_INPUTS(service) as unknown as Record<string, unknown>;
  const raw = (stored && typeof stored === 'object' ? stored : {}) as Record<string, unknown>;
  const merged = { ...defaults, ...raw } as unknown as SpecialtyInputs;
  if (service === 'construction_cleaning') {
    const c = merged as ConstructionInputs;
    if (!Array.isArray(c.phases) || c.phases.length === 0) c.phases = DEFAULT_CONSTRUCTION_PHASES();
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