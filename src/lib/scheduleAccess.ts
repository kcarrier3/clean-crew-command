// Schedule editing (add/edit/delete/publish shifts). Mirrors the RESTRICTIVE
// policies on employee_schedules / schedule_weeks: Project Crew Leads can view
// schedules but never change them, regardless of manager or admin role.
export const canChangeSchedules = (roles: string[], jobTitle: string | null | undefined): boolean => {
  if (jobTitle === 'Project Crew Lead') return false;
  return roles.includes('admin') || roles.includes('manager');
};

export const canPublishScheduleWeeks = (
  roles: string[],
  jobTitle: string | null | undefined,
  permissions: string[],
): boolean => {
  if (jobTitle === 'Project Crew Lead') return false;
  return roles.includes('admin') || permissions.includes('publish_schedules');
};
