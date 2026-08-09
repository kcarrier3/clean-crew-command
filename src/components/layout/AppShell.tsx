import { useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { buildNavItems } from './navItems';
import { useAuth } from '@/hooks/useAuth';
import { useIsNativeApp } from '@/hooks/useIsNativeApp';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';

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
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('cc.sidebar.collapsed') === '1';
  });

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
  });

  const active = location.pathname.startsWith('/estimating')
    ? 'estimating'
    : location.pathname.startsWith('/crm')
      ? 'crm'
      : '';

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

  if (isNative) return <>{children}</>;

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
        {children}
      </div>
    </div>
  );
};

export default AppShell;
