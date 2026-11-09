import { describe, expect, it } from 'vitest';
import { buildNavItems } from '../../components/layout/navItems';

describe('calendar navigation access preservation', () => {
  it('does not grant a manager planning access through the calendar group', () => {
    const items = buildNavItems({ isManager: true, isCrmUser: false, canEstimate: false, canViewCalendar: false });
    expect(items.find(item => item.v === 'calendars')?.children?.map(item => item.v)).toEqual(['newaccountcalendar', 'trainingplanner']);
  });

  it('preserves planning-only access for non-managers', () => {
    const items = buildNavItems({ isManager: false, isCrmUser: false, canEstimate: false, canViewCalendar: true });
    expect(items.find(item => item.v === 'calendars')?.children?.map(item => item.v)).toEqual(['calendar']);
  });

  it('omits the group when all calendar modules are disabled', () => {
    const items = buildNavItems({ isManager: true, isCrmUser: false, canEstimate: false, canViewCalendar: true,
      isModuleEnabled: key => !['calendar', 'trainingplanner', 'newaccountcalendar'].includes(key) });
    expect(items.some(item => item.v === 'calendars')).toBe(false);
  });
});