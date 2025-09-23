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
import { MapPin, Plus, Edit2, Building2, Users, Trash2, Phone, Mail, User, AlertTriangle, Calendar, DollarSign, FileText, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import QualityControlDashboard from './QualityControlDashboard';

interface JobSite {
  id: string;
  name: string;
  address: string | null;
  client_name: string | null;
  contact_person: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  project_manager: string | null;
  estimated_duration: string | null;
  budget_info: string | null;
  special_instructions: string | null;
  safety_requirements: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface FormData {
  name: string;
  address: string;
  client_name: string;
  contact_person: string;
  contact_phone: string;
  contact_email: string;
  project_manager: string;
  estimated_duration: string;
  budget_info: string;
  special_instructions: string;
  safety_requirements: string;
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
  
  // Form state
  const [formData, setFormData] = useState<FormData>({
    name: '',
    address: '',
    client_name: '',
    contact_person: '',
    contact_phone: '',
    contact_email: '',
    project_manager: '',
    estimated_duration: '',
    budget_info: '',
    special_instructions: '',
    safety_requirements: '',
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
          contact_person: formData.contact_person.trim() || null,
          contact_phone: formData.contact_phone.trim() || null,
          contact_email: formData.contact_email.trim() || null,
          project_manager: formData.project_manager.trim() || null,
          estimated_duration: formData.estimated_duration.trim() || null,
          budget_info: formData.budget_info.trim() || null,
          special_instructions: formData.special_instructions.trim() || null,
          safety_requirements: formData.safety_requirements.trim() || null,
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
          contact_person: formData.contact_person.trim() || null,
          contact_phone: formData.contact_phone.trim() || null,
          contact_email: formData.contact_email.trim() || null,
          project_manager: formData.project_manager.trim() || null,
          estimated_duration: formData.estimated_duration.trim() || null,
          budget_info: formData.budget_info.trim() || null,
          special_instructions: formData.special_instructions.trim() || null,
          safety_requirements: formData.safety_requirements.trim() || null,
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
      contact_person: jobSite.contact_person || '',
      contact_phone: jobSite.contact_phone || '',
      contact_email: jobSite.contact_email || '',
      project_manager: jobSite.project_manager || '',
      estimated_duration: jobSite.estimated_duration || '',
      budget_info: jobSite.budget_info || '',
      special_instructions: jobSite.special_instructions || '',
      safety_requirements: jobSite.safety_requirements || '',
      active: jobSite.active
    });
    setIsEditDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({ 
      name: '', 
      address: '', 
      client_name: '', 
      contact_person: '',
      contact_phone: '',
      contact_email: '',
      project_manager: '',
      estimated_duration: '',
      budget_info: '',
      special_instructions: '',
      safety_requirements: '',
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
                      <Label htmlFor="project_manager">Project Manager</Label>
                      <Input
                        id="project_manager"
                        value={formData.project_manager}
                        onChange={(e) => setFormData({ ...formData, project_manager: e.target.value })}
                        placeholder="Project manager name..."
                      />
                    </div>
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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-6">
                      <div>
                        <Label htmlFor="contact_person">Contact Person</Label>
                        <Input
                          id="contact_person"
                          value={formData.contact_person}
                          onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                          placeholder="Primary contact name..."
                        />
                      </div>
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

                  {/* Project Information Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <Label className="font-semibold">Project Information</Label>
                    </div>
                    <div className="grid grid-cols-1 gap-4 pl-6">
                      <div>
                        <Label htmlFor="estimated_duration">Estimated Duration</Label>
                        <Input
                          id="estimated_duration"
                          value={formData.estimated_duration}
                          onChange={(e) => setFormData({ ...formData, estimated_duration: e.target.value })}
                          placeholder="e.g., 6 months, 2 weeks..."
                        />
                      </div>
                      <div>
                        <Label htmlFor="budget_info">Budget Information</Label>
                        <Textarea
                          id="budget_info"
                          value={formData.budget_info}
                          onChange={(e) => setFormData({ ...formData, budget_info: e.target.value })}
                          placeholder="Budget details, constraints, etc..."
                          className="min-h-[60px]"
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
                          placeholder="Special requirements, access instructions, etc..."
                          className="min-h-[60px]"
                        />
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
          </div>
        </TabsContent>

        <TabsContent value="quality" className="mt-6">
          <QualityControlDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
