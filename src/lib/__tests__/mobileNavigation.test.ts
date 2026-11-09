import { describe, expect, it } from 'vitest';
import { mobileNavigationKeys } from '../../components/layout/mobileNavigation';

describe('role-based mobile shortcuts', () => {
  it('keeps manager schedule, log and quality shortcuts', () => {
    expect(mobileNavigationKeys(true, false)).toEqual(['dashboard', 'scheduling', 'managerlog', 'quality']);
  });
  it('keeps worker schedule, time off and messaging shortcuts', () => {
    expect(mobileNavigationKeys(false, false)).toEqual(['dashboard', 'myschedule', 'timeoff', 'messages']);
  });
  it('uses supplies instead of quality or time off for supply staff', () => {
    expect(mobileNavigationKeys(true, true)).toEqual(['dashboard', 'scheduling', 'managerlog', 'supplies']);
    expect(mobileNavigationKeys(false, true)).toEqual(['dashboard', 'myschedule', 'supplies', 'messages']);
  });
});