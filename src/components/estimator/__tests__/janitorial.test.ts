import { describe, it, expect } from 'vitest';
import { calculateEstimate, DEFAULT_INPUTS } from '../calc';
import {
  hydrateJanitorialInputs, janitorialOutputColumns, janitorialRevisionPayload,
  normalizeSupply, revisionDisplayPrice,
} from '../janitorial';

// Saved inputs for the MetroHealth W. 150th ASC draft (override active).
const W150 = {
  service_type: 'janitorial',
  square_feet: 6000,
  cleanings_per_week: 5,
  weeks_per_month: 4.33,
  production_rate_sqft_hour: 3500,
  minimum_visit_minutes: 0,
  labor_hours_per_visit_override: 3,
  base_wage: 15,
  labor_burden_percent: 20,
  supervision_percent: 5,
  supply_preset: 'custom',
  supply_rate_per_hour: 0,
  overhead_percent: 15,
  target_margin_percent: 20,
  periodic_floor_care_percent: 13,
  monthly_price: 0,
};

describe('normalizeSupply', () => {
  it('never reports a named preset with a zero rate', () => {
    const r = normalizeSupply('standard', 0);
    expect(r.supply_preset).toBe('standard');
    expect(r.supply_rate_per_hour).toBeCloseTo(0.55, 10);
  });

  it('keeps a saved positive rate and derives the matching preset label', () => {
    expect(normalizeSupply('custom', 0.85)).toEqual({ supply_preset: 'high', supply_rate_per_hour: 0.85 });
    expect(normalizeSupply('standard', 0.31)).toEqual({ supply_preset: 'custom', supply_rate_per_hour: 0.31 });
  });

  it('preserves custom with no rate and falls back on garbage', () => {
    expect(normalizeSupply('custom', 0)).toEqual({ supply_preset: 'custom', supply_rate_per_hour: 0 });
    expect(normalizeSupply(null, null)).toEqual({
      supply_preset: DEFAULT_INPUTS.supply_preset,
      supply_rate_per_hour: DEFAULT_INPUTS.supply_rate_per_hour,
    });
  });
});

describe('hydration + calculation', () => {
  it('lets an hours-per-visit override win over sqft production', () => {
    const inputs = hydrateJanitorialInputs({ ...W150, minimum_visit_minutes: 45 });
    const o = calculateEstimate(inputs);
    expect(o.hours_override_applied).toBe(true);
    expect(o.minimum_visit_applied).toBe(false);
    expect(o.labor_hours_per_visit).toBeCloseTo(3, 10);
    expect(o.monthly_labor_hours).toBeCloseTo(3 * 5 * 4.33, 10);
  });

  it('uses production/minimum when no override is set', () => {
    const o = calculateEstimate(hydrateJanitorialInputs({ ...W150, labor_hours_per_visit_override: 0 }));
    expect(o.hours_override_applied).toBe(false);
    expect(o.labor_hours_per_visit).toBeCloseTo(6000 / 3500, 10);
  });

  it('produces the same monthly price on the list and detail helper paths', () => {
    const detail = calculateEstimate(hydrateJanitorialInputs(W150)).monthly_price;
    const list = revisionDisplayPrice(W150);
    expect(list).toBeCloseTo(detail, 10);
    expect(list).toBeGreaterThan(0);
  });

  it('uses stored project_price for non-recurring services', () => {
    expect(revisionDisplayPrice({ service_type: 'carpet_cleaning', project_price: 1234.5 })).toBe(1234.5);
  });
});

describe('serialization', () => {
  it('persists every snapshot column', () => {
    const payload = janitorialRevisionPayload(hydrateJanitorialInputs(W150));
    for (const key of Object.keys(janitorialOutputColumns(calculateEstimate(hydrateJanitorialInputs(W150))))) {
      expect(payload).toHaveProperty(key);
      expect(Number.isFinite((payload as any)[key])).toBe(true);
    }
    expect(payload.monthly_price).toBeCloseTo(revisionDisplayPrice(W150), 10);
  });

  it('round-trips: saved payload rehydrates to the same price', () => {
    const payload = janitorialRevisionPayload(hydrateJanitorialInputs(W150));
    const again = calculateEstimate(hydrateJanitorialInputs(payload)).monthly_price;
    expect(again).toBeCloseTo(payload.monthly_price, 8);
  });
});
