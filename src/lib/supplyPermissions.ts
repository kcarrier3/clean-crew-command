// Centralized supply-area permission helpers.
// Supply Management = full manager rights inside the supply area.
// Supply = operational rights (stock, requests, locations, assets) but no price-list edits and no reports.

export const SUPPLY_MANAGER_TITLES = ['Supply Management'];
export const SUPPLY_STAFF_TITLES = ['Supply'];

/** Price list and cost history. Not the manager role and not billing access. */
export const SUPPLY_PRICING_TITLES = [
  'Supply Management',
  'Owner',
  'Office Manager',
  'Operations Manager',
];

const ORG_MANAGER_TITLES = [
  'Owner',
  'Office Manager',
  'Operations Manager',
  'Janitorial Manager',
  'Project Crew Lead',
];

export type SupplyAccess = {
  /** Can operate day-to-day supply functions: stock, movements, requests, locations, assets. */
  canManage: boolean;
  /** Can view supply cost & billing reports. */
  canViewReports: boolean;
  /** Can change item cost, markup, and sale price, and open cost history. */
  canPrice: boolean;
};

export function getSupplyAccess(isManager: boolean, jobTitle?: string | null): SupplyAccess {
  const title = jobTitle ?? '';
  const isSupplyManager = SUPPLY_MANAGER_TITLES.includes(title);
  const isSupplyStaff = SUPPLY_STAFF_TITLES.includes(title);
  const isOrgManager = isManager || ORG_MANAGER_TITLES.includes(title);

  return {
    canManage: isOrgManager || isSupplyManager || isSupplyStaff,
    canViewReports: isOrgManager || isSupplyManager,
    canPrice: SUPPLY_PRICING_TITLES.includes(title),
  };
}
