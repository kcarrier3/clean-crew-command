import { describe, it, expect } from 'vitest';
import { calculateConstruction, DEFAULT_SPECIALTY_INPUTS, hydrateSpecialtyInputs, type ConstructionInputs } from '@/components/estimator/specialtyCalc';

const base = () => ({
  ...(DEFAULT_SPECIALTY_INPUTS('construction_cleaning') as ConstructionInputs),
  total_square_feet: 20000,
  base_wage: 18, labor_burden_percent: 20, overhead_percent: 15, target_margin_percent: 25,
  supply_rate_per_hour: 0.5, equipment_cost: 500,
  phases: [{ id: 'final', label: 'Final Clean', enabled: true, sqft: 20000, production_rate_sqft_hour: 800, extra_hours: 0, notes: '' }],
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
    const o = calculateConstruction(h);
    expect(o.total_direct_cost).toBeCloseTo(540 + 300 + 200 + 500);
  });
});
