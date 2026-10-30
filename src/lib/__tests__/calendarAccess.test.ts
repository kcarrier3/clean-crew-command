import { describe, it, expect } from 'vitest';
import { canUseCalendar } from '../calendarAccess';
import { JOB_TITLE_PERMISSIONS } from '../jobTitles';
import { buildNavItems } from '@/components/layout/navItems';

const hasCalendar = (canViewCalendar: boolean, isManager = true) =>
  buildNavItems({ isManager, isCrmUser: false, canEstimate: false, canViewCalendar }).some(i => i.v === 'calendar');

describe('planning calendar access', () => {
  it('Project Crew Leads do not get the planning calendar by default', () => {
    expect(JOB_TITLE_PERMISSIONS['Project Crew Lead']).not.toContain('view_calendar');
  });

  it('a manager without the switch has no Calendar in the menu', () => {
    expect(canUseCalendar(false, ['view_schedules'])).toBe(false);
    expect(hasCalendar(false)).toBe(false);
  });

  it('a manager with the switch turned on sees the Calendar', () => {
    expect(canUseCalendar(false, ['view_calendar'])).toBe(true);
    expect(hasCalendar(true)).toBe(true);
  });

  it('admins always have the planning calendar', () => {
    expect(canUseCalendar(true, [])).toBe(true);
  });
});
