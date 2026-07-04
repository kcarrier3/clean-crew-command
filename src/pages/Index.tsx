import { useState, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Clock, Calendar, FileText, LogOut, User, MessageSquare, BookOpen, MapPin, Trash2, KeyRound, CalendarDays, Menu, Home, PlaneTakeoff, Briefcase, ClipboardCheck, CalendarRange, Package, Users as UsersIcon, FileSpreadsheet, Contact } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import ManagerDashboard from '@/components/ManagerDashboard';
import WorkerStatusDashboard from '@/components/WorkerStatusDashboard';
import SchedulingDashboard from '@/components/SchedulingDashboard';
import EmployeeDashboard from '@/components/EmployeeDashboard';
import QualityControlDashboard from '@/components/QualityControlDashboard';
import { NotificationBell } from '@/components/NotificationBell';
import TeamManagement from '@/components/TeamManagement';
import MessagingCenter from '@/components/MessagingCenter';
import ManagerLog from '@/components/ManagerLog';
import JobSitesManagement from '@/components/JobSitesManagement';
import { useAuth } from '@/hooks/useAuth';
import MySchedule from '@/components/MySchedule';
import { OnboardingCenter } from '@/components/OnboardingCenter';
import { OnboardingManager } from '@/components/OnboardingManager';
import { DocumentsAdmin } from '@/components/documents/DocumentsAdmin';
import TimeOffRequests from '@/components/TimeOffRequests';
import CRMDashboard from '@/components/crm/CRMDashboard';
import { useToast } from '@/hooks/use-toast';
import { useIsNativeApp } from '@/hooks/useIsNativeApp';
import { useIsMobile } from '@/hooks/use-mobile';
import { AppSidebar, type SidebarItem } from '@/components/layout/AppSidebar';
import CalendarPlanner from '@/components/CalendarPlanner';
import SupplyManagement from '@/components/SupplyManagement';
import TeamRoster from '@/components/TeamRoster';
import CompanyContacts from '@/components/CompanyContacts';

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading, profile, isManager, canManageEmployees, isCrmUser, signOut, deleteAccount, sendPasswordResetEmail } = useAuth();
  const isNativeShell = useIsNativeApp();
  const isPhone = useIsMobile();
  // Treat phone-sized browsers the same as the native app so the mobile web
  // experience mirrors the phone app (hides web-only tabs like CRM, Accounts,
  // Team, Manager reports).
  const isNative = isNativeShell || isPhone;
  const isSupplyStaff = profile?.job_title === 'Supply Management';
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('cc.sidebar.collapsed') === '1';
  });

  const toggleSidebar = () => {
    setSidebarCollapsed((c) => {
      const next = !c;
      try { window.localStorage.setItem('cc.sidebar.collapsed', next ? '1' : '0'); } catch {}
      return next;
    });
  };

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  // Require new hires to complete their profile before using the app
  useEffect(() => {
    if (loading || !user) return;
    if ((profile as any) && !(profile as any).profile_completed_at) {
      navigate('/complete-profile');
    }
  }, [user, loading, profile, navigate]);

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast({
        title: "Error",
        description: "Failed to sign out",
        variant: "destructive"
      });
    } else {
      navigate('/auth');
    }
  };

  const handleChangePassword = async () => {
    if (!user?.email) return;
    const { error } = await sendPasswordResetEmail(user.email);
    if (error) {
      toast({
        title: "Error",
        description: "Failed to send password reset email.",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Password Reset Email Sent",
        description: `A password reset link has been sent to ${user.email}.`
      });
    }
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    const { error } = await deleteAccount();
    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete account. Please contact your manager.",
        variant: "destructive"
      });
      setDeletingAccount(false);
    } else {
      toast({
        title: "Account Deleted",
        description: "Your account has been successfully deleted."
      });
      navigate('/auth');
    }
    setShowDeleteDialog(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to auth
  }

  const userDisplayName = profile ? `${profile.first_name} ${profile.last_name}` : user.email;

  // Desktop sidebar items (web only — hidden on native via wrapper)
  const sidebarItems: SidebarItem[] = isManager()
    ? [
        { v: 'dashboard',  label: 'Dashboard',       icon: Home },
        { v: 'scheduling', label: 'Schedule',        icon: CalendarDays },
        { v: 'calendar',   label: 'Calendar',        icon: CalendarRange },
        { v: 'managerlog', label: 'Manager Log',     icon: BookOpen },
        { v: 'jobsites',   label: 'Accounts',        icon: MapPin },
        { v: 'quality',    label: 'Quality Control', icon: ClipboardCheck },
        { v: 'team',       label: 'Team',            icon: UsersIcon },
        { v: 'documents',  label: 'Documents',       icon: FileSpreadsheet },
        ...(isCrmUser() ? [{ v: 'crm', label: 'CRM', icon: Briefcase }] : []),
        { v: 'supplies',   label: 'Supplies',        icon: Package },
        { v: 'contacts',   label: 'Contacts',        icon: Contact },
        { v: 'messages',   label: 'Messaging',     icon: MessageSquare },
      ]
    : [
        { v: 'dashboard',  label: 'Dashboard',       icon: Home },
        { v: 'myschedule', label: 'My Schedule',     icon: CalendarDays },
        { v: 'calendar',   label: 'Calendar',        icon: CalendarRange },
        { v: 'timeoff',    label: 'Time Off',        icon: PlaneTakeoff },
        { v: 'team',       label: 'Team',            icon: UsersIcon },
        { v: 'supplies',   label: 'Supplies',        icon: Package },
        { v: 'contacts',   label: 'Contacts',        icon: Contact },
        { v: 'messages',   label: 'Messaging',     icon: MessageSquare },
      ];

  const showDesktopSidebar = !isNative;

  return (
    <div className="min-h-screen overflow-x-hidden">
      {showDesktopSidebar && (
        <AppSidebar
          items={sidebarItems}
          active={activeTab}
          onChange={setActiveTab}
          collapsed={sidebarCollapsed}
          onToggle={toggleSidebar}
          userDisplayName={userDisplayName ?? ''}
          userEmail={user.email ?? ''}
          onChangePassword={handleChangePassword}
          onSignOut={handleSignOut}
          onDeleteAccount={() => setShowDeleteDialog(true)}
        />
      )}
      {/* Desktop padding, reduced mobile padding */}
      <div
        className={`p-3 md:p-6 pb-24 md:pb-6 transition-[padding] duration-200 ${
          showDesktopSidebar ? (sidebarCollapsed ? 'md:pl-[80px]' : 'md:pl-[240px]') : ''
        }`}
      >
        <div className="max-w-6xl mx-auto min-w-0">
          <div className="mb-8 flex justify-between items-center">
            <div>
              <img
                src="/crew-compass-logo-notag.png?v=4"
                alt="Crew Compass"
                className="h-28 md:h-32 w-auto"
              />
            </div>
            <div className="flex items-center gap-3">
              <NotificationBell />

              {/* Mobile hamburger menu for lesser-used functions */}
              <Sheet open={moreMenuOpen} onOpenChange={setMoreMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="md:hidden">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-72">
                  <SheetHeader>
                    <SheetTitle>Menu</SheetTitle>
                  </SheetHeader>
                  <div className="mt-6 space-y-1">
                    <div className="px-2 py-1.5 text-xs text-muted-foreground truncate">
                      {user.email}
                    </div>
                    {/* On native app, surface Messages + Onboarding here since they're not in the bottom bar */}
                    {isNative && (
                      <Button
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => { setActiveTab('messages'); setMoreMenuOpen(false); }}
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Messages
                      </Button>
                    )}
                    {!isManager() && (
                      <Button
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => { setActiveTab('onboarding'); setMoreMenuOpen(false); }}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Onboarding & Docs
                      </Button>
                    )}
                    {isManager() && !isNative && (
                      <>
                        <Button
                          variant="ghost"
                          className="w-full justify-start"
                          onClick={() => { setActiveTab('jobsites'); setMoreMenuOpen(false); }}
                        >
                          <MapPin className="h-4 w-4 mr-2" />
                          Accounts
                        </Button>
                        <Button
                          variant="ghost"
                          className="w-full justify-start"
                          onClick={() => { setActiveTab('calendar'); setMoreMenuOpen(false); }}
                        >
                          <CalendarRange className="h-4 w-4 mr-2" />
                          Calendar
                        </Button>
                        <Button
                          variant="ghost"
                          className="w-full justify-start"
                          onClick={() => { setActiveTab('supplies'); setMoreMenuOpen(false); }}
                        >
                          <Package className="h-4 w-4 mr-2" />
                          Supplies
                        </Button>
                        {isCrmUser() && (
                          <Button
                            variant="ghost"
                            className="w-full justify-start"
                            onClick={() => { setActiveTab('crm'); setMoreMenuOpen(false); }}
                          >
                            <Briefcase className="h-4 w-4 mr-2" />
                            CRM
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          className="w-full justify-start"
                          onClick={() => { setActiveTab('managerlog'); setMoreMenuOpen(false); }}
                        >
                          <BookOpen className="h-4 w-4 mr-2" />
                          Manager Log
                        </Button>
                        {canManageEmployees() && (
                          <Button
                            variant="ghost"
                            className="w-full justify-start"
                            onClick={() => { setActiveTab('team'); setMoreMenuOpen(false); }}
                          >
                            <User className="h-4 w-4 mr-2" />
                            Team
                          </Button>
                        )}
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <Button variant="ghost" className="w-full justify-start" onClick={() => { handleChangePassword(); setMoreMenuOpen(false); }}>
                      <KeyRound className="h-4 w-4 mr-2" />
                      Change Password
                    </Button>
                    <Button variant="ghost" className="w-full justify-start" onClick={() => { handleSignOut(); setMoreMenuOpen(false); }}>
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-destructive hover:text-destructive"
                      onClick={() => { setShowDeleteDialog(true); setMoreMenuOpen(false); }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete My Account
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="hidden md:flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span className="hidden md:inline">{userDisplayName}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <div className="px-2 py-1.5 text-xs text-muted-foreground truncate">
                    {user.email}
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleChangePassword}>
                    <KeyRound className="h-4 w-4 mr-2" />
                    Change Password
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete My Account
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* Desktop: tabs replaced by left sidebar on web; native still uses TabsList. */}
            {isNative && isManager() ? (
              (() => {
                const tabs = [
                  { v: 'dashboard',  label: 'Dashboard' },
                  { v: 'scheduling', label: 'Scheduling' },
                  { v: 'managerlog', label: 'Manager Log' },
                  { v: 'quality',    label: 'Quality Control' },
                  { v: 'messages',   label: 'Messages' },
                ];
                return (
                  <TabsList className="hidden md:grid w-full" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
                    {tabs.map(t => <TabsTrigger key={t.v} value={t.v}>{t.label}</TabsTrigger>)}
                  </TabsList>
                );
              })()
            ) : isNative ? (
              <TabsList className="hidden md:grid w-full grid-cols-4">
                <TabsTrigger value="dashboard">My Dashboard</TabsTrigger>
                <TabsTrigger value="myschedule">My Schedule</TabsTrigger>
                <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
                <TabsTrigger value="messages">Messages</TabsTrigger>
              </TabsList>
            ) : null}

            <TabsContent value="dashboard" className="mt-6">
              {isManager() ? <ManagerDashboard /> : <EmployeeDashboard />}
            </TabsContent>
            
            {isManager() && (
              <TabsContent value="scheduling" className="mt-6">
                <SchedulingDashboard />
              </TabsContent>
            )}

            {!isNative && (
              <TabsContent value="calendar" className="mt-6">
                <CalendarPlanner />
              </TabsContent>
            )}

            {(!isNative || isSupplyStaff) && (
              <TabsContent value="supplies" className="mt-6">
                <SupplyManagement />
              </TabsContent>
            )}

            {isManager() && !isNative && (
              <TabsContent value="jobsites" className="mt-6">
                <JobSitesManagement />
              </TabsContent>
            )}

            {isCrmUser() && !isNative && (
              <TabsContent value="crm" className="mt-6">
                <CRMDashboard />
              </TabsContent>
            )}
            
            {!isManager() && (
              <TabsContent value="myschedule" className="mt-6">
                <MySchedule />
              </TabsContent>
            )}

            {isManager() && (
              <TabsContent value="quality" className="mt-6">
                <QualityControlDashboard />
              </TabsContent>
            )}

            <TabsContent value="messages" className="mt-6">
              <MessagingCenter />
            </TabsContent>

            {!isManager() && (
              <TabsContent value="timeoff" className="mt-6">
                <TimeOffRequests isManager={false} currentEmployeeId={profile?.id} />
              </TabsContent>
            )}

            {isManager() && (
              <TabsContent value="managerlog" className="mt-6">
                <ManagerLog />
              </TabsContent>
            )}

            {!isNative && (
              <TabsContent value="team" className="mt-6">
                <TeamRoster />
              </TabsContent>
            )}

            {/* Onboarding: employees complete docs, managers review */}
            <TabsContent value="onboarding" className="mt-6">
              {isManager() ? <OnboardingManager /> : <OnboardingCenter />}
            </TabsContent>

            {isManager() && !isNative && (
              <TabsContent value="documents" className="mt-6">
                <DocumentsAdmin />
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>

      {/* Mobile Bottom Navigation - Role-based with safe area */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 pb-safe safe-x">
        <div className="flex justify-around items-center max-w-md mx-auto">
          {isManager() ? (
            isNative ? (
              <>
                <MobileTab active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<Home className="h-5 w-5" />} label="Dashboard" />
                <MobileTab active={activeTab === 'scheduling'} onClick={() => setActiveTab('scheduling')} icon={<Calendar className="h-5 w-5" />} label="Schedule" />
                <MobileTab active={activeTab === 'managerlog'} onClick={() => setActiveTab('managerlog')} icon={<BookOpen className="h-5 w-5" />} label="Log" />
                {isSupplyStaff ? (
                  <MobileTab active={activeTab === 'supplies'} onClick={() => setActiveTab('supplies')} icon={<Package className="h-5 w-5" />} label="Supplies" />
                ) : (
                  <MobileTab active={activeTab === 'quality'} onClick={() => setActiveTab('quality')} icon={<ClipboardCheck className="h-5 w-5" />} label="QC" />
                )}
                <MobileTab active={moreMenuOpen} onClick={() => setMoreMenuOpen(true)} icon={<Menu className="h-5 w-5" />} label="More" />
              </>
            ) : (
            <>
              <MobileTab active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<Home className="h-5 w-5" />} label="Dashboard" />
              <MobileTab active={activeTab === 'scheduling'} onClick={() => setActiveTab('scheduling')} icon={<Calendar className="h-5 w-5" />} label="Schedule" />
              <MobileTab active={activeTab === 'messages'} onClick={() => setActiveTab('messages')} icon={<MessageSquare className="h-5 w-5" />} label="Messages" />
              <MobileTab active={moreMenuOpen} onClick={() => setMoreMenuOpen(true)} icon={<Menu className="h-5 w-5" />} label="More" />
            </>
            )
          ) : isNative ? (
            <>
              <MobileTab active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<Home className="h-5 w-5" />} label="Dashboard" />
              <MobileTab active={activeTab === 'myschedule'} onClick={() => setActiveTab('myschedule')} icon={<CalendarDays className="h-5 w-5" />} label="Schedule" />
              {isSupplyStaff ? (
                <MobileTab active={activeTab === 'supplies'} onClick={() => setActiveTab('supplies')} icon={<Package className="h-5 w-5" />} label="Supplies" />
              ) : (
                <MobileTab active={activeTab === 'timeoff'} onClick={() => setActiveTab('timeoff')} icon={<PlaneTakeoff className="h-5 w-5" />} label="Time Off" />
              )}
              <MobileTab active={activeTab === 'messages'} onClick={() => setActiveTab('messages')} icon={<MessageSquare className="h-5 w-5" />} label="Messages" />
              <MobileTab active={moreMenuOpen} onClick={() => setMoreMenuOpen(true)} icon={<Menu className="h-5 w-5" />} label="More" />
            </>
          ) : (
            <>
              <MobileTab active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<Home className="h-5 w-5" />} label="Dashboard" />
              <MobileTab active={activeTab === 'myschedule'} onClick={() => setActiveTab('myschedule')} icon={<CalendarDays className="h-5 w-5" />} label="Schedule" />
              <MobileTab active={activeTab === 'timeoff'} onClick={() => setActiveTab('timeoff')} icon={<PlaneTakeoff className="h-5 w-5" />} label="Time Off" />
              <MobileTab active={activeTab === 'messages'} onClick={() => setActiveTab('messages')} icon={<MessageSquare className="h-5 w-5" />} label="Messages" />
              <MobileTab active={moreMenuOpen} onClick={() => setMoreMenuOpen(true)} icon={<Menu className="h-5 w-5" />} label="More" />
            </>
          )}
        </div>
      </div>

      {/* Delete Account Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Your Account?</AlertDialogTitle>
            <AlertDialogDescription>
              This action is <strong>permanent and cannot be undone</strong>. Your account, profile, and all associated data will be permanently deleted. If you need access again, you will need to be re-invited by your manager.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingAccount}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={deletingAccount}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingAccount ? "Deleting..." : "Yes, Delete My Account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const MobileTab = ({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) => (
  <Button
    variant={active ? 'default' : 'ghost'}
    size="sm"
    onClick={onClick}
    className="flex flex-col items-center gap-1 h-auto py-2 px-3 min-h-[44px] min-w-[44px]"
  >
    {icon}
    <span className="text-[10px]">{label}</span>
  </Button>
);

export default Index;
