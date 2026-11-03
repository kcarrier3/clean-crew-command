import { describe, it, expect } from 'vitest';
import { monthlyHoursForSchedule } from '../serviceFrequency';

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
