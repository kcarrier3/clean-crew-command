import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Clock, Calendar, FileText, LogOut, User, MessageSquare, BookOpen, MapPin } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import ManagerDashboard from '@/components/ManagerDashboard';
import WorkerStatusDashboard from '@/components/WorkerStatusDashboard';
import SchedulingDashboard from '@/components/SchedulingDashboard';
import EmployeeDashboard from '@/components/EmployeeDashboard';
import QualityControlDashboard from '@/components/QualityControlDashboard';
import { NotificationBell } from '@/components/NotificationBell';
import { TestNotificationButton } from '@/components/TestNotificationButton';
import PermissionManagement from '@/components/PermissionManagement';
import MessagingCenter from '@/components/MessagingCenter';
import ManagerLog from '@/components/ManagerLog';
import JobSitesManagement from '@/components/JobSitesManagement';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading, profile, isManager, canManageEmployees, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");

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
              <TestNotificationButton />
              <NotificationBell />
              
              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span className="hidden md:inline">{userDisplayName}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* Desktop: Show tabs based on user role */}
            {isManager() ? (
              canManageEmployees() ? (
                <TabsList className="hidden md:grid w-full grid-cols-7">
                  <TabsTrigger value="dashboard">Manager Dashboard</TabsTrigger>
                  <TabsTrigger value="scheduling">Scheduling</TabsTrigger>
                  <TabsTrigger value="jobsites">Accounts</TabsTrigger>
                  <TabsTrigger value="quality">Quality Control</TabsTrigger>
                  <TabsTrigger value="managerlog">Manager Log</TabsTrigger>
                  <TabsTrigger value="messages">Messages</TabsTrigger>
                  <TabsTrigger value="permissions">Permissions</TabsTrigger>
                </TabsList>
              ) : (
                <TabsList className="hidden md:grid w-full grid-cols-6">
                  <TabsTrigger value="dashboard">Manager Dashboard</TabsTrigger>
                  <TabsTrigger value="scheduling">Scheduling</TabsTrigger>
                  <TabsTrigger value="jobsites">Accounts</TabsTrigger>
                  <TabsTrigger value="quality">Quality Control</TabsTrigger>
                  <TabsTrigger value="managerlog">Manager Log</TabsTrigger>
                  <TabsTrigger value="messages">Messages</TabsTrigger>
                </TabsList>
              )
            ) : (
              <TabsList className="hidden md:grid w-full grid-cols-3">
                <TabsTrigger value="dashboard">My Dashboard</TabsTrigger>
                <TabsTrigger value="quality">Quality Control</TabsTrigger>
                <TabsTrigger value="messages">Messages</TabsTrigger>
              </TabsList>
            )}

            {/* Mobile: Show tabs based on user role */}
            {isManager() ? (
              <TabsList className="md:hidden grid w-full grid-cols-5">
                <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                <TabsTrigger value="scheduling">Schedule</TabsTrigger>
                <TabsTrigger value="jobsites">Accounts</TabsTrigger>
                <TabsTrigger value="quality">Quality</TabsTrigger>
                <TabsTrigger value="managerlog">Log</TabsTrigger>
              </TabsList>
            ) : (
              <TabsList className="md:hidden grid w-full grid-cols-2">
                <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                <TabsTrigger value="quality">Quality</TabsTrigger>
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
              <TabsContent value="permissions" className="mt-6">
                <PermissionManagement />
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>

      {/* Mobile Bottom Navigation - Role-based */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4">
        <div className="flex justify-around items-center max-w-md mx-auto">
          {isManager() && (
            <Button
              variant={activeTab === "scheduling" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("scheduling")}
              className="flex flex-col items-center gap-1 h-auto py-2 px-3"
            >
              <Calendar className="h-5 w-5" />
              <span className="text-xs">Schedule</span>
            </Button>
          )}
          
          <Button
            variant={activeTab === "quality" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("quality")}
            className="flex flex-col items-center gap-1 h-auto py-2 px-3"
          >
            <FileText className="h-5 w-5" />
            <span className="text-xs">Quality</span>
          </Button>

          {isManager() && (
            <Button
              variant={activeTab === "jobsites" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("jobsites")}
              className="flex flex-col items-center gap-1 h-auto py-2 px-3"
            >
              <MapPin className="h-5 w-5" />
              <span className="text-xs">Accounts</span>
            </Button>
          )}

          <Button
            variant={activeTab === "messages" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("messages")}
            className="flex flex-col items-center gap-1 h-auto py-2 px-3"
          >
            <MessageSquare className="h-5 w-5" />
            <span className="text-xs">Messages</span>
          </Button>

          {isManager() && (
            <Button
              variant={activeTab === "managerlog" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("managerlog")}
              className="flex flex-col items-center gap-1 h-auto py-2 px-3"
            >
              <BookOpen className="h-5 w-5" />
              <span className="text-xs">Log</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
