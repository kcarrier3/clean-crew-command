import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface Role {
  id: string;
  name: string;
  description: string | null;
  is_system_role: boolean;
  created_at: string;
  updated_at: string;
}

interface Permission {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  category: string;
}

interface RolePermission {
  role_id: string;
  permission: string;
}

export function RoleManagement() {
  const { hasRole } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({});
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = hasRole('admin');

  useEffect(() => {
    if (isAdmin) {
      fetchRoles();
      fetchPermissions();
    } else {
      setLoading(false);
    }
  }, [isAdmin]);

  const fetchRoles = async () => {
    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .order('name');

    if (error) {
      toast.error('Failed to load roles');
      console.error(error);
    } else {
      setRoles(data || []);
      // Fetch permissions for each role
      data?.forEach(role => fetchRolePermissions(role.id));
    }
  };

  const fetchPermissions = async () => {
    const { data, error } = await supabase
      .from('permissions')
      .select('*')
      .order('category', { ascending: true });

    if (error) {
      toast.error('Failed to load permissions');
      console.error(error);
    } else {
      setPermissions(data || []);
      setLoading(false);
    }
  };

  const fetchRolePermissions = async (roleId: string) => {
    const { data, error } = await supabase
      .from('role_permissions')
      .select('permission')
      .eq('role_id', roleId);

    if (error) {
      console.error('Failed to load role permissions', error);
    } else {
      setRolePermissions(prev => ({
        ...prev,
        [roleId]: data?.map(rp => rp.permission) || []
      }));
    }
  };

  const createRole = async () => {
    if (!newRoleName.trim()) {
      toast.error('Role name is required');
      return;
    }

    const { data: roleData, error: roleError } = await supabase
      .from('roles')
      .insert({
        name: newRoleName,
        description: newRoleDescription || null,
        is_system_role: false
      })
      .select()
      .single();

    if (roleError) {
      toast.error('Failed to create role');
      console.error(roleError);
      return;
    }

    // Add permissions to the new role
    if (selectedPermissions.length > 0) {
      const permissionInserts = selectedPermissions.map(permission => ({
        role_id: roleData.id,
        permission: permission as any
      }));

      const { error: permError } = await supabase
        .from('role_permissions')
        .insert(permissionInserts);

      if (permError) {
        toast.error('Failed to assign permissions');
        console.error(permError);
      }
    }

    toast.success('Role created successfully');
    setIsCreateDialogOpen(false);
    setNewRoleName('');
    setNewRoleDescription('');
    setSelectedPermissions([]);
    fetchRoles();
  };

  const updateRole = async () => {
    if (!selectedRole) return;

    const { error: roleError } = await supabase
      .from('roles')
      .update({
        name: newRoleName,
        description: newRoleDescription || null
      })
      .eq('id', selectedRole.id);

    if (roleError) {
      toast.error('Failed to update role');
      console.error(roleError);
      return;
    }

    // Delete existing permissions
    await supabase
      .from('role_permissions')
      .delete()
      .eq('role_id', selectedRole.id);

    // Add new permissions
    if (selectedPermissions.length > 0) {
      const permissionInserts = selectedPermissions.map(permission => ({
        role_id: selectedRole.id,
        permission: permission as any
      }));

      const { error: permError } = await supabase
        .from('role_permissions')
        .insert(permissionInserts);

      if (permError) {
        toast.error('Failed to update permissions');
        console.error(permError);
      }
    }

    toast.success('Role updated successfully');
    setIsEditDialogOpen(false);
    setSelectedRole(null);
    setNewRoleName('');
    setNewRoleDescription('');
    setSelectedPermissions([]);
    fetchRoles();
  };

  const deleteRole = async (roleId: string) => {
    if (!confirm('Are you sure you want to delete this role? This will remove it from all users.')) {
      return;
    }

    const { error } = await supabase
      .from('roles')
      .delete()
      .eq('id', roleId);

    if (error) {
      toast.error('Failed to delete role');
      console.error(error);
    } else {
      toast.success('Role deleted successfully');
      fetchRoles();
    }
  };

  const openEditDialog = (role: Role) => {
    setSelectedRole(role);
    setNewRoleName(role.name);
    setNewRoleDescription(role.description || '');
    setSelectedPermissions(rolePermissions[role.id] || []);
    setIsEditDialogOpen(true);
  };

  const togglePermission = (permissionName: string) => {
    setSelectedPermissions(prev => 
      prev.includes(permissionName)
        ? prev.filter(p => p !== permissionName)
        : [...prev, permissionName]
    );
  };

  const groupedPermissions = permissions.reduce((acc, perm) => {
    if (!acc[perm.category]) {
      acc[perm.category] = [];
    }
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  if (!isAdmin) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          You don't have permission to access role management.
        </AlertDescription>
      </Alert>
    );
  }

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">Role Management</h2>
          <p className="text-muted-foreground">Create custom roles and assign permissions</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Role
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Role</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="roleName">Role Name</Label>
                <Input
                  id="roleName"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="e.g., Project Lead"
                />
              </div>
              <div>
                <Label htmlFor="roleDescription">Description</Label>
                <Textarea
                  id="roleDescription"
                  value={newRoleDescription}
                  onChange={(e) => setNewRoleDescription(e.target.value)}
                  placeholder="Describe the role's responsibilities"
                />
              </div>
              <div>
                <Label>Permissions</Label>
                <div className="space-y-4 mt-2 max-h-96 overflow-y-auto">
                  {Object.entries(groupedPermissions).map(([category, perms]) => (
                    <Card key={category}>
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm">{category}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {perms.map((perm) => (
                          <div key={perm.name} className="flex items-center space-x-2">
                            <Checkbox
                              id={`create-${perm.name}`}
                              checked={selectedPermissions.includes(perm.name)}
                              onCheckedChange={() => togglePermission(perm.name)}
                            />
                            <label
                              htmlFor={`create-${perm.name}`}
                              className="text-sm cursor-pointer flex-1"
                            >
                              <div className="font-medium">{perm.display_name}</div>
                              {perm.description && (
                                <div className="text-xs text-muted-foreground">{perm.description}</div>
                              )}
                            </label>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={createRole}>Create Role</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {roles.map((role) => (
          <Card key={role.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{role.name}</CardTitle>
                  <CardDescription>{role.description}</CardDescription>
                </div>
                {!role.is_system_role && (
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(role)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteRole(role.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm">
                <strong>Permissions:</strong>
                {rolePermissions[role.id]?.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {rolePermissions[role.id].map(permName => {
                      const perm = permissions.find(p => p.name === permName);
                      return perm ? (
                        <span
                          key={permName}
                          className="px-2 py-1 bg-secondary text-secondary-foreground rounded-md text-xs"
                        >
                          {perm.display_name}
                        </span>
                      ) : null;
                    })}
                  </div>
                ) : (
                  <span className="text-muted-foreground ml-2">No permissions assigned</span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="editRoleName">Role Name</Label>
              <Input
                id="editRoleName"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="editRoleDescription">Description</Label>
              <Textarea
                id="editRoleDescription"
                value={newRoleDescription}
                onChange={(e) => setNewRoleDescription(e.target.value)}
              />
            </div>
            <div>
              <Label>Permissions</Label>
              <div className="space-y-4 mt-2 max-h-96 overflow-y-auto">
                {Object.entries(groupedPermissions).map(([category, perms]) => (
                  <Card key={category}>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm">{category}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {perms.map((perm) => (
                        <div key={perm.name} className="flex items-center space-x-2">
                          <Checkbox
                            id={`edit-${perm.name}`}
                            checked={selectedPermissions.includes(perm.name)}
                            onCheckedChange={() => togglePermission(perm.name)}
                          />
                          <label
                            htmlFor={`edit-${perm.name}`}
                            className="text-sm cursor-pointer flex-1"
                          >
                            <div className="font-medium">{perm.display_name}</div>
                            {perm.description && (
                              <div className="text-xs text-muted-foreground">{perm.description}</div>
                            )}
                          </label>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={updateRole}>Update Role</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
