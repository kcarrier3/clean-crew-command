import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Building2, Plus, Pencil, Trash2, Users, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface Department {
  id: string;
  name: string;
  description: string | null;
  color: string;
  active: boolean;
}

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
  email: string | null;
}

interface DepartmentManager {
  manager_id: string;
}

interface DepartmentEmployee {
  employee_id: string;
}

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#06b6d4', '#64748b', '#78716c',
];

const DepartmentManagement = () => {
  const { profile } = useAuth();
  const { toast } = useToast();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [allManagers, setAllManagers] = useState<Profile[]>([]);
  const [allEmployees, setAllEmployees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDept, setExpandedDept] = useState<string | null>(null);

  // Per-department data
  const [deptManagers, setDeptManagers] = useState<Record<string, string[]>>({});
  const [deptEmployees, setDeptEmployees] = useState<Record<string, string[]>>({});

  // Dialog state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', color: '#6366f1' });
  const [saving, setSaving] = useState(false);

  const isAdmin = profile?.job_title === 'Owner' || profile?.job_title === 'Administrator';

  useEffect(() => {
    fetchDepartments();
    fetchManagers();
    fetchEmployees();
  }, []);

  const fetchDepartments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .eq('active', true)
      .order('name');
    if (error) {
      toast({ title: 'Error', description: 'Failed to load departments', variant: 'destructive' });
    } else {
      setDepartments(data || []);
      // Fetch assignments for all departments
      if (data && data.length > 0) {
        await fetchAllAssignments(data.map(d => d.id));
      }
    }
    setLoading(false);
  };

  const fetchAllAssignments = async (deptIds: string[]) => {
    const [managersRes, employeesRes] = await Promise.all([
      supabase.from('department_managers').select('department_id, manager_id').in('department_id', deptIds),
      supabase.from('department_employees').select('department_id, employee_id').in('department_id', deptIds),
    ]);

    const mgrsMap: Record<string, string[]> = {};
    const empMap: Record<string, string[]> = {};

    (managersRes.data || []).forEach(row => {
      if (!mgrsMap[row.department_id]) mgrsMap[row.department_id] = [];
      mgrsMap[row.department_id].push(row.manager_id);
    });

    (employeesRes.data || []).forEach(row => {
      if (!empMap[row.department_id]) empMap[row.department_id] = [];
      empMap[row.department_id].push(row.employee_id);
    });

    setDeptManagers(mgrsMap);
    setDeptEmployees(empMap);
  };

  const fetchManagers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, job_title, email')
      .eq('active', true)
      .in('job_title', ['Owner', 'Administrator', 'Janitorial Manager', 'Project Crew Lead', 'Supervisor'])
      .order('first_name');
    setAllManagers(data || []);
  };

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, job_title, email')
      .eq('active', true)
      .order('first_name');
    setAllEmployees(data || []);
  };

  const openCreate = () => {
    setFormData({ name: '', description: '', color: '#6366f1' });
    setEditingDept(null);
    setIsCreateOpen(true);
  };

  const openEdit = (dept: Department) => {
    setFormData({ name: dept.name, description: dept.description || '', color: dept.color });
    setEditingDept(dept);
    setIsCreateOpen(true);
  };

  const saveDepartment = async () => {
    if (!formData.name.trim()) {
      toast({ title: 'Error', description: 'Department name is required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    if (editingDept) {
      const { error } = await supabase
        .from('departments')
        .update({ name: formData.name, description: formData.description || null, color: formData.color, updated_at: new Date().toISOString() })
        .eq('id', editingDept.id);
      if (error) {
        toast({ title: 'Error', description: 'Failed to update department', variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Department updated' });
        setIsCreateOpen(false);
        fetchDepartments();
      }
    } else {
      const { error } = await supabase
        .from('departments')
        .insert({ name: formData.name, description: formData.description || null, color: formData.color });
      if (error) {
        toast({ title: 'Error', description: 'Failed to create department', variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Department created' });
        setIsCreateOpen(false);
        fetchDepartments();
      }
    }
    setSaving(false);
  };

  const deleteDepartment = async (dept: Department) => {
    if (!confirm(`Are you sure you want to delete the "${dept.name}" department? This cannot be undone.`)) return;
    const { error } = await supabase
      .from('departments')
      .update({ active: false })
      .eq('id', dept.id);
    if (error) {
      toast({ title: 'Error', description: 'Failed to delete department', variant: 'destructive' });
    } else {
      toast({ title: 'Deleted', description: `${dept.name} has been removed` });
      fetchDepartments();
    }
  };

  const toggleManager = async (deptId: string, managerId: string, isCurrentlyAssigned: boolean) => {
    if (isCurrentlyAssigned) {
      await supabase.from('department_managers').delete()
        .eq('department_id', deptId).eq('manager_id', managerId);
    } else {
      await supabase.from('department_managers').insert({ department_id: deptId, manager_id: managerId });
    }
    // Update local state
    setDeptManagers(prev => {
      const current = prev[deptId] || [];
      return {
        ...prev,
        [deptId]: isCurrentlyAssigned
          ? current.filter(id => id !== managerId)
          : [...current, managerId],
      };
    });
  };

  const toggleEmployee = async (deptId: string, employeeId: string, isCurrentlyAssigned: boolean) => {
    if (isCurrentlyAssigned) {
      await supabase.from('department_employees').delete()
        .eq('department_id', deptId).eq('employee_id', employeeId);
    } else {
      await supabase.from('department_employees').insert({ department_id: deptId, employee_id: employeeId });
    }
    setDeptEmployees(prev => {
      const current = prev[deptId] || [];
      return {
        ...prev,
        [deptId]: isCurrentlyAssigned
          ? current.filter(id => id !== employeeId)
          : [...current, employeeId],
      };
    });
  };

  const getManagerNames = (deptId: string) => {
    const ids = deptManagers[deptId] || [];
    return ids.map(id => {
      const m = allManagers.find(p => p.id === id);
      return m ? `${m.first_name} ${m.last_name}` : '';
    }).filter(Boolean);
  };

  const getEmployeeCount = (deptId: string) => (deptEmployees[deptId] || []).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading departments...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Departments</h2>
          <p className="text-sm text-muted-foreground">
            Create departments, assign managers, and organize your team.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            New Department
          </Button>
        )}
      </div>

      {departments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-1">No departments yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first department to start organizing your team and routing notifications.
            </p>
            {isAdmin && (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Create Department
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {departments.map(dept => {
            const isExpanded = expandedDept === dept.id;
            const managerNames = getManagerNames(dept.id);
            const employeeCount = getEmployeeCount(dept.id);

            return (
              <Card key={dept.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: dept.color }}
                      />
                      <div>
                        <CardTitle className="text-base">{dept.name}</CardTitle>
                        {dept.description && (
                          <CardDescription className="text-xs mt-0.5">{dept.description}</CardDescription>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        <Users className="h-3 w-3 mr-1" />
                        {employeeCount} {employeeCount === 1 ? 'employee' : 'employees'}
                      </Badge>
                      {isAdmin && (
                        <>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(dept)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteDepartment(dept)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setExpandedDept(isExpanded ? null : dept.id)}
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Manager summary */}
                  {managerNames.length > 0 && (
                    <div className="flex items-center gap-1 mt-2 flex-wrap">
                      <Shield className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Managers:</span>
                      {managerNames.map(name => (
                        <Badge key={name} variant="outline" className="text-xs py-0">
                          {name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardHeader>

                {isExpanded && (
                  <CardContent className="pt-0 space-y-5">
                    <Separator />

                    {/* Managers assignment */}
                    <div>
                      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Assigned Managers
                        <span className="text-xs text-muted-foreground font-normal">
                          (receive notifications for this department)
                        </span>
                      </h4>
                      {allManagers.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No managers found. Assign a supervisory job title to an employee first.</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {allManagers.map(mgr => {
                            const assigned = (deptManagers[dept.id] || []).includes(mgr.id);
                            return (
                              <div key={mgr.id} className="flex items-center space-x-2 p-2 border rounded-lg">
                                <Checkbox
                                  id={`mgr-${dept.id}-${mgr.id}`}
                                  checked={assigned}
                                  disabled={!isAdmin}
                                  onCheckedChange={() => toggleManager(dept.id, mgr.id, assigned)}
                                />
                                <label
                                  htmlFor={`mgr-${dept.id}-${mgr.id}`}
                                  className="flex-1 text-sm cursor-pointer"
                                >
                                  <span className="font-medium">{mgr.first_name} {mgr.last_name}</span>
                                  {mgr.job_title && (
                                    <span className="text-xs text-muted-foreground ml-1">· {mgr.job_title}</span>
                                  )}
                                </label>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Employees assignment */}
                    <div>
                      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Assigned Employees
                        <span className="text-xs text-muted-foreground font-normal">
                          (their punch alerts go to this department's managers)
                        </span>
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                        {allEmployees.map(emp => {
                          const assigned = (deptEmployees[dept.id] || []).includes(emp.id);
                          return (
                            <div key={emp.id} className="flex items-center space-x-2 p-2 border rounded-lg">
                              <Checkbox
                                id={`emp-${dept.id}-${emp.id}`}
                                checked={assigned}
                                disabled={!isAdmin}
                                onCheckedChange={() => toggleEmployee(dept.id, emp.id, assigned)}
                              />
                              <label
                                htmlFor={`emp-${dept.id}-${emp.id}`}
                                className="flex-1 text-sm cursor-pointer"
                              >
                                <span className="font-medium">{emp.first_name} {emp.last_name}</span>
                                {emp.job_title && (
                                  <span className="text-xs text-muted-foreground ml-1">· {emp.job_title}</span>
                                )}
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingDept ? 'Edit Department' : 'Create Department'}</DialogTitle>
            <DialogDescription>
              {editingDept
                ? 'Update the department name, description, and color.'
                : 'Add a new department to organize your team and route notifications.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="dept_name">Department Name *</Label>
              <Input
                id="dept_name"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Night Crew, Project Team, Day Shift"
              />
            </div>

            <div>
              <Label htmlFor="dept_desc">Description</Label>
              <Input
                id="dept_desc"
                value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Optional description"
              />
            </div>

            <div>
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {PRESET_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                      formData.color === color ? 'border-foreground scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData(prev => ({ ...prev, color }))}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={saveDepartment} disabled={saving}>
                {saving ? 'Saving...' : editingDept ? 'Save Changes' : 'Create Department'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DepartmentManagement;
