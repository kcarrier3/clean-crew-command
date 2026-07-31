// Centralized supply-area permission helpers.
// Supply Management = full manager rights inside the supply area.
// Supply = operational rights (stock, requests, locations, assets, item costs) but no reports.

export const SUPPLY_MANAGER_TITLES = ['Supply Management'];
export const SUPPLY_STAFF_TITLES = ['Supply'];

const ORG_MANAGER_TITLES = [
  'Owner',
  'Office Manager',
  'Operations Manager',
  'Janitorial Manager',
  'Project Crew Lead',
];

export type SupplyAccess = {
  /** Can operate day-to-day supply functions: stock, movements, requests, locations, assets, item costs. */
  canManage: boolean;
  /** Can view supply cost & billing reports. */
  canViewReports: boolean;
};

export function getSupplyAccess(isManager: boolean, jobTitle?: string | null): SupplyAccess {
  const title = jobTitle ?? '';
  const isSupplyManager = SUPPLY_MANAGER_TITLES.includes(title);
  const isSupplyStaff = SUPPLY_STAFF_TITLES.includes(title);
  const isOrgManager = isManager || ORG_MANAGER_TITLES.includes(title);

  return {
    canManage: isOrgManager || isSupplyManager || isSupplyStaff,
    canViewReports: isOrgManager || isSupplyManager,
  };
}
