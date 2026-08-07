import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, KeyRound, LogOut, Trash2, Settings as SettingsIcon, Shield, Building2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { SEO } from '@/components/SEO';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import OfficeLocationCard from '@/components/OfficeLocationCard';
import { RoleManagement } from '@/components/RoleManagement';
import DepartmentManagement from '@/components/DepartmentManagement';
import DirectoryAccessRules from '@/components/DirectoryAccessRules';
import TimeOffPolicySettings from '@/components/TimeOffPolicySettings';
import WaypointDataSettings from '@/components/crm/WaypointDataSettings';
import AdpSettings from '@/components/AdpSettings';

export default function Settings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile, isManager, canManageEmployees, signOut, deleteAccount, sendPasswordResetEmail } = useAuth();
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isAdminLevel = isManager() || canManageEmployees();

  const handleChangePassword = async () => {
    if (!user?.email) return;
    const { error } = await sendPasswordResetEmail(user.email);
    toast(
      error
        ? { title: 'Error', description: 'Failed to send password reset email.', variant: 'destructive' }
        : { title: 'Password reset email sent', description: `A reset link was sent to ${user.email}.` }
    );
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await deleteAccount();
    setDeleting(false);
    setShowDelete(false);
    if (error) {
      toast({ title: 'Error', description: 'Failed to delete account.', variant: 'destructive' });
    } else {
      navigate('/auth');
    }
  };

  return (
    <div className="min-h-screen p-3 md:p-6 pb-24">
      <SEO
        title="Settings — Crew Compass"
        description="Manage your Crew Compass account, security, office location, roles, and team directory access."
        path="/settings"
      />
      <main className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <SettingsIcon className="h-6 w-6" /> Settings
          </h1>
        </div>

        <Tabs defaultValue="account" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:w-auto md:inline-grid md:grid-flow-col">
            <TabsTrigger value="account">Account</TabsTrigger>
            {isAdminLevel && <TabsTrigger value="company">Company</TabsTrigger>}
            {isAdminLevel && <TabsTrigger value="roles">Roles</TabsTrigger>}
            {isAdminLevel && <TabsTrigger value="timeoff">Time off</TabsTrigger>}
            {isAdminLevel && <TabsTrigger value="directory">Directory</TabsTrigger>}
            {isAdminLevel && <TabsTrigger value="waypoint">Waypoint</TabsTrigger>}
            {isAdminLevel && <TabsTrigger value="adp">ADP Payroll</TabsTrigger>}
          </TabsList>

          <TabsContent value="account" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Profile</CardTitle>
                <CardDescription>Your account details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div><span className="text-muted-foreground">Name: </span>{profile ? `${profile.first_name} ${profile.last_name}` : '—'}</div>
                <div><span className="text-muted-foreground">Email: </span>{user?.email}</div>
                <div><span className="text-muted-foreground">Job title: </span>{profile?.job_title || '—'}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><Shield className="h-4 w-4" /> Security</CardTitle>
                <CardDescription>Password and session</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={handleChangePassword}>
                  <KeyRound className="h-4 w-4 mr-2" /> Change password
                </Button>
                <Button variant="outline" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4 mr-2" /> Sign out
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-destructive">Danger zone</CardTitle>
                <CardDescription>Permanently delete your account and data</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="destructive" onClick={() => setShowDelete(true)}>
                  <Trash2 className="h-4 w-4 mr-2" /> Delete my account
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {isAdminLevel && (
            <TabsContent value="company" className="mt-6 space-y-6">
              <OfficeLocationCard />
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2"><Building2 className="h-4 w-4" /> Departments</CardTitle>
                  <CardDescription>Departments and their managers</CardDescription>
                </CardHeader>
                <CardContent>
                  <DepartmentManagement />
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {isAdminLevel && (
            <TabsContent value="roles" className="mt-6">
              <RoleManagement />
            </TabsContent>
          )}

          {isAdminLevel && (
            <TabsContent value="timeoff" className="mt-6">
              <TimeOffPolicySettings />
            </TabsContent>
          )}

          {isAdminLevel && (
            <TabsContent value="directory" className="mt-6 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2"><Users className="h-4 w-4" /> Directory access</CardTitle>
                  <CardDescription>Control who each job title can see in the team directory</CardDescription>
                </CardHeader>
                <CardContent>
                  <DirectoryAccessRules />
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {isAdminLevel && (
            <TabsContent value="waypoint" className="mt-6 space-y-6">
              <WaypointDataSettings />
            </TabsContent>
          )}

          {isAdminLevel && (
            <TabsContent value="adp" className="mt-6 space-y-6">
              <AdpSettings />
            </TabsContent>
          )}
        </Tabs>
      </main>

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This action is <strong>permanent and cannot be undone</strong>. You will need to be re-invited to regain access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? 'Deleting...' : 'Yes, delete my account'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
