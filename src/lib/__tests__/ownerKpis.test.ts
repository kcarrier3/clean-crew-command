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
