// Job titles and their default permissions

export const JOB_TITLES = [
  'Manager',
  'Supervisor',
  'Project Worker',
  'Janitorial Staff',
  'Floaters',
  'Supply Management',
] as const;

export type JobTitle = typeof JOB_TITLES[number];

// Permission mapping for each job title
export const JOB_TITLE_PERMISSIONS: Record<JobTitle, string[]> = {
  'Manager': [
    'view_schedules',
    'edit_schedules',
    'view_time_tracking',
    'edit_time_tracking',
    'view_work_orders',
    'create_work_orders',
    'edit_work_orders',
    'view_quality_control',
    'edit_quality_control',
    'view_worker_status',
    'manage_employees',
    'view_notifications',
  ],
  'Supervisor': [
    'view_schedules',
    'edit_schedules',
    'view_time_tracking',
    'edit_time_tracking',
    'view_work_orders',
    'create_work_orders',
    'edit_work_orders',
    'view_quality_control',
    'edit_quality_control',
    'view_worker_status',
    'view_notifications',
  ],
  'Project Worker': [
    'view_schedules',
    'view_time_tracking',
    'edit_time_tracking',
    'view_work_orders',
    'view_notifications',
  ],
  'Janitorial Staff': [
    'view_schedules',
    'view_time_tracking',
    'edit_time_tracking',
    'view_work_orders',
    'view_notifications',
  ],
  'Floaters': [
    'view_schedules',
    'view_time_tracking',
    'edit_time_tracking',
    'view_work_orders',
    'view_notifications',
  ],
  'Supply Management': [
    'view_schedules',
    'view_time_tracking',
    'edit_time_tracking',
    'view_work_orders',
    'view_notifications',
  ],
};

// Get the display color for a job title (matching WeeklyScheduleView)
export const getJobTitleColor = (jobTitle: string) => {
  const colorMap: Record<string, { bg: string; border: string; text: string }> = {
    'Manager': { bg: 'bg-red-100', border: 'border-red-300', text: 'text-red-800' },
    'Supervisor': { bg: 'bg-orange-100', border: 'border-orange-300', text: 'text-orange-800' },
    'Project Worker': { bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-800' },
    'Janitorial Staff': { bg: 'bg-green-100', border: 'border-green-300', text: 'text-green-800' },
    'Floaters': { bg: 'bg-purple-100', border: 'border-purple-300', text: 'text-purple-800' },
    'Supply Management': { bg: 'bg-gray-100', border: 'border-gray-300', text: 'text-gray-800' },
  };
  
  return colorMap[jobTitle] || { bg: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-800' };
};
