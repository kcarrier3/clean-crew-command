import { useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { buildNavItems } from './navItems';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Menu } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useIsNativeApp } from '@/hooks/useIsNativeApp';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import { useModuleSettings } from '@/hooks/useModuleSettings';
import { moduleForPath } from '@/lib/modules';
import ModuleHelp from '@/components/help/ModuleHelp';

/**
 * Wraps routed (non-tab) pages so the Crew Compass sidebar stays available
 * everywhere. Tab destinations navigate back to the shell at "/?tab=".
 */
export const AppShell = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user, profile, isManager, isCrmUser, canEstimate, signOut, sendPasswordResetEmail } = useAuth();
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
    <button
      onClick={() => navigate('/')}
      className="inline-flex items-center"
      aria-label="Crew Compass home"
    >
      <img
        src="/crew-compass-logo-notag.png?v=4"
        alt="Crew Compass"
        width="512"
        height="256"
        className="h-28 md:h-32 w-auto"
      />
    </button>
  );

  if (isNative) {
    const primary = items.filter((i) => i.v !== 'dashboard').slice(0, 3);
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
            {items.filter((i) => i.v === 'dashboard').concat(primary).map((item) => {
              const Icon = item.icon;
              const isActive = active === item.v;
              return (
                <button
                  key={item.v}
                  onClick={() => handleChange(item.v)}
                  className={`flex flex-col items-center gap-1 px-2 py-1 text-[11px] ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="truncate max-w-[4.5rem]">{item.label}</span>
                </button>
              );
            })}
            <button
              onClick={() => setMoreOpen(true)}
              className="flex flex-col items-center gap-1 px-2 py-1 text-[11px] text-muted-foreground"
            >
              <Menu className="h-5 w-5" />
              <span>More</span>
            </button>
          </div>
        </div>

        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetContent side="right" className="w-72 flex flex-col overflow-y-auto max-h-screen pb-safe">
            <SheetHeader className="shrink-0">
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-1 overflow-y-auto flex-1">
              {items.map((item) => {
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
