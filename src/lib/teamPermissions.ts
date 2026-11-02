// Rules for editing one team member's permissions from the Team → Edit dialog.

export interface PermissionEditContext {
  /** Job title of the person being edited. */
  memberJobTitle: string | null | undefined;
  /** True when the person doing the editing has the admin role. */
  editorIsAdmin: boolean;
  /** True when the editor is editing their own record. */
  editingSelf: boolean;
}

// Only admins may hand out (or take away) the keys to the whole system.
const ADMIN_ONLY_PERMISSIONS = ['admin_settings', 'manage_employees'];

// Project Crew Leads are always view-only for schedules (enforced in the database too).
const CREW_LEAD_BLOCKED = ['edit_schedules', 'publish_schedules'];

/** Returns why a permission checkbox is locked, or null when it can be changed. */
export const lockedPermissionReason = (key: string, ctx: PermissionEditContext): string | null => {
  if (!ctx.editorIsAdmin && ctx.editingSelf) return 'You cannot change your own permissions.';
  if (ctx.memberJobTitle === 'Project Crew Lead' && CREW_LEAD_BLOCKED.includes(key)) {
    return 'Project Crew Leads are always view-only for schedules.';
  }
  if (!ctx.editorIsAdmin && ADMIN_ONLY_PERMISSIONS.includes(key)) return 'Only admins can change this.';
  return null;
};

/** What to add and remove to go from the saved permissions to the edited set. */
export const diffPermissions = (saved: string[], next: string[]) => {
  const s = new Set(saved);
  const n = new Set(next);
  return {
    add: [...n].filter((p) => !s.has(p)),
    remove: [...s].filter((p) => !n.has(p)),
  };
};
