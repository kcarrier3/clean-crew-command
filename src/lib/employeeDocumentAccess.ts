// Mirrors public.can_view_employee_documents(): only these job titles may open
// other employees' onboarding documents. Manager/admin role alone does not.
export const EMPLOYEE_DOCUMENT_TITLES = ['Owner', 'Office Manager', 'Operations Manager'] as const;

export const canViewEmployeeDocuments = (jobTitle?: string | null): boolean =>
  !!jobTitle && (EMPLOYEE_DOCUMENT_TITLES as readonly string[]).includes(jobTitle);
