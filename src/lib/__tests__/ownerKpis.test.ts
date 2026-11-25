import { describe, it, expect } from 'vitest';
import { arSplit, avgDaysToPay, avgWorkOrderHours } from '../ownerKpis';
const now = new Date('2026-11-25T12:00:00');
const inv = (o: any) => ({ status: 'sent', invoice_date: '2026-10-01', due_date: '2026-11-30', total: 100, balance_due: 100, paid_at: null, ...o });
describe('owner KPIs', () => {
  it('splits past due vs current by balance', () => {
    const r = arSplit([inv({}), inv({ due_date: '2026-11-01', balance_due: 300 }), inv({ status: 'void', due_date: '2026-01-01' })], now);
    expect(r.pastPct).toBe(75); expect(r.currentPct).toBe(25);
  });
  it('averages days to pay', () => {
    expect(avgDaysToPay([inv({ status: 'paid', paid_at: '2026-10-31T00:00:00', balance_due: 0 })], now)).toBe(30);
  });
  it('averages work order hours from created to completed', () => {
    expect(avgWorkOrderHours([{ created_at: '2026-11-01T00:00:00Z', completed_at: '2026-11-02T00:00:00Z' }, { created_at: '2026-11-01T00:00:00Z', completed_at: null }])).toEqual({ hours: 24, count: 1 });
  });
});

import { budgetVsActual, onTimePct, retentionPct } from '../ownerKpis';
describe('operations KPIs', () => {
  it('splits budget vs actual by janitorial and construction', () => {
    const sites = [
      { is_recurring_monthly: true, budgeted_hours: 100, used_hours: 999, current_month_used_hours: 50 },
      { is_recurring_monthly: false, budgeted_hours: 200, used_hours: 250, current_month_used_hours: 0 },
    ];
    expect(budgetVsActual(sites, true)).toMatchObject({ budgeted: 100, actual: 50, pct: 50, over: 0 });
    expect(budgetVsActual(sites, false)).toMatchObject({ budgeted: 200, actual: 250, over: 1 });
  });
  it('counts on-time work orders', () => {
    expect(onTimePct([{ completed_at: '2026-11-10T10:00:00Z', due_date: '2026-11-10' }, { completed_at: '2026-11-12T10:00:00Z', due_date: '2026-11-10' }])).toBe(50);
  });
  it('retention counts staff hired a year or more ago', () => {
    expect(retentionPct([{ hire_date: '2025-01-01', active: true }, { hire_date: '2025-01-01', active: false }, { hire_date: '2026-10-01', active: false }], new Date('2026-11-25'))).toEqual({ pct: 50, count: 2 });
  });
});
