import { describe, it, expect } from 'vitest';
import { diffPermissions, lockedPermissionReason } from '../teamPermissions';

const manager = { memberJobTitle: 'Janitorial Staff', editorIsAdmin: false, editingSelf: false };
const admin = { memberJobTitle: 'Janitorial Staff', editorIsAdmin: true, editingSelf: false };

describe('Team member permission editing', () => {
  it('a manager can add or remove ordinary permissions for someone else', () => {
    expect(lockedPermissionReason('view_work_orders', manager)).toBeNull();
  });
  it('a non-admin cannot change their own permissions', () => {
    expect(lockedPermissionReason('view_work_orders', { ...manager, editingSelf: true })).not.toBeNull();
  });
  it('an admin can change their own permissions', () => {
    expect(lockedPermissionReason('view_work_orders', { ...admin, editingSelf: true })).toBeNull();
  });
  it('only admins can change Admin Settings and Manage Employees', () => {
    expect(lockedPermissionReason('admin_settings', manager)).not.toBeNull();
    expect(lockedPermissionReason('manage_employees', manager)).not.toBeNull();
    expect(lockedPermissionReason('admin_settings', admin)).toBeNull();
  });
  it('only admins can give someone Approve Supply Billing, since it emails invoices', () => {
    expect(lockedPermissionReason('approve_supply_billing', manager)).not.toBeNull();
    expect(lockedPermissionReason('approve_supply_billing', admin)).toBeNull();
  });
  it('Project Crew Leads cannot be given schedule editing, even by an admin', () => {
    const crewLead = { ...admin, memberJobTitle: 'Project Crew Lead' };
    expect(lockedPermissionReason('edit_schedules', crewLead)).not.toBeNull();
    expect(lockedPermissionReason('publish_schedules', crewLead)).not.toBeNull();
    expect(lockedPermissionReason('view_schedules', crewLead)).toBeNull();
  });
  it('saving only adds new checks and removes unchecked ones', () => {
    expect(diffPermissions(['view_schedules', 'view_work_orders'], ['view_schedules', 'view_crm'])).toEqual({
      add: ['view_crm'],
      remove: ['view_work_orders'],
    });
  });
});
