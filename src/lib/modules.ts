/**
 * Company-wide toggleable modules. Keys match the navigation values used in
 * Index.tsx / navItems.ts. "dashboard" is intentionally not toggleable.
 */
export interface ModuleDef {
  key: string;
  label: string;
  description: string;
  /** Route prefixes that should be blocked when the module is off. */
  routes?: string[];
}

export const APP_MODULES: ModuleDef[] = [
  { key: 'scheduling', label: 'Schedule', description: 'Manager scheduling dashboard and weekly schedule.' },
  { key: 'myschedule', label: 'My Schedule', description: 'Employee view of their own shifts.' },
  { key: 'calendar', label: 'Calendar', description: 'Customer/service calendar planner.' },
  { key: 'managerlog', label: 'Manager Log', description: 'Nightly manager reports and log entries.' },
  { key: 'jobsites', label: 'Accounts', description: 'Job sites, budgets, and account management.' },
  { key: 'billing', label: 'Billing', description: 'Invoicing, payments, and check intake.' },
  { key: 'quality', label: 'Quality Control', description: 'Inspections and quality reporting.' },
  { key: 'team', label: 'Team', description: 'Team directory and employee management.' },
  { key: 'documents', label: 'Documents', description: 'Document builder and onboarding packets.' },
  { key: 'crm', label: 'Waypoint', description: 'CRM: accounts, contacts, and opportunities.', routes: ['/crm'] },
  { key: 'estimating', label: 'Estimating', description: 'Janitorial and construction estimator.', routes: ['/estimating'] },
  { key: 'supplies', label: 'Supplies', description: 'Inventory, stock, and fixed assets.' },
  { key: 'messages', label: 'Messaging', description: 'Internal messaging center.' },
  { key: 'timeoff', label: 'Time Off', description: 'Time off requests and PTO balances.' },
  { key: 'contacts', label: 'Contacts', description: 'Company contact directory.' },
  { key: 'onboarding', label: 'Onboarding & Docs', description: 'New hire onboarding center.' },
];

export const MODULE_SETTINGS_KEY = 'disabled_modules';

/** Returns the module whose routes match the given pathname, if any. */
export const moduleForPath = (pathname: string): ModuleDef | undefined =>
  APP_MODULES.find((m) => m.routes?.some((r) => pathname === r || pathname.startsWith(`${r}/`)));
