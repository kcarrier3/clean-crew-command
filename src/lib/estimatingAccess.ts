// Estimating access. Mirrors public.can_estimate() in the database.
// Project Crew Leads are denied even with the manager role; only admin overrides.
export const ESTIMATOR_JOB_TITLES = [
  'Owner',
  'Office Manager',
  'Operations Manager',
  'Janitorial Manager',
  'Night Manager',
];

export const canUseEstimating = (roles: string[], jobTitle: string | null | undefined): boolean => {
  if (roles.includes('admin')) return true;
  if (jobTitle === 'Project Crew Lead') return false;
  return roles.includes('manager') || (!!jobTitle && ESTIMATOR_JOB_TITLES.includes(jobTitle));
};
