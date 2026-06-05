import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Clock, Calendar, FileText, LogOut, User, MessageSquare, BookOpen, MapPin, Trash2, KeyRound } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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
import { useToast } from '@/hooks/use-toast';

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading, profile, isManager, canManageEmployees, signOut, deleteAccount, sendPasswordResetEmail } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

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
      <div className="min-h-screen bg-background flex items-center justify-center">
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

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop padding, reduced mobile padding */}
      <div className="p-6 md:p-6 pb-24 md:pb-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8 flex justify-between items-center">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold mb-2 text-brand-orange">CrewCompass</h1>
              <p className="text-muted-foreground text-sm md:text-base">Summit Facilities Group</p>
            </div>
            <div className="flex items-center gap-3">
              <NotificationBell />
              
              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="flex items-center gap-2">
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
            {/* Desktop: Show tabs based on user role */}
            {isManager() ? (
              canManageEmployees() ? (
                <TabsList className="hidden md:grid w-full grid-cols-6">
                  <TabsTrigger value="dashboard">Manager Dashboard</TabsTrigger>
                  <TabsTrigger value="scheduling">Scheduling</TabsTrigger>
                  <TabsTrigger value="jobsites">Accounts</TabsTrigger>
                  <TabsTrigger value="managerlog">Manager Log</TabsTrigger>
                  <TabsTrigger value="messages">Messages</TabsTrigger>
                  <TabsTrigger value="team">Team</TabsTrigger>
                </TabsList>
              ) : (
                <TabsList className="hidden md:grid w-full grid-cols-5">
                  <TabsTrigger value="dashboard">Manager Dashboard</TabsTrigger>
                  <TabsTrigger value="scheduling">Scheduling</TabsTrigger>
                  <TabsTrigger value="jobsites">Accounts</TabsTrigger>
                  <TabsTrigger value="managerlog">Manager Log</TabsTrigger>
                  <TabsTrigger value="messages">Messages</TabsTrigger>
                </TabsList>
              )
            ) : (
              <TabsList className="hidden md:grid w-full grid-cols-2">
                <TabsTrigger value="dashboard">My Dashboard</TabsTrigger>
                <TabsTrigger value="messages">Messages</TabsTrigger>
              </TabsList>
            )}

            {/* Mobile: Show tabs based on user role */}
            {isManager() ? (
              <TabsList className="md:hidden grid w-full grid-cols-4">
                <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                <TabsTrigger value="scheduling">Schedule</TabsTrigger>
                <TabsTrigger value="jobsites">Accounts</TabsTrigger>
                <TabsTrigger value="managerlog">Log</TabsTrigger>
              </TabsList>
            ) : (
              <TabsList className="md:hidden grid w-full grid-cols-2">
                <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                <TabsTrigger value="messages">Messages</TabsTrigger>
              </TabsList>
            )}
            
            <TabsContent value="dashboard" className="mt-6">
              {isManager() ? <ManagerDashboard /> : <EmployeeDashboard />}
            </TabsContent>
            
            {isManager() && (
              <TabsContent value="scheduling" className="mt-6">
                <SchedulingDashboard />
              </TabsContent>
            )}

            {isManager() && (
              <TabsContent value="jobsites" className="mt-6">
                <JobSitesManagement />
              </TabsContent>
            )}
            
            <TabsContent value="quality" className="mt-6">
              <QualityControlDashboard />
            </TabsContent>

            <TabsContent value="messages" className="mt-6">
              <MessagingCenter />
            </TabsContent>

            {isManager() && (
              <TabsContent value="managerlog" className="mt-6">
                <ManagerLog />
              </TabsContent>
            )}

            {canManageEmployees() && (
              <TabsContent value="team" className="mt-6">
                <TeamManagement />
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>

      {/* Mobile Bottom Navigation - Role-based with safe area */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 pb-safe safe-x">
        <div className="flex justify-around items-center max-w-md mx-auto">
          <Button
            variant={activeTab === "dashboard" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("dashboard")}
            className="flex flex-col items-center gap-1 h-auto py-2 px-4 min-h-[44px] min-w-[44px]"
          >
            <User className="h-5 w-5" />
            <span className="text-xs">Home</span>
          </Button>

          {isManager() && (
            <Button
              variant={activeTab === "scheduling" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("scheduling")}
              className="flex flex-col items-center gap-1 h-auto py-2 px-4 min-h-[44px] min-w-[44px]"
            >
              <Calendar className="h-5 w-5" />
              <span className="text-xs">Schedule</span>
            </Button>
          )}
          
          <Button
            variant={activeTab === "messages" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("messages")}
            className="flex flex-col items-center gap-1 h-auto py-2 px-4 min-h-[44px] min-w-[44px]"
          >
            <MessageSquare className="h-5 w-5" />
            <span className="text-xs">Messages</span>
          </Button>

          {isManager() && (
            <Button
              variant={activeTab === "managerlog" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("managerlog")}
              className="flex flex-col items-center gap-1 h-auto py-2 px-4 min-h-[44px] min-w-[44px]"
            >
              <BookOpen className="h-5 w-5" />
              <span className="text-xs">Log</span>
            </Button>
          )}

          {isManager() && (
            <Button
              variant={activeTab === "jobsites" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("jobsites")}
              className="flex flex-col items-center gap-1 h-auto py-2 px-4 min-h-[44px] min-w-[44px]"
            >
              <MapPin className="h-5 w-5" />
              <span className="text-xs">Accounts</span>
            </Button>
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

export default Index;
