import { describe, it, expect } from 'vitest';
import {
  calculateConstruction, DEFAULT_SPECIALTY_INPUTS, hydrateSpecialtyInputs,
  suggestedDayRate, type ConstructionInputs,
} from '@/components/estimator/specialtyCalc';

const base = () => ({
  ...(DEFAULT_SPECIALTY_INPUTS('construction_cleaning') as ConstructionInputs),
  crew_day_mode: false,
  total_square_feet: 20000,
  base_wage: 18, labor_burden_percent: 20, overhead_percent: 15, target_margin_percent: 25,
  supply_rate_per_hour: 0.5, equipment_cost: 500,
  phases: [{ id: 'final', label: 'Final Clean', enabled: true, sqft: 20000, production_rate_sqft_hour: 800, extra_hours: 0, notes: '' }],
});

const crewBase = () => ({
  ...(DEFAULT_SPECIALTY_INPUTS('construction_cleaning') as ConstructionInputs),
  total_square_feet: 20000,
  base_wage: 18, labor_burden_percent: 20, overhead_percent: 15, target_margin_percent: 25,
  supply_rate_per_hour: 0.5, equipment_cost: 500,
  phases: [],
});

describe('construction', () => {
  it('standard wage', () => {
    const o = calculateConstruction(base());
    expect(o.labor_hours).toBeCloseTo(25);
    expect(o.loaded_labor_rate).toBeCloseTo(21.6);
    expect(o.labor_cost).toBeCloseTo(540);
    expect(o.supply_cost).toBeCloseTo(12.5);
    expect(o.materials_cost).toBe(0);
    expect(o.total_direct_cost).toBeCloseTo(1052.5);
    expect(o.project_price).toBeCloseTo(1052.5 / 0.6);
    expect(o.gross_margin_percent).toBeCloseTo(40);
    const lb = o.labor_budget!;
    expect(lb.max_hours_at_target_margin).toBeCloseTo(25);
    expect(lb.breakeven_hours).toBeCloseTo((o.project_price * 0.85 - 500) / 22.1);
  });
  it('prevailing wage', () => {
    const o = calculateConstruction({ ...base(), prevailing_wage_project: true, union_project: true, prevailing_base_wage: 30, prevailing_fringe_per_hour: 12, prevailing_additional_burden_per_hour: 1 });
    expect(o.loaded_labor_rate).toBeCloseTo(30 + 6 + 12 + 1);
    expect(o.labor_cost).toBeCloseTo(25 * 49);
    expect(o.total_direct_cost).toBeCloseTo(1225 + 12.5 + 500);
    expect(o.project_price).toBeCloseTo(1737.5 / 0.6);
    expect(o.labor_budget!.max_hours_at_target_margin).toBeCloseTo(25);
  });
  it('legacy estimate preserved', () => {
    const h = hydrateSpecialtyInputs('construction_cleaning', { total_square_feet: 20000, base_wage: 18, labor_burden_percent: 20, overhead_percent: 15, target_margin_percent: 25, materials_cost: 300, materials_cost_per_sqft: 0.01, equipment_cost: 500, phases: base().phases }) as ConstructionInputs;
    expect(h.supply_rate_per_hour).toBe(0);
    expect(h.crew_day_mode).toBe(false);
    const o = calculateConstruction(h);
    expect(o.total_direct_cost).toBeCloseTo(540 + 300 + 200 + 500);
  });
});

