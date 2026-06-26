import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { MapPin, Plus, Edit2, Building2, Users, Trash2, Phone, Mail, User, AlertTriangle, Calendar, DollarSign, FileText, Shield, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import QualityControlDashboard from './QualityControlDashboard';
import JobBudgetingWidget from './JobBudgetingWidget';
import { AccountDetail } from './AccountDetail';

interface JobSite {
  id: string;
  name: string;
  address: string | null;
  client_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  estimated_duration: string | null;
  budget_info: string | null;
  special_instructions: string | null;
  access_instructions: string | null;
  safety_requirements: string | null;
  is_recurring_monthly: boolean;
  budgeted_hours: number | null;
  used_hours: number | null;
  remaining_hours: number | null;
  current_month_used_hours: number | null;
  current_month_year: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface FormData {
  name: string;
  address: string;
  client_name: string;
  contact_phone: string;
  contact_email: string;
  estimated_duration: string;
  budget_info: string;
  special_instructions: string;
  access_instructions: string;
  safety_requirements: string;
  is_recurring_monthly: boolean;
  budgeted_hours: string;
  active: boolean;
}

export default function JobSitesManagement() {
  const { toast } = useToast();
  const { isManager } = useAuth();
  const [jobSites, setJobSites] = useState<JobSite[]>([]);
  const [loading, setLoading] = useState(false);
  const [showInactive, setShowInactive] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingJobSite, setEditingJobSite] = useState<JobSite | null>(null);
  const [activeTab, setActiveTab] = useState('accounts');
  const [selectedJobSite, setSelectedJobSite] = useState<JobSite | null>(null);
  
  // Form state
  const [formData, setFormData] = useState<FormData>({
    name: '',
    address: '',
    client_name: '',
    contact_phone: '',
    contact_email: '',
    estimated_duration: '',
    budget_info: '',
    special_instructions: '',
    access_instructions: '',
    safety_requirements: '',
    is_recurring_monthly: false,
    budgeted_hours: '',
    active: true
  });

  useEffect(() => {
    fetchJobSites();
  }, []);

  const fetchJobSites = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('job_sites')
        .select('*')
        .order('name');

      if (error) throw error;
      setJobSites(data || []);
    } catch (error) {
      console.error('Error fetching job sites:', error);
      toast({
        title: "Error",
        description: "Failed to fetch accounts",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Account name is required",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('job_sites')
        .insert({
          name: formData.name.trim(),
          address: formData.address.trim() || null,
          client_name: formData.client_name.trim() || null,
          contact_phone: formData.contact_phone.trim() || null,
          contact_email: formData.contact_email.trim() || null,
          estimated_duration: formData.estimated_duration.trim() || null,
          budget_info: formData.budget_info.trim() || null,
          special_instructions: formData.special_instructions.trim() || null,
          access_instructions: formData.access_instructions.trim() || null,
          safety_requirements: formData.safety_requirements.trim() || null,
          is_recurring_monthly: formData.is_recurring_monthly,
          budgeted_hours: formData.budgeted_hours ? parseFloat(formData.budgeted_hours) : null,
          active: formData.active
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Account created successfully"
      });

      // Reset form and close dialog
      resetForm();
      setIsCreateDialogOpen(false);
      
      // Refresh list
      fetchJobSites();
    } catch (error) {
      console.error('Error creating job site:', error);
      toast({
        title: "Error",
        description: "Failed to create account",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!editingJobSite || !formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Account name is required",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('job_sites')
        .update({
          name: formData.name.trim(),
          address: formData.address.trim() || null,
          client_name: formData.client_name.trim() || null,
          contact_phone: formData.contact_phone.trim() || null,
          contact_email: formData.contact_email.trim() || null,
          estimated_duration: formData.estimated_duration.trim() || null,
          budget_info: formData.budget_info.trim() || null,
          special_instructions: formData.special_instructions.trim() || null,
          access_instructions: formData.access_instructions.trim() || null,
          safety_requirements: formData.safety_requirements.trim() || null,
          is_recurring_monthly: formData.is_recurring_monthly,
          budgeted_hours: formData.budgeted_hours ? parseFloat(formData.budgeted_hours) : null,
          active: formData.active
        })
        .eq('id', editingJobSite.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Account updated successfully"
      });

      // Reset form and close dialog
      resetForm();
      setIsEditDialogOpen(false);
      setEditingJobSite(null);
      
      // Refresh list
      fetchJobSites();
    } catch (error) {
      console.error('Error updating job site:', error);
      toast({
        title: "Error",
        description: "Failed to update account",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (jobSite: JobSite) => {
    setEditingJobSite(jobSite);
    setFormData({
      name: jobSite.name,
      address: jobSite.address || '',
      client_name: jobSite.client_name || '',
      contact_phone: jobSite.contact_phone || '',
      contact_email: jobSite.contact_email || '',
      estimated_duration: jobSite.estimated_duration || '',
      budget_info: jobSite.budget_info || '',
      special_instructions: jobSite.special_instructions || '',
      access_instructions: jobSite.access_instructions || '',
      safety_requirements: jobSite.safety_requirements || '',
      is_recurring_monthly: jobSite.is_recurring_monthly || false,
      budgeted_hours: jobSite.budgeted_hours ? jobSite.budgeted_hours.toString() : '',
      active: jobSite.active
    });
    setIsEditDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({ 
      name: '', 
      address: '', 
      client_name: '', 
      contact_phone: '',
      contact_email: '',
      estimated_duration: '',
      budget_info: '',
      special_instructions: '',
      access_instructions: '',
      safety_requirements: '',
      is_recurring_monthly: false,
      budgeted_hours: '',
      active: true 
    });
    setEditingJobSite(null);
  };

  const toggleJobSiteStatus = async (jobSite: JobSite) => {
    try {
      const { error } = await supabase
        .from('job_sites')
        .update({ active: !jobSite.active })
        .eq('id', jobSite.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Account ${!jobSite.active ? 'activated' : 'deactivated'} successfully`
      });

      fetchJobSites();
    } catch (error) {
      console.error('Error updating job site status:', error);
      toast({
        title: "Error",
        description: "Failed to update account status",
        variant: "destructive"
      });
    }
  };

  const deleteJobSite = async (jobSite: JobSite) => {
    try {
      // First, check if the account is referenced by other records
      const [schedulesCheck, timeEntriesCheck, workOrdersCheck] = await Promise.all([
        supabase.from('employee_schedules').select('id').eq('job_site_id', jobSite.id).limit(1),
        supabase.from('time_entries').select('id').eq('job_site_id', jobSite.id).limit(1),
        supabase.from('work_orders').select('id').eq('job_site_id', jobSite.id).limit(1)
      ]);

      const hasSchedules = schedulesCheck.data && schedulesCheck.data.length > 0;
      const hasTimeEntries = timeEntriesCheck.data && timeEntriesCheck.data.length > 0;
      const hasWorkOrders = workOrdersCheck.data && workOrdersCheck.data.length > 0;

      if (hasSchedules || hasTimeEntries || hasWorkOrders) {
        const references = [];
        if (hasSchedules) references.push('employee schedules');
        if (hasTimeEntries) references.push('time entries');
        if (hasWorkOrders) references.push('work orders');
        
        toast({
          title: "Cannot Delete Account",
          description: `This account is still referenced by: ${references.join(', ')}. Please remove these references first or keep the account inactive.`,
          variant: "destructive"
        });
        return;
      }

      // If no references, proceed with deletion
      const { error } = await supabase
        .from('job_sites')
        .delete()
        .eq('id', jobSite.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Account deleted successfully"
      });

      fetchJobSites();
    } catch (error) {
      console.error('Error deleting job site:', error);
      toast({
        title: "Error",
        description: "Failed to delete account. Please try again.",
        variant: "destructive"
      });
    }
  };

  const checkJobSiteReferences = async (jobSite: JobSite) => {
    try {
      const [schedulesResult, timeEntriesResult, workOrdersResult] = await Promise.all([
        supabase.from('employee_schedules').select('id, employees(first_name, last_name)').eq('job_site_id', jobSite.id),
        supabase.from('time_entries').select('id, employees(first_name, last_name), clock_in').eq('job_site_id', jobSite.id).limit(10),
        supabase.from('work_orders').select('id, title, status').eq('job_site_id', jobSite.id).limit(10)
      ]);

      const schedules = schedulesResult.data || [];
      const timeEntries = timeEntriesResult.data || [];
      const workOrders = workOrdersResult.data || [];

      if (schedules.length === 0 && timeEntries.length === 0 && workOrders.length === 0) {
        toast({
          title: "Ready to Delete",
          description: "This account has no references and can be safely deleted.",
        });
        return { canDelete: true, references: { schedules, timeEntries, workOrders } };
      } else {
        let message = "This account cannot be deleted because it has:\n";
        if (schedules.length > 0) message += `• ${schedules.length} employee schedule(s)\n`;
        if (timeEntries.length > 0) message += `• ${timeEntries.length} time entries\n`;
        if (workOrders.length > 0) message += `• ${workOrders.length} work order(s)\n`;
        message += "\nRemove these references first or keep the account inactive.";
        
        toast({
          title: "Cannot Delete",
          description: message,
          variant: "destructive"
        });
        return { canDelete: false, references: { schedules, timeEntries, workOrders } };
      }
    } catch (error) {
      console.error('Error checking references:', error);
      toast({
        title: "Error",
        description: "Failed to check account references",
        variant: "destructive"
      });
      return { canDelete: false, references: { schedules: [], timeEntries: [], workOrders: [] } };
    }
  };

  if (!isManager()) {
    return (
      <Card>
        <CardContent className="p-8">
          <p className="text-muted-foreground text-center">Access denied. Manager privileges required.</p>
        </CardContent>
      </Card>
    );
  }

  const activeJobSites = jobSites.filter(site => site.active);
  const inactiveJobSites = jobSites.filter(site => !site.active);

  // Show account detail view if a job site is selected
  if (selectedJobSite) {
    return (
      <AccountDetail
        jobSite={selectedJobSite}
        onBack={() => setSelectedJobSite(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Account Management</h2>
          <p className="text-muted-foreground">Manage your company's accounts, locations, and quality control</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="quality">Quality Control</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="mt-6 space-y-6">
          <div className="flex items-center justify-end gap-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="show-inactive"
                checked={showInactive}
                onCheckedChange={setShowInactive}
              />
              <Label htmlFor="show-inactive" className="text-sm">Show inactive accounts</Label>
            </div>
            
            <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
              setIsCreateDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Account
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Account</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Account Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Enter account name..."
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="client_name">Client Name</Label>
                      <Input
                        id="client_name"
                        value={formData.client_name}
                        onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                        placeholder="Enter client name..."
                      />
                    </div>
                    <div>
                      <Label htmlFor="budgeted_hours">Budgeted Hours</Label>
                      <Input
                        id="budgeted_hours"
                        type="number"
                        min="0"
                        step="0.25"
                        value={formData.budgeted_hours}
                        onChange={(e) => setFormData({ ...formData, budgeted_hours: e.target.value })}
                        placeholder="Enter budgeted hours..."
                        disabled={formData.is_recurring_monthly}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Hours will be deducted from this budget when employees clock in (disabled for recurring accounts)
                      </p>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="is_recurring_monthly"
                        checked={formData.is_recurring_monthly}
                        onCheckedChange={(checked) => setFormData({ ...formData, is_recurring_monthly: checked, budgeted_hours: checked ? '' : formData.budgeted_hours })}
                      />
                      <Label htmlFor="is_recurring_monthly">Recurring Monthly Account</Label>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Recurring accounts don't track budgeted hours - hours are not deducted from a budget
                    </p>
                  </div>
                  
                  <div>
                    <Label htmlFor="address">Address</Label>
                    <Textarea
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Enter account address..."
                      className="min-h-[80px]"
                    />
                  </div>

                  {/* Contact Information Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      <Label className="font-semibold">Contact Information</Label>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                      <div>
                        <Label htmlFor="contact_phone">Phone</Label>
                        <Input
                          id="contact_phone"
                          value={formData.contact_phone}
                          onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                          placeholder="Phone number..."
                        />
                      </div>
                      <div>
                        <Label htmlFor="contact_email">Email</Label>
                        <Input
                          id="contact_email"
                          type="email"
                          value={formData.contact_email}
                          onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                          placeholder="Contact email..."
                        />
                      </div>
                    </div>
                  </div>


                  {/* Instructions & Safety Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <Label className="font-semibold">Instructions & Safety</Label>
                    </div>
                    <div className="grid grid-cols-1 gap-4 pl-6">
                      <div>
                        <Label htmlFor="special_instructions">Special Instructions</Label>
                        <Textarea
                          id="special_instructions"
                          value={formData.special_instructions}
                          onChange={(e) => setFormData({ ...formData, special_instructions: e.target.value })}
                          placeholder="General instructions and requirements..."
                          className="min-h-[60px]"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Lock className="h-3 w-3" />
                          <Label htmlFor="access_instructions">Access Instructions (Secure)</Label>
                        </div>
                        <Textarea
                          id="access_instructions"
                          value={formData.access_instructions}
                          onChange={(e) => setFormData({ ...formData, access_instructions: e.target.value })}
                          placeholder="Alarm codes, gate codes, keys, etc... (visible only to scheduled employees, floaters, and managers)"
                          className="min-h-[60px]"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Only visible to managers, floaters, and employees scheduled at this location
                        </p>
                      </div>
                      <div>
                        <Label htmlFor="safety_requirements">Safety Requirements</Label>
                        <Textarea
                          id="safety_requirements"
                          value={formData.safety_requirements}
                          onChange={(e) => setFormData({ ...formData, safety_requirements: e.target.value })}
                          placeholder="PPE requirements, safety protocols, etc..."
                          className="min-h-[60px]"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 pt-4">
                    <Button 
                      onClick={handleCreate} 
                      disabled={loading || !formData.name.trim()}
                      className="flex-1"
                    >
                      {loading ? "Creating..." : "Create Account"}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setIsCreateDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
              setIsEditDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Account</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="edit_name">Account Name *</Label>
                    <Input
                      id="edit_name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Enter account name..."
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edit_client_name">Client Name</Label>
                      <Input
                        id="edit_client_name"
                        value={formData.client_name}
                        onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                        placeholder="Enter client name..."
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_budgeted_hours">Budgeted Hours</Label>
                      <Input
                        id="edit_budgeted_hours"
                        type="number"
                        min="0"
                        step="0.25"
                        value={formData.budgeted_hours}
                        onChange={(e) => setFormData({ ...formData, budgeted_hours: e.target.value })}
                        placeholder="Enter budgeted hours..."
                        disabled={formData.is_recurring_monthly}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Hours will be deducted from this budget when employees clock in (disabled for recurring accounts)
                      </p>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="edit_is_recurring_monthly"
                        checked={formData.is_recurring_monthly}
                        onCheckedChange={(checked) => setFormData({ ...formData, is_recurring_monthly: checked, budgeted_hours: checked ? '' : formData.budgeted_hours })}
                      />
                      <Label htmlFor="edit_is_recurring_monthly">Recurring Monthly Account</Label>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Recurring accounts don't track budgeted hours - hours are not deducted from a budget
                    </p>
                  </div>
                  
                  <div>
                    <Label htmlFor="edit_address">Address</Label>
                    <Textarea
                      id="edit_address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Enter account address..."
                      className="min-h-[80px]"
                    />
                  </div>

                  {/* Contact Information Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      <Label className="font-semibold">Contact Information</Label>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                      <div>
                        <Label htmlFor="edit_contact_phone">Phone</Label>
                        <Input
                          id="edit_contact_phone"
                          value={formData.contact_phone}
                          onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                          placeholder="Phone number..."
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit_contact_email">Email</Label>
                        <Input
                          id="edit_contact_email"
                          type="email"
                          value={formData.contact_email}
                          onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                          placeholder="Contact email..."
                        />
                      </div>
                    </div>
                  </div>


                  {/* Instructions & Safety Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <Label className="font-semibold">Instructions & Safety</Label>
                    </div>
                    <div className="grid grid-cols-1 gap-4 pl-6">
                      <div>
                        <Label htmlFor="edit_special_instructions">Special Instructions</Label>
                        <Textarea
                          id="edit_special_instructions"
                          value={formData.special_instructions}
                          onChange={(e) => setFormData({ ...formData, special_instructions: e.target.value })}
                          placeholder="General instructions and requirements..."
                          className="min-h-[60px]"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Lock className="h-3 w-3" />
                          <Label htmlFor="edit_access_instructions">Access Instructions (Secure)</Label>
                        </div>
                        <Textarea
                          id="edit_access_instructions"
                          value={formData.access_instructions}
                          onChange={(e) => setFormData({ ...formData, access_instructions: e.target.value })}
                          placeholder="Alarm codes, gate codes, keys, etc... (visible only to scheduled employees, floaters, and managers)"
                          className="min-h-[60px]"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Only visible to managers, floaters, and employees scheduled at this location
                        </p>
                      </div>
                      <div>
                        <Label htmlFor="edit_safety_requirements">Safety Requirements</Label>
                        <Textarea
                          id="edit_safety_requirements"
                          value={formData.safety_requirements}
                          onChange={(e) => setFormData({ ...formData, safety_requirements: e.target.value })}
                          placeholder="PPE requirements, safety protocols, etc..."
                          className="min-h-[60px]"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 pt-4">
                    <Button 
                      onClick={handleEdit} 
                      disabled={loading || !formData.name.trim()}
                      className="flex-1"
                    >
                      {loading ? "Saving..." : "Save Changes"}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setIsEditDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Job Sites List */}
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-muted-foreground mt-2">Loading accounts...</p>
              </div>
            ) : (
              <>
                {/* Active Job Sites */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Active Accounts ({activeJobSites.length})
                  </h3>
                  {activeJobSites.length === 0 ? (
                    <Card>
                      <CardContent className="p-8 text-center">
                        <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">No active accounts found</p>
                        <p className="text-sm text-muted-foreground mt-1">Create your first account to get started</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid gap-4">
                      {activeJobSites.map((jobSite) => (
                        <Card key={jobSite.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedJobSite(jobSite)}>
                          <CardContent className="p-4 md:p-6">
                            <div className="flex items-start justify-between gap-2 flex-wrap md:flex-nowrap">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 md:gap-3 mb-2 flex-wrap">
                                  <h3 className="text-base md:text-lg font-semibold break-words">{jobSite.name}</h3>
                                  <div className="flex gap-2">
                                    <Badge variant="default">Active</Badge>
                                    {jobSite.is_recurring_monthly && (
                                      <Badge variant="secondary">Recurring</Badge>
                                    )}
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                  <div className="space-y-2 min-w-0">
                                    {jobSite.client_name && (
                                      <p className="text-sm break-words"><strong>Client:</strong> {jobSite.client_name}</p>
                                    )}
                                    {jobSite.address && (
                                      <p className="text-sm break-words"><strong>Address:</strong> {jobSite.address}</p>
                                    )}
                                    {jobSite.contact_phone && (
                                      <p className="text-sm break-words"><strong>Phone:</strong> {jobSite.contact_phone}</p>
                                    )}
                                    {jobSite.contact_email && (
                                      <p className="text-sm break-all"><strong>Email:</strong> {jobSite.contact_email}</p>
                                    )}
                                  </div>

                                  <div className="space-y-2 min-w-0">
                                    {jobSite.estimated_duration && (
                                      <p className="text-sm break-words"><strong>Duration:</strong> {jobSite.estimated_duration}</p>
                                    )}
                                    {jobSite.budget_info && (
                                      <p className="text-sm break-words"><strong>Budget:</strong> {jobSite.budget_info}</p>
                                    )}
                                  </div>
                                </div>

                                {/* Budget Widget */}
                                {jobSite.budgeted_hours && (
                                  <div className="mt-4">
                                    <JobBudgetingWidget jobSite={jobSite} />
                                  </div>
                                )}

                                {/* Instructions and Safety */}
                                {(jobSite.special_instructions || jobSite.access_instructions || jobSite.safety_requirements) && (
                                  <div className="mt-4 space-y-2 pt-4 border-t">
                                    {jobSite.special_instructions && (
                                      <div>
                                        <p className="text-sm font-semibold flex items-center gap-1">
                                          <FileText className="h-3 w-3" />
                                          Special Instructions
                                        </p>
                                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{jobSite.special_instructions}</p>
                                      </div>
                                    )}
                                    {jobSite.access_instructions && (
                                      <div>
                                        <p className="text-sm font-semibold flex items-center gap-1">
                                          <Lock className="h-3 w-3" />
                                          Access Instructions
                                          <Badge variant="outline" className="ml-2 text-xs">Secure</Badge>
                                        </p>
                                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{jobSite.access_instructions}</p>
                                      </div>
                                    )}
                                    {jobSite.safety_requirements && (
                                      <div>
                                        <p className="text-sm font-semibold flex items-center gap-1">
                                          <Shield className="h-3 w-3" />
                                          Safety Requirements
                                        </p>
                                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{jobSite.safety_requirements}</p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>

                              <div className="flex gap-2 md:ml-4 shrink-0">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => { e.stopPropagation(); openEditDialog(jobSite); }}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => { e.stopPropagation(); toggleJobSiteStatus(jobSite); }}
                                >
                                  <Switch className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="text-destructive hover:text-destructive"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Account</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete "{jobSite.name}"? This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => deleteJobSite(jobSite)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                {/* Inactive Job Sites */}
                {showInactive && inactiveJobSites.length > 0 && (
                  <div className="space-y-4 mt-8">
                    <h3 className="text-lg font-semibold flex items-center gap-2 text-muted-foreground">
                      <Building2 className="h-5 w-5" />
                      Inactive Accounts ({inactiveJobSites.length})
                    </h3>
                    <div className="grid gap-4">
                      {inactiveJobSites.map((jobSite) => (
                        <Card key={jobSite.id} className="opacity-60">
                          <CardContent className="p-4 md:p-6">
                            <div className="flex items-start justify-between gap-2 flex-wrap md:flex-nowrap">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 md:gap-3 mb-2 flex-wrap">
                                  <h3 className="text-base md:text-lg font-semibold break-words">{jobSite.name}</h3>
                                  <Badge variant="secondary">Inactive</Badge>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                  <div className="space-y-2 min-w-0">
                                    {jobSite.client_name && (
                                      <p className="text-sm break-words"><strong>Client:</strong> {jobSite.client_name}</p>
                                    )}
                                    {jobSite.address && (
                                      <p className="text-sm break-words"><strong>Address:</strong> {jobSite.address}</p>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex gap-2 md:ml-4 shrink-0">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => { e.stopPropagation(); openEditDialog(jobSite); }}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => { e.stopPropagation(); toggleJobSiteStatus(jobSite); }}
                                >
                                  <Switch className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="text-destructive hover:text-destructive"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Inactive Account</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to permanently delete "{jobSite.name}"? This action cannot be undone. Accounts with existing schedules, time entries, or work orders cannot be deleted.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => deleteJobSite(jobSite)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="quality" className="mt-6">
          <QualityControlDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
