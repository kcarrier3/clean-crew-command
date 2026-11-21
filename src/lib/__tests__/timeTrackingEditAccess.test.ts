import { describe, it, expect } from 'vitest';
import { JOB_TITLE_PERMISSIONS, JOB_TITLES } from '../jobTitles';

// Rule: only Owner, Office Manager, and Operations Manager may edit time tracking.
const ALLOWED = ['Owner', 'Office Manager', 'Operations Manager'];

describe('Time tracking edit access by position', () => {
  it('Owner, Office Manager, and Operations Manager can edit time tracking', () => {
    for (const title of ALLOWED) {
      expect(JOB_TITLE_PERMISSIONS[title as keyof typeof JOB_TITLE_PERMISSIONS]).toContain('edit_time_tracking');
    }
  });

  it('no other position defaults to editing time tracking', () => {
    for (const title of JOB_TITLES) {
      if (ALLOWED.includes(title)) continue;
      expect(JOB_TITLE_PERMISSIONS[title]).not.toContain('edit_time_tracking');
    }
  });
});
