import {
  BookOpen, Briefcase, Calculator, CalendarDays, CalendarRange, ClipboardCheck,
  FileSpreadsheet, GraduationCap, HelpCircle, Home, MapPin, MessageSquare, Package, PlaneTakeoff, Radio, Receipt, Users as UsersIcon,
} from 'lucide-react';
import type { SidebarItem } from './AppSidebar';

export interface NavFlags {
  isManager: boolean;
  isCrmUser: boolean;
  canEstimate: boolean;
  /** Planning calendar is a per-person permission (admins always). */
  canViewCalendar?: boolean;
  /** Company-wide module gate; defaults to everything enabled. */
  isModuleEnabled?: (key: string) => boolean;
}

export const buildNavItems = ({ isManager, isCrmUser, canEstimate, canViewCalendar = false, isModuleEnabled }: NavFlags): SidebarItem[] => {
  const calendar: SidebarItem[] = canViewCalendar ? [{ v: 'calendar', label: 'Calendar', icon: CalendarRange }] : [];
  const items: SidebarItem[] = isManager
    ? [
        { v: 'dashboard',  label: 'Dashboard',       icon: Home },
        { v: 'scheduling', label: 'Schedule',        icon: CalendarDays },
        ...calendar,
        { v: 'managerlog', label: 'Manager Log',     icon: BookOpen },
        { v: 'jobsites',   label: 'Accounts',        icon: MapPin },
        { v: 'billing',    label: 'Billing',         icon: Receipt },
        { v: 'quality',    label: 'Quality Control', icon: ClipboardCheck },
        { v: 'team',       label: 'Team',            icon: UsersIcon },
        { v: 'documents',  label: 'Documents',       icon: FileSpreadsheet },
        { v: 'training',   label: 'Training',        icon: GraduationCap },
        ...(isCrmUser ? [{ v: 'crm', label: 'Waypoint', icon: Briefcase }] : []),
        ...(canEstimate ? [{ v: 'estimating', label: 'Estimating', icon: Calculator }] : []),
        { v: 'supplies',   label: 'Supplies',        icon: Package },
        { v: 'messages',   label: 'Messaging',       icon: MessageSquare },
        { v: 'radio',      label: 'Radio',           icon: Radio },
      ]
    : [
        { v: 'dashboard',  label: 'Dashboard',       icon: Home },
        { v: 'myschedule', label: 'My Schedule',     icon: CalendarDays },
        ...calendar,
        { v: 'timeoff',    label: 'Time Off',        icon: PlaneTakeoff },
        { v: 'team',       label: 'Team',            icon: UsersIcon },
        { v: 'training',   label: 'Training',        icon: GraduationCap },
        { v: 'supplies',   label: 'Supplies',        icon: Package },
        ...(isCrmUser ? [{ v: 'crm', label: 'Waypoint', icon: Briefcase }] : []),
        ...(canEstimate ? [{ v: 'estimating', label: 'Estimating', icon: Calculator }] : []),
        { v: 'messages',   label: 'Messaging',       icon: MessageSquare },
        { v: 'radio',      label: 'Radio',           icon: Radio },
      ];

  const visible = isModuleEnabled
    ? items.filter((i) => i.v === 'dashboard' || isModuleEnabled(i.v))
    : items;

  // Help is never module-gated.
  return [...visible, { v: 'help', label: 'Help & How-To', icon: HelpCircle }];
};
