import { describe, it, expect } from 'vitest';
import { hoursAllowedToDate, monthlyHoursForSchedule } from '../serviceFrequency';

// November 2026 has 5 Mondays and 4 each of Tue, Wed, Thu, Fri.
const NOV_2026 = new Date(2026, 10, 15);
const MON_FRI = [1, 2, 3, 4, 5];

describe('variable hours by night', () => {
  it('adds each night at its own hours', () => {
    // Mon 4h ×5 + Tue 3h ×4 + Wed 3h ×4 + Thu 3h ×4 + Fri 2h ×4 = 64
    const byDay = [0, 4, 3, 3, 3, 2, 0];
    expect(monthlyHoursForSchedule(null, byDay, MON_FRI, NOV_2026)).toBe(64);
  });
  it('ignores hours typed for nights that are not service days', () => {
    const byDay = [5, 4, 3, 3, 3, 2, 5];
    expect(monthlyHoursForSchedule(null, byDay, MON_FRI, NOV_2026)).toBe(64);
  });
  it('per-night hours replace the flat nightly allowance', () => {
    expect(monthlyHoursForSchedule(10, [0, 1, 1, 1, 1, 1, 0], MON_FRI, NOV_2026)).toBe(21);
  });
  it('flat allowance still works when per-night hours are off', () => {
    // 3h × 21 weeknights
    expect(monthlyHoursForSchedule(3, null, MON_FRI, NOV_2026)).toBe(63);
  });
  it('no service days means no monthly figure', () => {
    expect(monthlyHoursForSchedule(null, [0, 4, 3, 3, 3, 2, 0], [], NOV_2026)).toBeNull();
  });
});

describe('monthly budget comes from the nightly allowance', () => {
  it('a month with more service nights gets more hours', () => {
    // 3h every Monday: November 2026 has 5 Mondays, December 2026 has 4.
    expect(monthlyHoursForSchedule(3, null, [1], new Date(2026, 10, 1))).toBe(15);
    expect(monthlyHoursForSchedule(3, null, [1], new Date(2026, 11, 1))).toBe(12);
  });
  it('allowed-so-far counts only service nights through today', () => {
    // Nov 1-10 2026, Mon-Fri: Mon 2,9 Tue 3,10 Wed 4 Thu 5 Fri 6 = 7 nights × 4h
    expect(hoursAllowedToDate(4, null, MON_FRI, new Date(2026, 10, 10))).toBe(28);
  });
  it('allowed-so-far uses each night\'s own hours', () => {
    // Mon 4h ×2 + Tue 3h ×2 + Wed 3h + Thu 3h + Fri 2h = 22
    expect(hoursAllowedToDate(null, [0, 4, 3, 3, 3, 2, 0], MON_FRI, new Date(2026, 10, 10))).toBe(22);
  });
  it('no allowance means no pace figure', () => {
    expect(hoursAllowedToDate(null, null, MON_FRI, NOV_2026)).toBeNull();
  });
});
