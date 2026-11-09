/** Preserve the dashboard's role-based shortcuts across tab and routed pages. */
export function mobileNavigationKeys(isManager: boolean, isSupplyStaff: boolean): string[] {
  return isManager
    ? ['dashboard', 'scheduling', 'managerlog', isSupplyStaff ? 'supplies' : 'quality']
    : ['dashboard', 'myschedule', isSupplyStaff ? 'supplies' : 'timeoff', 'messages'];
}