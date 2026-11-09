import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { SidebarItem } from './AppSidebar';

export function CalendarMenuItem({ item, active, onChange, collapsed = false }: {
  item: SidebarItem;
  active: string;
  onChange: (value: string) => void;
  collapsed?: boolean;
}) {
  const Icon = item.icon;
  const selected = item.children?.some(child => child.v === active);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={selected ? 'default' : 'ghost'} className="w-full justify-start px-2" aria-label={item.label}>
          <Icon className="h-5 w-5 shrink-0" />
          {!collapsed && <><span className="flex-1 text-left">{item.label}</span><ChevronDown className="h-4 w-4" /></>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side={collapsed ? 'right' : 'bottom'} align="start" className="w-56">
        {item.children?.map(child => {
          const ChildIcon = child.icon;
          return (
            <DropdownMenuItem key={child.v} onSelect={() => onChange(child.v)} aria-current={active === child.v ? 'page' : undefined}>
              <ChildIcon className="mr-2 h-4 w-4" />{child.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}