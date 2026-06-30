import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ChevronLeft,
  ChevronRight,
  KeyRound,
  LogOut,
  Trash2,
  User as UserIcon,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SidebarItem {
  v: string;
  label: string;
  icon: LucideIcon;
}

interface AppSidebarProps {
  items: SidebarItem[];
  active: string;
  onChange: (v: string) => void;
  collapsed: boolean;
  onToggle: () => void;
  userDisplayName: string;
  userEmail: string;
  onChangePassword: () => void;
  onSignOut: () => void;
  onDeleteAccount: () => void;
}

export const AppSidebar = ({
  items,
  active,
  onChange,
  collapsed,
  onToggle,
  userDisplayName,
  userEmail,
  onChangePassword,
  onSignOut,
  onDeleteAccount,
}: AppSidebarProps) => {
  return (
    <aside
      className={cn(
        'hidden md:flex fixed left-0 top-0 z-30 h-screen flex-col border-r border-border bg-card/85 backdrop-blur-sm transition-[width] duration-200',
        collapsed ? 'w-[64px]' : 'w-56',
      )}
    >
      <div className="flex items-center justify-between h-14 px-2 border-b border-border">
        {!collapsed && (
          <span className="pl-2 text-[11px] font-semibold tracking-wider text-muted-foreground">
            NAVIGATE
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="ml-auto"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        <TooltipProvider delayDuration={150}>
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.v;
            const button = (
              <button
                onClick={() => onChange(item.v)}
                className={cn(
                  'w-full flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-foreground hover:bg-muted',
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
            return collapsed ? (
              <Tooltip key={item.v}>
                <TooltipTrigger asChild>{button}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            ) : (
              <div key={item.v}>{button}</div>
            );
          })}
        </TooltipProvider>
      </nav>

      <div className="border-t border-border p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted">
              <UserIcon className="h-5 w-5 shrink-0" />
              {!collapsed && (
                <div className="flex-1 min-w-0 text-left">
                  <div className="truncate text-sm">{userDisplayName}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {userEmail}
                  </div>
                </div>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="w-56">
            <div className="px-2 py-1.5 text-xs text-muted-foreground truncate">
              {userEmail}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onChangePassword}>
              <KeyRound className="h-4 w-4 mr-2" />
              Change Password
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDeleteAccount}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete My Account
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
};

export default AppSidebar;