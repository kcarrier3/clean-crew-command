// Planning calendar access. Mirrors the calendar_drafts RLS policies:
// admins always, everyone else only with an explicit view_calendar grant.
export const canUseCalendar = (isAdmin: boolean, permissions: string[]): boolean =>
  isAdmin || permissions.includes('view_calendar');