describe('construction crew-day model', () => {
  it('apartments baseline, typical complexity', () => {
    const o = calculateConstruction({ ...crewBase(), project_type: 'apartments', baseline_sqft_per_crew_day: 5000, complexity: 'typical' });
    const dm = o.day_model!;
    expect(dm.adjusted_sqft_per_crew_day).toBeCloseTo(5000);
    expect(dm.crew_days).toBeCloseTo(4);
    expect(dm.labor_hours).toBeCloseTo(32);
    expect(o.labor_cost).toBeCloseTo(32 * 21.6);
    expect(o.total_direct_cost).toBeCloseTo(32 * 21.6 + 32 * 0.5 + 500);
    expect(o.project_price).toBeCloseTo(o.total_direct_cost / 0.6);
    expect(dm.status).toBe('target');
  });

  it('open office buildout at 7,500 sq ft/day', () => {
    const dm = calculateConstruction({ ...crewBase(), project_type: 'open_office', baseline_sqft_per_crew_day: 7500 }).day_model!;
    expect(dm.crew_days).toBeCloseTo(20000 / 7500);
    expect(dm.labor_hours).toBeCloseTo((20000 / 7500) * 8);
  });

  it('dense restaurant with dense complexity', () => {
    const dm = calculateConstruction({ ...crewBase(), project_type: 'dense_restaurant', baseline_sqft_per_crew_day: 2500, complexity: 'dense' }).day_model!;
    expect(dm.complexity_multiplier).toBe(0.6);
    expect(dm.adjusted_sqft_per_crew_day).toBeCloseTo(1500);
    expect(dm.crew_days).toBeCloseTo(20000 / 1500);
  });

  it('complexity multipliers and manual override', () => {
    const mk = (c: ConstructionInputs['complexity']) =>
      calculateConstruction({ ...crewBase(), baseline_sqft_per_crew_day: 5000, complexity: c }).day_model!;
    expect(mk('very_open').adjusted_sqft_per_crew_day).toBeCloseTo(6500);
    expect(mk('open').adjusted_sqft_per_crew_day).toBeCloseTo(5750);
    expect(mk('detailed').adjusted_sqft_per_crew_day).toBeCloseTo(4000);
    const over = calculateConstruction({ ...crewBase(), baseline_sqft_per_crew_day: 5000, complexity: 'dense', adjusted_sqft_per_crew_day_override: 4000 }).day_model!;
    expect(over.production_overridden).toBe(true);
    expect(over.crew_days).toBeCloseTo(5);
  });

  it('day-rate pricing, effective rate and status', () => {
    const i = { ...crewBase(), baseline_sqft_per_crew_day: 5000, proposed_day_rate: 450, price_basis: 'day_rate' as const };
    const o = calculateConstruction(i);
    const dm = o.day_model!;
    expect(dm.day_rate_project_price).toBeCloseTo(1800);
    expect(o.project_price).toBeCloseTo(1800);
    expect(dm.effective_day_rate).toBeCloseTo(450);
    expect(dm.target_margin_price).toBeCloseTo((32 * 21.6 + 16 + 500) / 0.6);
    expect(dm.status).toBe('below_target');
    expect(dm.breakeven_price).toBeCloseTo(o.total_direct_cost / 0.85);
    expect(o.profit_amount).toBeCloseTo(1800 - o.total_direct_cost - 1800 * 0.15);

    const rich = calculateConstruction({ ...i, proposed_day_rate: 3000 }).day_model!;
    expect(rich.status).toBe('target');
    const bad = calculateConstruction({ ...i, proposed_day_rate: 300 }).day_model!;
    expect(bad.status).toBe('below_breakeven');
  });

  it('manual price yields effective day rate', () => {
    const dm = calculateConstruction({ ...crewBase(), baseline_sqft_per_crew_day: 5000, price_basis: 'manual', manual_project_price: 10000 }).day_model!;
    expect(dm.final_project_price).toBeCloseTo(10000);
    expect(dm.effective_day_rate).toBeCloseTo(2500);
  });

  it('prevailing wage raises cost-based price, not duration', () => {
    const std = calculateConstruction({ ...crewBase(), baseline_sqft_per_crew_day: 5000 });
    const pw = calculateConstruction({
      ...crewBase(), baseline_sqft_per_crew_day: 5000,
      prevailing_wage_project: true, union_project: true,
      prevailing_base_wage: 30, prevailing_fringe_per_hour: 12, prevailing_additional_burden_per_hour: 1,
    });
    expect(pw.day_model!.crew_days).toBeCloseTo(std.day_model!.crew_days);
    expect(pw.loaded_labor_rate).toBeCloseTo(49);
    expect(pw.labor_cost).toBeCloseTo(32 * 49);
    expect(pw.total_direct_cost).toBeCloseTo(32 * 49 + 16 + 500);
    expect(pw.project_price).toBeCloseTo(pw.total_direct_cost / 0.6);
    expect(pw.project_price).toBeGreaterThan(std.project_price);
    expect(pw.day_model!.labor_hours).toBeCloseTo(32);
  });

  it('suggested day rate scale', () => {
    expect(suggestedDayRate('need_work', 800, 1600)).toBeCloseTo(800);
    expect(suggestedDayRate('normal', 800, 1600)).toBeCloseTo(1200);
    expect(suggestedDayRate('very_busy', 800, 1600)).toBeCloseTo(1600);
  });
});
