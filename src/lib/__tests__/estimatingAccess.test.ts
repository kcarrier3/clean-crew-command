import { describe, it, expect } from 'vitest';
import { canUseEstimating } from '../estimatingAccess';

describe('estimating access', () => {
  it('Project Crew Lead with employee role is denied', () => {
    expect(canUseEstimating(['employee'], 'Project Crew Lead')).toBe(false);
  });
  it('Project Crew Lead with manager role (and employee) is still denied', () => {
    expect(canUseEstimating(['manager', 'employee'], 'Project Crew Lead')).toBe(false);
  });
  it('admin role overrides for a Project Crew Lead', () => {
    expect(canUseEstimating(['admin'], 'Project Crew Lead')).toBe(true);
  });
  it('other estimator titles keep access', () => {
    for (const t of ['Owner', 'Office Manager', 'Operations Manager', 'Janitorial Manager', 'Night Manager']) {
      expect(canUseEstimating(['employee'], t)).toBe(true);
    }
  });
  it('manager role still grants access to non-crew-lead titles', () => {
    expect(canUseEstimating(['manager'], 'Supply Management')).toBe(true);
  });
  it('Project Worker without manager role is denied', () => {
    expect(canUseEstimating(['employee'], 'Project Worker')).toBe(false);
  });
});
