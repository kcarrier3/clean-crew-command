import { describe, it, expect } from 'vitest';
import { lastClosedPayPeriod, needsFollowUp, DEFAULT_COURT_SETTINGS } from '../inYourCourt';

const b = DEFAULT_COURT_SETTINGS.billing;

describe('In your court', () => {
  it('pay week Sun–Sat closes at 12:00 am Sunday', () => {
    // Sunday Nov 22 2026, 12:00 am → closed week is Nov 15–21
    expect(lastClosedPayPeriod(new Date(2026, 10, 22, 0, 0))).toEqual({ start: '2026-11-15', end: '2026-11-21' });
    // Saturday 11:59 pm Nov 21 → still previous closed week Nov 8–14
    expect(lastClosedPayPeriod(new Date(2026, 10, 21, 23, 59))).toEqual({ start: '2026-11-08', end: '2026-11-14' });
  });
  it('janitorial customers are followed up at 5 days past due', () => {
    expect(needsFollowUp('2026-11-20', true, b, new Date(2026, 10, 24))).toBe(false);
    expect(needsFollowUp('2026-11-20', true, b, new Date(2026, 10, 25))).toBe(true);
  });
  it('construction customers are followed up at 15 days past due', () => {
    expect(needsFollowUp('2026-11-10', false, b, new Date(2026, 10, 24))).toBe(false);
    expect(needsFollowUp('2026-11-10', false, b, new Date(2026, 10, 25))).toBe(true);
  });
});
