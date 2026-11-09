import { useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { buildNavItems } from './navItems';
import { CalendarMenuItem } from './CalendarMenuItem';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Menu } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useIsNativeApp } from '@/hooks/useIsNativeApp';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import { useModuleSettings } from '@/hooks/useModuleSettings';
import { moduleForPath } from '@/lib/modules';
import ModuleHelp from '@/components/help/ModuleHelp';
import { Button } from '@/components/ui/button';
import { mobileNavigationKeys } from './mobileNavigation';

/**
 * Wraps routed (non-tab) pages so the Crew Compass sidebar stays available
 * everywhere. Tab destinations navigate back to the shell at "/?tab=".
 */
export const AppShell = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user, profile, isManager, isCrmUser, canEstimate, canViewCalendar, signOut, sendPasswordResetEmail } = useAuth();
  const isNative = useIsNativeApp() || useIsMobile();
  const { isModuleEnabled } = useModuleSettings();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('cc.sidebar.collapsed') === '1';
  });
  const [moreOpen, setMoreOpen] = useState(false);

  const toggle = () => {
    setCollapsed((c) => {
      const next = !c;
      try { window.localStorage.setItem('cc.sidebar.collapsed', next ? '1' : '0'); } catch { /* noop */ }
      return next;
    });
  };

  const items = buildNavItems({
    isManager: !!isManager?.(),
    isCrmUser: !!isCrmUser?.(),
    canEstimate: !!canEstimate?.(),
    canViewCalendar: !!canViewCalendar?.(),
    isModuleEnabled,
  });

  const active = location.pathname.startsWith('/estimating')
    ? 'estimating'
    : location.pathname.startsWith('/crm')
      ? 'crm'
      : '';

  const helpModuleKey = moduleForPath(location.pathname)?.key;

  const handleChange = (v: string) => {
    if (v === 'estimating') {
      navigate('/estimating');
      return;
    }
    navigate(`/?tab=${v}`);
  };

  const handleChangePassword = async () => {
    if (!user?.email) return;
    const { error } = await sendPasswordResetEmail(user.email);
    toast(
      error
        ? { title: 'Error', description: 'Failed to send password reset email.', variant: 'destructive' }
        : { title: 'Password reset email sent', description: `A reset link was sent to ${user.email}.` },
    );
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const logo = (
    <Button variant="ghost"
      onClick={() => navigate('/')}
      className="h-auto inline-flex items-center p-0 hover:bg-transparent"
      aria-label="Crew Compass home"
    >
      <img
        src="/crew-compass-logo-notag.png?v=4"
        alt="Crew Compass"
        width="512"
        height="256"
        className="h-12 md:h-32 w-auto"
      />
    </Button>
  );

  if (isNative) {
    const keys = mobileNavigationKeys(isManager(), profile?.job_title === 'Supply' || profile?.job_title === 'Supply Management');
    const primary = keys.flatMap(key => items.filter(item => item.v === key));
    const overflow = items.filter(item => !keys.includes(item.v));
    return (
      <div className="min-h-screen pb-24">
        <div className="px-3 pt-3">{logo}</div>
        {helpModuleKey && (
          <div className="px-3">
            <ModuleHelp moduleKey={helpModuleKey} />
          </div>
        )}
        {children}

        {/* Mobile bottom navigation, mirroring the main dashboard shell */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-border p-3 pb-safe safe-x">
          <div className="flex justify-around items-center max-w-md mx-auto">
            {primary.map((item) => {
              const Icon = item.icon;
              const isActive = active === item.v;
              return (
                <Button variant="ghost"
                  key={item.v}
                  onClick={() => handleChange(item.v)}
                  className={`h-auto flex flex-col items-center gap-1 px-2 py-1 text-[11px] ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="truncate max-w-[4.5rem]">{item.v === 'quality' ? 'QC' : item.v === 'managerlog' ? 'Log' : item.v === 'myschedule' ? 'Schedule' : item.label}</span>
                </Button>
              );
            })}
            <Button variant="ghost"
              onClick={() => setMoreOpen(true)}
              className="h-auto flex flex-col items-center gap-1 px-2 py-1 text-[11px] text-muted-foreground"
            >
              <Menu className="h-5 w-5" />
              <span>More</span>
            </Button>
          </div>
        </div>

        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetContent side="right" className="w-72 flex flex-col overflow-y-auto max-h-screen pb-safe">
            <SheetHeader className="shrink-0">
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-1 overflow-y-auto flex-1">
              {overflow.map((item) => {
                if (item.children?.length) {
                  return <CalendarMenuItem key={item.v} item={item} active={active} onChange={(value) => { setMoreOpen(false); handleChange(value); }} />;
                }
                const Icon = item.icon;
                return (
                  <button
                    key={item.v}
                    onClick={() => { setMoreOpen(false); handleChange(item.v); }}
                    className={`w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm ${active === item.v ? 'bg-secondary' : 'hover:bg-muted'}`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
              <button
                onClick={() => { setMoreOpen(false); navigate('/settings'); }}
                className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted"
              >
                Settings
              </button>
              <button
                onClick={() => { setMoreOpen(false); handleSignOut(); }}
                className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted"
              >
                Sign Out
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  const displayName = profile ? `${profile.first_name} ${profile.last_name}` : (user?.email ?? '');

  return (
    <div className="min-h-screen">
      <AppSidebar
        items={items}
        active={active}
        onChange={handleChange}
        collapsed={collapsed}
        onToggle={toggle}
        userDisplayName={displayName}
        userEmail={user?.email ?? ''}
        onChangePassword={handleChangePassword}
        onSignOut={handleSignOut}
        onDeleteAccount={() => navigate('/settings')}
      />
      <div className={`transition-[padding] duration-200 ${collapsed ? 'md:pl-[64px]' : 'md:pl-56'}`}>
        <div className="px-4 md:px-6 pt-4">{logo}</div>
        {helpModuleKey && (
          <div className="px-4 md:px-6">
            <ModuleHelp moduleKey={helpModuleKey} />
          </div>
        )}
        {children}
      </div>
    </div>
  );
};

export default AppShell;
