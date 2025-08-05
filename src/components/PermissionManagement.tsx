import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Users, Settings, Shield } from 'lucide-react';
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

const PermissionManagement = () => {
  const { canManageEmployees } = useAuth();
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [userPermissions, setUserPermissions] = useState<UserPermissionWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (canManageEmployees()) {
      fetchEmployees();
      fetchPermissions();
    }
  }, [canManageEmployees]);

  useEffect(() => {
    if (selectedEmployee) {
      fetchUserPermissions(selectedEmployee);
    }
  }, [selectedEmployee]);

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, employee_id, job_title')
        .eq('active', true)
        .order('first_name');

      if (error) {
        console.error('Error fetching employees:', error);
        return;
      }

      setEmployees(data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchPermissions = async () => {
    try {
      const { data, error } = await supabase
        .from('permissions')
        .select('*')
        .order('category, display_name');

      if (error) {
        console.error('Error fetching permissions:', error);
        return;
      }

      setPermissions(data || []);
    } catch (error) {
      console.error('Error fetching permissions:', error);
    }
  };

  const fetchUserPermissions = async (userId: string) => {
    try {
      // First get user permissions
      const { data: userPerms, error: userPermsError } = await supabase
        .from('user_permissions')
        .select('permission')
        .eq('user_id', userId);

      if (userPermsError) {
        console.error('Error fetching user permissions:', userPermsError);
        return;
      }

      // Then get permission details
      const { data: permDetails, error: permDetailsError } = await supabase
        .from('permissions')
        .select('name, display_name, category');

      if (permDetailsError) {
        console.error('Error fetching permission details:', permDetailsError);
        return;
      }

      // Combine the data
      const formattedPermissions = userPerms?.map(userPerm => {
        const permDetail = permDetails?.find(detail => detail.name === userPerm.permission);
        return {
          permission: userPerm.permission,
          display_name: permDetail?.display_name || userPerm.permission,
          category: permDetail?.category || 'Other'
        };
      }) || [];

      setUserPermissions(formattedPermissions);
    } catch (error) {
      console.error('Error fetching user permissions:', error);
    }
  };

  const togglePermission = async (permissionName: string, hasPermission: boolean) => {
    if (!selectedEmployee) return;

    setLoading(true);

    try {
      if (hasPermission) {
        // Remove permission - use any to bypass type checking for dynamic permission values
        const { error } = await supabase
          .from('user_permissions')
          .delete()
          .eq('user_id', selectedEmployee)
          .eq('permission', permissionName as any);

        if (error) {
          throw error;
        }

        setUserPermissions(prev => prev.filter(p => p.permission !== permissionName));
        toast({
          title: "Permission Removed",
          description: `Permission removed successfully.`
        });
      } else {
        // Add permission - use any to bypass type checking for dynamic permission values
        const { error } = await supabase
          .from('user_permissions')
          .insert({
            user_id: selectedEmployee,
            permission: permissionName as any
          });

        if (error) {
          throw error;
        }

        const permission = permissions.find(p => p.name === permissionName);
        if (permission) {
          setUserPermissions(prev => [...prev, {
            permission: permissionName,
            display_name: permission.display_name,
            category: permission.category
          }]);
        }

        toast({
          title: "Permission Granted",
          description: `Permission granted successfully.`
        });
      }
    } catch (error: any) {
      console.error('Error updating permission:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update permission",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const hasUserPermission = (permissionName: string) => {
    return userPermissions.some(p => p.permission === permissionName);
  };

  const filteredEmployees = employees.filter(emp => 
    `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.employee_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groupedPermissions = permissions.reduce((acc, permission) => {
    const category = permission.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(permission);
    return acc;
  }, {} as Record<string, Permission[]>);

  if (!canManageEmployees()) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Access Denied
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            You don't have permission to manage employee permissions.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Permission Management</h2>
        <p className="text-muted-foreground">
          Manage individual employee access permissions for different features.
        </p>
      </div>

      <Tabs defaultValue="permissions" className="w-full">
        <TabsList>
          <TabsTrigger value="permissions">User Permissions</TabsTrigger>
          <TabsTrigger value="overview">Permissions Overview</TabsTrigger>
        </TabsList>

        <TabsContent value="permissions" className="space-y-6">
          {/* Employee Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Select Employee
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Search employees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an employee to manage" />
                </SelectTrigger>
                <SelectContent>
                  {filteredEmployees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.first_name} {employee.last_name}
                      {employee.employee_id && ` (${employee.employee_id})`}
                      {employee.job_title && ` - ${employee.job_title}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Permission Management */}
          {selectedEmployee && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Permissions
                </CardTitle>
                <CardDescription>
                  Toggle permissions for {employees.find(e => e.id === selectedEmployee)?.first_name} {employees.find(e => e.id === selectedEmployee)?.last_name}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {Object.entries(groupedPermissions).map(([category, categoryPermissions]) => (
                    <div key={category} className="space-y-3">
                      <h4 className="font-medium text-lg">{category}</h4>
                      <div className="grid gap-3">
                        {categoryPermissions.map((permission) => {
                          const hasPermission = hasUserPermission(permission.name);
                          return (
                            <div key={permission.name} className="flex items-center space-x-3 p-3 border rounded-lg">
                              <Checkbox
                                checked={hasPermission}
                                disabled={loading}
                                onCheckedChange={() => togglePermission(permission.name, hasPermission)}
                              />
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{permission.display_name}</span>
                                  {hasPermission && <Badge variant="secondary" className="text-xs">Granted</Badge>}
                                </div>
                                {permission.description && (
                                  <p className="text-sm text-muted-foreground">
                                    {permission.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Available Permissions</CardTitle>
              <CardDescription>
                Overview of all available permissions in the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {Object.entries(groupedPermissions).map(([category, categoryPermissions]) => (
                  <div key={category} className="space-y-3">
                    <h4 className="font-medium text-lg">{category}</h4>
                    <div className="grid gap-2">
                      {categoryPermissions.map((permission) => (
                        <div key={permission.name} className="p-3 border rounded-lg">
                          <div className="font-medium">{permission.display_name}</div>
                          {permission.description && (
                            <p className="text-sm text-muted-foreground">
                              {permission.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PermissionManagement;