import { describe, it, expect } from 'vitest';
import { approvableEvents, lastWeekStart, readyTotal, weekStartOf } from '../billing/supplyWeek';

describe('Weekly supply billing', () => {
  it('weeks start on Sunday', () => {
    expect(weekStartOf('2026-11-04')).toBe('2026-11-01'); // Wednesday
    expect(weekStartOf('2026-11-01')).toBe('2026-11-01'); // Sunday
    expect(weekStartOf('2026-11-07')).toBe('2026-11-01'); // Saturday
  });

  it('on Monday morning, last week is the Sunday–Saturday just ended', () => {
    // Monday Nov 9, 2026, 8:00 AM Eastern
    expect(lastWeekStart(new Date('2026-11-09T13:00:00Z'))).toBe('2026-11-01');
  });

  it('uses Eastern time, so late Saturday night still counts as that week', () => {
    // Sunday 02:00 UTC is still Saturday Nov 7 evening in New York
    expect(lastWeekStart(new Date('2026-11-08T02:00:00Z'))).toBe('2026-10-25');
  });

  it('Approve skips on-hold items and accounts with a warning', () => {
    const groups = [
      { skip_reason: null, events: [{ id: 'a', amount: 10, status: 'ready' }, { id: 'b', amount: 5, status: 'hold' }] },
      { skip_reason: 'No billing email on file', events: [{ id: 'c', amount: 20, status: 'ready' }] },
    ];
    expect(approvableEvents(groups).map(e => e.id)).toEqual(['a']);
  });

  it('account total counts only ready items', () => {
    expect(readyTotal({ skip_reason: null, events: [
      { id: 'a', amount: 10.1, status: 'ready' }, { id: 'b', amount: 20.2, status: 'ready' }, { id: 'c', amount: 99, status: 'hold' },
    ] })).toBe(30.3);
  });
});
