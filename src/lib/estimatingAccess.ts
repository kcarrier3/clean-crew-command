// Estimating access. Mirrors public.can_estimate() in the database.
// Project Crew Leads are always denied — no manager or admin override.
export const ESTIMATOR_JOB_TITLES = [
  'Owner',
  'Office Manager',
  'Operations Manager',
  'Janitorial Manager',
  'Night Manager',
];

export const canUseEstimating = (roles: string[], jobTitle: string | null | undefined): boolean => {
  if (jobTitle === 'Project Crew Lead') return false;
  return roles.includes('admin') || roles.includes('manager') || (!!jobTitle && ESTIMATOR_JOB_TITLES.includes(jobTitle));
};
