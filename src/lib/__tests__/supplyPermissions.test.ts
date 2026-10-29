import { describe, expect, it } from 'vitest';
import { getSupplyAccess } from '@/lib/supplyPermissions';

describe('getSupplyAccess', () => {
  it('lets Supply Management price supplies without the manager role', () => {
    const access = getSupplyAccess(false, 'Supply Management');
    expect(access.canPrice).toBe(true);
    expect(access.canManage).toBe(true);
    expect(access.canViewReports).toBe(true);
  });

  it('lets Owner, Office Manager, and Operations Manager change supply prices', () => {
    for (const title of ['Owner', 'Office Manager', 'Operations Manager']) {
      expect(getSupplyAccess(false, title).canPrice).toBe(true);
    }
  });

  it('does not treat the manager role or other titles as supply pricing', () => {
    expect(getSupplyAccess(true, 'Janitorial Manager').canPrice).toBe(false);
    expect(getSupplyAccess(true, 'Project Crew Lead').canPrice).toBe(false);
    expect(getSupplyAccess(true, 'Supply').canPrice).toBe(false);
    expect(getSupplyAccess(true, null).canPrice).toBe(false);
  });

  it('still lets supply staff operate inventory', () => {
    const access = getSupplyAccess(false, 'Supply');
    expect(access.canManage).toBe(true);
    expect(access.canViewReports).toBe(false);
    expect(access.canPrice).toBe(false);
  });
});
