export const DIRECTORY_CATEGORIES = [
  { value: 'office_manager',       label: 'Office Manager' },
  { value: 'operations_manager',   label: 'Operations Manager' },
  { value: 'supply_manager',       label: 'Supply Manager' },
  { value: 'supply_staff',         label: 'Supply' },
  { value: 'night_manager',        label: 'Night Manager' },
  { value: 'janitorial_manager',   label: 'Janitorial Manager' },
  { value: 'construction_manager', label: 'Construction Manager' },
  { value: 'janitorial_staff',     label: 'Janitorial Staff' },
  { value: 'construction_staff',   label: 'Construction Staff' },
  { value: 'floater',              label: 'Floater' },
  { value: 'other',                label: 'Other' },
] as const;

export type DirectoryCategory = typeof DIRECTORY_CATEGORIES[number]['value'];

export const categoryLabel = (value: string | null | undefined): string => {
  if (!value) return 'Uncategorized';
  return DIRECTORY_CATEGORIES.find(c => c.value === value)?.label ?? value;
};

// Job titles that can appear as viewers in the rules matrix.
// Managers/admins already see everything, so we exclude Owner/Administrator.
export const RULE_VIEWER_JOB_TITLES = [
  'Janitorial Staff',
  'Project Worker',
  'Janitorial Manager',
  'Project Crew Lead',
  'Floaters',
  'Supply Management',
  'Supply',
  'Operations Manager',
  'Office Manager',
] as const;