import { describe, it, expect } from 'vitest';
import { canChangeSchedules, canPublishScheduleWeeks } from '../scheduleAccess';
import { JOB_TITLE_PERMISSIONS } from '../jobTitles';

describe('schedule editing access', () => {
  it('Project Crew Lead defaults include view but not edit/publish schedules', () => {
    const d = JOB_TITLE_PERMISSIONS['Project Crew Lead'];
    expect(d).toContain('view_schedules');
    expect(d).not.toContain('edit_schedules');
    expect(d).not.toContain('publish_schedules');
  });
  it('crew lead with manager + employee roles cannot change shifts', () => {
    expect(canChangeSchedules(['employee', 'manager'], 'Project Crew Lead')).toBe(false);
  });
  it('crew lead with admin role cannot change shifts', () => {
    expect(canChangeSchedules(['admin'], 'Project Crew Lead')).toBe(false);
  });
  it('crew lead cannot publish even with an explicit publish grant', () => {
    expect(canPublishScheduleWeeks(['manager'], 'Project Crew Lead', ['publish_schedules'])).toBe(false);
  });
  it('other managers and admins can still change shifts', () => {
    expect(canChangeSchedules(['manager'], 'Janitorial Manager')).toBe(true);
    expect(canChangeSchedules(['admin'], 'Owner')).toBe(true);
  });
  it('publishing for others is unchanged', () => {
    expect(canPublishScheduleWeeks(['admin'], 'Owner', [])).toBe(true);
    expect(canPublishScheduleWeeks(['manager'], 'Night Manager', ['publish_schedules'])).toBe(true);
    expect(canPublishScheduleWeeks(['manager'], 'Night Manager', [])).toBe(false);
  });
  it('plain employees cannot change shifts', () => {
    expect(canChangeSchedules(['employee'], 'Project Worker')).toBe(false);
  });
});
