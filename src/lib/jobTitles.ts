// Job titles and their default permissions

export const JOB_TITLES = [
  'Owner',
  'Office Manager',
  'Operations Manager',
  'Janitorial Manager',
  'Night Manager',
  'Project Crew Lead',
  'Project Worker',
  'Janitorial Staff',
  'Floaters',
  'Supply Management',
  'Supply',
] as const;

export type JobTitle = typeof JOB_TITLES[number];

// Permission mapping for each job title
export const JOB_TITLE_PERMISSIONS: Record<JobTitle, string[]> = {
  'Owner': [
    // Full access to everything
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
  'Office Manager': [
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
  'Janitorial Manager': [
    // Manages janitorial staff - can view/edit schedules, work orders, quality control
    'view_schedules',
    'edit_schedules',
    'view_work_orders',
    'create_work_orders',
    'edit_work_orders',
    'view_quality_control',
    'edit_quality_control',
    'view_notifications',
  ],
  'Project Crew Lead': [
    // Manages project workers - can view/edit schedules, work orders, quality control
    'view_schedules',
    'edit_schedules',
    'view_work_orders',
    'create_work_orders',
    'edit_work_orders',
    'view_quality_control',
    'edit_quality_control',
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
    'view_quality_control', // Floaters can access job site details even if not scheduled
  ],
  'Supply Management': [
    'view_schedules',
    'view_time_tracking',
    'edit_time_tracking',
    'view_work_orders',
    'view_notifications',
  ],
  'Supply': [
    'view_schedules',
    'view_time_tracking',
    'edit_time_tracking',
    'view_work_orders',
    'view_notifications',
  ],
  'Operations Manager': [
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
  'Night Manager': [
    'view_schedules',
    'edit_schedules',
    'view_time_tracking',
    'edit_time_tracking',
    'view_work_orders',
    'create_work_orders',
    'edit_work_orders',
    'view_worker_status',
    'view_notifications',
  ],
};

// Get the display color for a job title (matching WeeklyScheduleView)
export const getJobTitleColor = (jobTitle: string) => {
  const colorMap: Record<string, { bg: string; border: string; text: string }> = {
    'Owner': { bg: 'bg-violet-100', border: 'border-violet-300', text: 'text-violet-800' },
    'Office Manager': { bg: 'bg-indigo-100', border: 'border-indigo-300', text: 'text-indigo-800' },
    'Janitorial Manager': { bg: 'bg-emerald-100', border: 'border-emerald-300', text: 'text-emerald-800' },
    'Project Crew Lead': { bg: 'bg-sky-100', border: 'border-sky-300', text: 'text-sky-800' },
    'Project Worker': { bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-800' },
    'Janitorial Staff': { bg: 'bg-green-100', border: 'border-green-300', text: 'text-green-800' },
    'Floaters': { bg: 'bg-purple-100', border: 'border-purple-300', text: 'text-purple-800' },
    'Supply Management': { bg: 'bg-gray-100', border: 'border-gray-300', text: 'text-gray-800' },
    'Supply': { bg: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-800' },
    'Operations Manager': { bg: 'bg-amber-100', border: 'border-amber-300', text: 'text-amber-800' },
  };
  
  return colorMap[jobTitle] || { bg: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-800' };
};

// Get the department/team that a job title belongs to
export const getJobTitleDepartment = (jobTitle: string): 'janitorial' | 'construction' | 'management' | 'other' => {
  const departmentMap: Record<string, 'janitorial' | 'construction' | 'management' | 'other'> = {
    'Janitorial Manager': 'janitorial',
    'Janitorial Staff': 'janitorial',
    'Project Crew Lead': 'construction',
    'Project Worker': 'construction',
    'Owner': 'management',
    'Office Manager': 'management',
    'Operations Manager': 'management',
    'Floaters': 'other',
    'Supply Management': 'other',
  };
  
  return departmentMap[jobTitle] || 'other';
};

// Check if a user is a manager of a specific department
export const isManagerOfDepartment = (managerTitle: string | null, department: 'janitorial' | 'construction'): boolean => {
  if (!managerTitle) return false;
  
  // Owners and Administrators can manage all departments
  if (managerTitle === 'Owner' || managerTitle === 'Administrator') return true;
  
  // Department-specific managers
  if (department === 'janitorial' && managerTitle === 'Janitorial Manager') return true;
  if (department === 'construction' && managerTitle === 'Project Crew Lead') return true;
  
  return false;
};

// Check if a user can manage another user based on their job titles
export const canManageUser = (managerTitle: string | null, targetTitle: string | null): boolean => {
  if (!managerTitle || !targetTitle) return false;
  
  // Owner can manage everyone
  if (managerTitle === 'Owner') return true;
  
  // Administrator can manage everyone except Owner
  if (managerTitle === 'Administrator' && targetTitle !== 'Owner') return true;
  
  // Others cannot manage Owner or Administrator
  if (targetTitle === 'Owner' || targetTitle === 'Administrator') return false;
  
  // Janitorial Manager can manage janitorial staff
  if (managerTitle === 'Janitorial Manager') {
    return getJobTitleDepartment(targetTitle) === 'janitorial';
  }
  
  // Project Crew Lead can manage project workers
  if (managerTitle === 'Project Crew Lead') {
    return getJobTitleDepartment(targetTitle) === 'construction';
  }
  
  return true;
};
