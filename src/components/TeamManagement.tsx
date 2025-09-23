import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Users, Settings, Shield, User, DollarSign, FileText, Search, Plus, Mail, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  employee_id: string | null;
  job_title: string | null;
  hourly_rate: number | null;
  hire_date: string | null;
  phone: string | null;
}

interface Permission {
  name: string;
  display_name: string;
  description: string | null;
  category: string;
}

interface UserPermissionWithDetails {
  permission: string;
  display_name: string;
  category: string;
}

const TeamManagement = () => {
  const { canManageEmployees } = useAuth();
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [userPermissions, setUserPermissions] = useState<UserPermissionWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [isAddEmployeeDialogOpen, setIsAddEmployeeDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [newEmployeeData, setNewEmployeeData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    hourly_rate: '',
  });
  const [isSubmittingEmployee, setIsSubmittingEmployee] = useState(false);

  useEffect(() => {
    if (canManageEmployees()) {
      fetchEmployees();
      fetchPermissions();
    }
  }, [canManageEmployees]);

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('first_name');
      
      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast({
        title: "Error",
        description: "Failed to fetch employees.",
        variant: "destructive",
      });
    }
  };

  const fetchPermissions = async () => {
    try {
      const { data, error } = await supabase
        .from('permissions')
        .select('*')
        .order('category', { ascending: true });
      
      if (error) throw error;
      setPermissions(data || []);
    } catch (error) {
      console.error('Error fetching permissions:', error);
    }
  };

  const fetchUserPermissions = async (userId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_permissions')
        .select(`
          permission,
          permissions!inner(
            name,
            display_name,
            category
          )
        `)
        .eq('user_id', userId);
      
      if (error) throw error;
      
      const formattedPermissions = data?.map(item => ({
        permission: item.permission,
        display_name: (item.permissions as any).display_name,
        category: (item.permissions as any).category
      })) || [];
      
      setUserPermissions(formattedPermissions);
    } catch (error) {
      console.error('Error fetching user permissions:', error);
      toast({
        title: "Error",
        description: "Failed to fetch user permissions.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = async (permissionName: string, hasPermission: boolean) => {
    if (!selectedEmployee) return;

    try {
      if (hasPermission) {
        // Remove permission
        const { error } = await supabase
          .from('user_permissions')
          .delete()
          .eq('user_id', selectedEmployee.id)
          .eq('permission', permissionName as any);
        
        if (error) throw error;
        
        setUserPermissions(prev => 
          prev.filter(p => p.permission !== permissionName)
        );
      } else {
        // Add permission
        const { error } = await supabase
          .from('user_permissions')
          .insert({
            user_id: selectedEmployee.id,
            permission: permissionName as any
          });
        
        if (error) throw error;
        
        const permission = permissions.find(p => p.name === permissionName);
        if (permission) {
          setUserPermissions(prev => [...prev, {
            permission: permissionName,
            display_name: permission.display_name,
            category: permission.category
          }]);
        }
      }
      
      toast({
        title: "Success",
        description: `Permission ${hasPermission ? 'removed' : 'granted'} successfully.`,
      });
    } catch (error) {
      console.error('Error toggling permission:', error);
      toast({
        title: "Error",
        description: "Failed to update permission.",
        variant: "destructive",
      });
    }
  };

  const updateEmployeeProfile = async (updatedData: Partial<Employee>) => {
    if (!selectedEmployee) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updatedData)
        .eq('id', selectedEmployee.id);
      
      if (error) throw error;
      
      setSelectedEmployee({ ...selectedEmployee, ...updatedData });
      setEmployees(prev => prev.map(emp => 
        emp.id === selectedEmployee.id 
          ? { ...emp, ...updatedData }
          : emp
      ));
      
      toast({
        title: "Success",
        description: "Employee profile updated successfully.",
      });
      setEditMode(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: "Failed to update employee profile.",
        variant: "destructive",
      });
    }
  };

  const hasUserPermission = (permissionName: string) => {
    return userPermissions.some(p => p.permission === permissionName);
  };

  const groupedPermissions = permissions.reduce((groups, permission) => {
    const category = permission.category;
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(permission);
    return groups;
  }, {} as Record<string, Permission[]>);

  const filteredEmployees = employees.filter(employee =>
    `${employee.first_name} ${employee.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.employee_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openEmployeeProfile = (employee: Employee) => {
    setSelectedEmployee(employee);
    fetchUserPermissions(employee.id);
    setIsProfileDialogOpen(true);
    setEditMode(false);
  };

  const handleAddEmployee = async () => {
    if (!newEmployeeData.first_name || !newEmployeeData.last_name || !newEmployeeData.email) {
      toast({
        title: "Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmittingEmployee(true);
    try {
      // Send invitation email via edge function
      const { error: inviteError } = await supabase.functions.invoke('invite-employee', {
        body: {
          email: newEmployeeData.email,
          firstName: newEmployeeData.first_name,
          lastName: newEmployeeData.last_name,
          phone: newEmployeeData.phone,
          hourlyRate: newEmployeeData.hourly_rate ? parseFloat(newEmployeeData.hourly_rate) : null,
        },
      });

      if (inviteError) throw inviteError;

      toast({
        title: "Success",
        description: "Employee invitation sent successfully!",
      });

      // Reset form
      setNewEmployeeData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        hourly_rate: '',
      });
      setIsAddEmployeeDialogOpen(false);
      
      // Refresh employee list
      fetchEmployees();
    } catch (error) {
      console.error('Error inviting employee:', error);
      toast({
        title: "Error",
        description: "Failed to send employee invitation.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingEmployee(false);
    }
  };

  const resetAddEmployeeForm = () => {
    setNewEmployeeData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      hourly_rate: '',
    });
  };

  if (!canManageEmployees()) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Shield className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-sm font-semibold text-muted-foreground">Access Denied</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            You don't have permission to manage team members.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Users className="h-6 w-6" />
        <h1 className="text-3xl font-bold">Team Management</h1>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>
                View and manage all team members, their profiles, and permissions.
              </CardDescription>
            </div>
            <Dialog open={isAddEmployeeDialogOpen} onOpenChange={setIsAddEmployeeDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetAddEmployeeForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Add New Employee
                  </DialogTitle>
                  <DialogDescription>
                    Enter employee details to send them an invitation to join the app.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="add_first_name">First Name *</Label>
                      <Input
                        id="add_first_name"
                        value={newEmployeeData.first_name}
                        onChange={(e) => setNewEmployeeData(prev => ({ ...prev, first_name: e.target.value }))}
                        placeholder="John"
                      />
                    </div>
                    <div>
                      <Label htmlFor="add_last_name">Last Name *</Label>
                      <Input
                        id="add_last_name"
                        value={newEmployeeData.last_name}
                        onChange={(e) => setNewEmployeeData(prev => ({ ...prev, last_name: e.target.value }))}
                        placeholder="Doe"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="add_email">Email Address *</Label>
                    <Input
                      id="add_email"
                      type="email"
                      value={newEmployeeData.email}
                      onChange={(e) => setNewEmployeeData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="john.doe@company.com"
                    />
                  </div>

                  <div>
                    <Label htmlFor="add_phone">Phone Number</Label>
                    <Input
                      id="add_phone"
                      type="tel"
                      value={newEmployeeData.phone}
                      onChange={(e) => setNewEmployeeData(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="(555) 123-4567"
                    />
                  </div>

                  <div>
                    <Label htmlFor="add_hourly_rate">Hourly Rate</Label>
                    <Input
                      id="add_hourly_rate"
                      type="number"
                      step="0.01"
                      min="0"
                      value={newEmployeeData.hourly_rate}
                      onChange={(e) => setNewEmployeeData(prev => ({ ...prev, hourly_rate: e.target.value }))}
                      placeholder="25.00"
                    />
                  </div>

                  <div className="flex justify-end space-x-2 pt-4">
                    <Button 
                      variant="outline" 
                      onClick={() => setIsAddEmployeeDialogOpen(false)}
                      disabled={isSubmittingEmployee}
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleAddEmployee}
                      disabled={isSubmittingEmployee}
                    >
                      {isSubmittingEmployee ? (
                        <>Sending Invite...</>
                      ) : (
                        <>
                          <Mail className="h-4 w-4 mr-2" />
                          Send Invitation
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search employees by name, ID, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>

            <div className="grid gap-4">
              {filteredEmployees.map((employee) => (
                <Card 
                  key={employee.id} 
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => openEmployeeProfile(employee)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold">
                            {employee.first_name} {employee.last_name}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {employee.job_title || 'No title'} • ID: {employee.employee_id || 'N/A'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {employee.email || 'No email'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {employee.hourly_rate && (
                          <div className="flex items-center text-sm font-medium">
                            <DollarSign className="h-4 w-4 mr-1" />
                            ${employee.hourly_rate}/hr
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employee Profile Dialog */}
      <Dialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {selectedEmployee ? `${selectedEmployee.first_name} ${selectedEmployee.last_name}` : 'Employee Profile'}
            </DialogTitle>
            <DialogDescription>
              View and manage employee information and permissions.
            </DialogDescription>
          </DialogHeader>

          {selectedEmployee && (
            <div className="space-y-6">
              {/* Personal Information */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Personal Information</CardTitle>
                    <CardDescription>Basic employee details</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditMode(!editMode)}
                  >
                    {editMode ? 'Cancel' : 'Edit'}
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {editMode ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="first_name">First Name</Label>
                        <Input
                          id="first_name"
                          defaultValue={selectedEmployee.first_name}
                          onBlur={(e) => updateEmployeeProfile({ first_name: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="last_name">Last Name</Label>
                        <Input
                          id="last_name"
                          defaultValue={selectedEmployee.last_name}
                          onBlur={(e) => updateEmployeeProfile({ last_name: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          defaultValue={selectedEmployee.email || ''}
                          onBlur={(e) => updateEmployeeProfile({ email: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="phone">Phone</Label>
                        <Input
                          id="phone"
                          defaultValue={selectedEmployee.phone || ''}
                          onBlur={(e) => updateEmployeeProfile({ phone: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="job_title">Job Title</Label>
                        <Input
                          id="job_title"
                          defaultValue={selectedEmployee.job_title || ''}
                          onBlur={(e) => updateEmployeeProfile({ job_title: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="employee_id">Employee ID</Label>
                        <Input
                          id="employee_id"
                          defaultValue={selectedEmployee.employee_id || ''}
                          onBlur={(e) => updateEmployeeProfile({ employee_id: e.target.value })}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium">Name</Label>
                        <p className="text-sm">{selectedEmployee.first_name} {selectedEmployee.last_name}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Employee ID</Label>
                        <p className="text-sm">{selectedEmployee.employee_id || 'Not set'}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Email</Label>
                        <p className="text-sm">{selectedEmployee.email || 'Not set'}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Phone</Label>
                        <p className="text-sm">{selectedEmployee.phone || 'Not set'}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Job Title</Label>
                        <p className="text-sm">{selectedEmployee.job_title || 'Not set'}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Hire Date</Label>
                        <p className="text-sm">{selectedEmployee.hire_date || 'Not set'}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Pay Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Pay Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="hourly_rate">Hourly Rate</Label>
                      {editMode ? (
                        <Input
                          id="hourly_rate"
                          type="number"
                          step="0.01"
                          defaultValue={selectedEmployee.hourly_rate || ''}
                          onBlur={(e) => updateEmployeeProfile({ hourly_rate: parseFloat(e.target.value) || null })}
                        />
                      ) : (
                        <p className="text-sm">${selectedEmployee.hourly_rate || 'Not set'}/hr</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Permissions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Permissions
                  </CardTitle>
                  <CardDescription>
                    Manage what this employee can access and do
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <p>Loading permissions...</p>
                  ) : (
                    <div className="space-y-6">
                      {Object.entries(groupedPermissions).map(([category, categoryPermissions]) => (
                        <div key={category}>
                          <h4 className="font-medium mb-3 capitalize">{category.replace('_', ' ')}</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {categoryPermissions.map((permission) => {
                              const hasPermission = hasUserPermission(permission.name);
                              return (
                                <div key={permission.name} className="flex items-start space-x-3">
                                  <Checkbox
                                    id={permission.name}
                                    checked={hasPermission}
                                    onCheckedChange={() => togglePermission(permission.name, hasPermission)}
                                    className="mt-1"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <label
                                      htmlFor={permission.name}
                                      className="text-sm font-medium cursor-pointer"
                                    >
                                      {permission.display_name}
                                    </label>
                                    {permission.description && (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        {permission.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {category !== Object.keys(groupedPermissions)[Object.keys(groupedPermissions).length - 1] && (
                            <Separator className="mt-4" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Documents Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Documents & E-Signing
                  </CardTitle>
                  <CardDescription>
                    Upload onboarding documents and send for e-signature
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center">
                    <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-2 text-sm font-semibold">Upload Documents</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Upload contracts, forms, and other onboarding documents
                    </p>
                    <Button variant="outline" size="sm" className="mt-2">
                      <Upload className="h-4 w-4 mr-2" />
                      Choose Files
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Common Documents:</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm">Employment Agreement</Button>
                      <Button variant="outline" size="sm">W-4 Form</Button>
                      <Button variant="outline" size="sm">I-9 Form</Button>
                      <Button variant="outline" size="sm">Direct Deposit</Button>
                    </div>
                  </div>

                  <Separator />
                  
                  <div>
                    <h4 className="text-sm font-medium mb-2">Document Status:</h4>
                    <p className="text-sm text-muted-foreground">
                      No documents uploaded yet. Upload documents and they will appear here for e-signing.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeamManagement;