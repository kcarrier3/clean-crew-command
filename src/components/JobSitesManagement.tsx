import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { MapPin, Plus, Edit2, Building2, Users, Trash2, Phone, Mail, User, AlertTriangle, Calendar, DollarSign, FileText, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

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
        description: "Failed to fetch job sites",
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
        description: "Job site name is required",
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
        description: "Job site created successfully"
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
        description: "Failed to create job site",
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
        description: "Job site name is required",
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
        description: "Job site updated successfully"
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
        description: "Failed to update job site",
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
        description: `Job site ${!jobSite.active ? 'activated' : 'deactivated'} successfully`
      });

      fetchJobSites();
    } catch (error) {
      console.error('Error updating job site status:', error);
      toast({
        title: "Error",
        description: "Failed to update job site status",
        variant: "destructive"
      });
    }
  };

  const deleteJobSite = async (jobSite: JobSite) => {
    try {
      // First, check if the job site is referenced by other records
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
          title: "Cannot Delete Job Site",
          description: `This job site is still referenced by: ${references.join(', ')}. Please remove these references first or keep the job site inactive.`,
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
        description: "Job site deleted successfully"
      });

      fetchJobSites();
    } catch (error) {
      console.error('Error deleting job site:', error);
      toast({
        title: "Error",
        description: "Failed to delete job site. Please try again.",
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
          description: "This job site has no references and can be safely deleted.",
        });
        return { canDelete: true, references: { schedules, timeEntries, workOrders } };
      } else {
        let message = "This job site cannot be deleted because it has:\n";
        if (schedules.length > 0) message += `• ${schedules.length} employee schedule(s)\n`;
        if (timeEntries.length > 0) message += `• ${timeEntries.length} time entries\n`;
        if (workOrders.length > 0) message += `• ${workOrders.length} work order(s)\n`;
        message += "\nRemove these references first or keep the job site inactive.";
        
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
        description: "Failed to check job site references",
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
          <h2 className="text-2xl font-bold">Job Sites Management</h2>
          <p className="text-muted-foreground">Manage your company's job sites and locations</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="show-inactive"
              checked={showInactive}
              onCheckedChange={setShowInactive}
            />
            <Label htmlFor="show-inactive" className="text-sm">Show inactive sites</Label>
          </div>
          
          <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
            setIsCreateDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Job Site
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Job Site</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Job Site Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter job site name..."
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
                    placeholder="Enter job site address..."
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
                    {loading ? "Creating..." : "Create Job Site"}
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
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Building2 className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{jobSites.length}</p>
                <p className="text-sm text-muted-foreground">Total Job Sites</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <MapPin className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{activeJobSites.length}</p>
                <p className="text-sm text-muted-foreground">Active Sites</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{new Set(jobSites.map(site => site.client_name).filter(Boolean)).size}</p>
                <p className="text-sm text-muted-foreground">Unique Clients</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Job Sites */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-green-500" />
            Active Job Sites ({activeJobSites.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground mt-2">Loading job sites...</p>
            </div>
          ) : activeJobSites.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No active job sites</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeJobSites.map((site) => (
                <Card key={site.id} className="border-green-200 bg-green-50/50">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-semibold text-lg">{site.name}</h3>
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        Active
                      </Badge>
                    </div>
                    
                    {site.address && (
                      <p className="text-muted-foreground text-sm mb-2 flex items-start gap-1">
                        <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        {site.address}
                      </p>
                    )}
                    
                    {site.client_name && (
                      <p className="text-muted-foreground text-sm mb-2 flex items-center gap-1">
                        <User className="h-4 w-4 flex-shrink-0" />
                        {site.client_name}
                      </p>
                    )}

                    {site.contact_person && (
                      <p className="text-muted-foreground text-sm mb-2 flex items-center gap-1">
                        <Phone className="h-4 w-4 flex-shrink-0" />
                        {site.contact_person}
                        {site.contact_phone && ` (${site.contact_phone})`}
                      </p>
                    )}

                    {site.contact_email && (
                      <p className="text-muted-foreground text-sm mb-2 flex items-center gap-1">
                        <Mail className="h-4 w-4 flex-shrink-0" />
                        {site.contact_email}
                      </p>
                    )}

                    {site.project_manager && (
                      <p className="text-muted-foreground text-sm mb-2">
                        <strong>PM:</strong> {site.project_manager}
                      </p>
                    )}

                    {site.estimated_duration && (
                      <p className="text-muted-foreground text-sm mb-2 flex items-center gap-1">
                        <Calendar className="h-4 w-4 flex-shrink-0" />
                        {site.estimated_duration}
                      </p>
                    )}

                    {site.budget_info && (
                      <p className="text-muted-foreground text-sm mb-2 flex items-center gap-1">
                        <DollarSign className="h-4 w-4 flex-shrink-0" />
                        {site.budget_info.substring(0, 50)}{site.budget_info.length > 50 && '...'}
                      </p>
                    )}

                    {site.special_instructions && (
                      <p className="text-muted-foreground text-sm mb-2 flex items-center gap-1">
                        <FileText className="h-4 w-4 flex-shrink-0" />
                        {site.special_instructions.substring(0, 50)}{site.special_instructions.length > 50 && '...'}
                      </p>
                    )}

                    {site.safety_requirements && (
                      <p className="text-muted-foreground text-sm mb-3 flex items-center gap-1">
                        <Shield className="h-4 w-4 flex-shrink-0" />
                        {site.safety_requirements.substring(0, 50)}{site.safety_requirements.length > 50 && '...'}
                      </p>
                    )}
                    
                    <div className="flex gap-2 pt-2 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(site)}
                        className="flex-1"
                      >
                        <Edit2 className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleJobSiteStatus(site)}
                        className="bg-yellow-50 hover:bg-yellow-100"
                      >
                        Deactivate
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inactive Job Sites */}
      {showInactive && inactiveJobSites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-gray-500" />
              Inactive Job Sites ({inactiveJobSites.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {inactiveJobSites.map((site) => (
                <Card key={site.id} className="border-gray-200 bg-gray-50/50">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-semibold text-gray-700 text-lg">{site.name}</h3>
                      <Badge variant="secondary">
                        Inactive
                      </Badge>
                    </div>
                    
                    {site.address && (
                      <p className="text-muted-foreground text-sm mb-2 flex items-start gap-1">
                        <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        {site.address}
                      </p>
                    )}
                    
                    {site.client_name && (
                      <p className="text-muted-foreground text-sm mb-2 flex items-center gap-1">
                        <User className="h-4 w-4 flex-shrink-0" />
                        {site.client_name}
                      </p>
                    )}

                    {site.contact_person && (
                      <p className="text-muted-foreground text-sm mb-2 flex items-center gap-1">
                        <Phone className="h-4 w-4 flex-shrink-0" />
                        {site.contact_person}
                        {site.contact_phone && ` (${site.contact_phone})`}
                      </p>
                    )}

                    {site.contact_email && (
                      <p className="text-muted-foreground text-sm mb-2 flex items-center gap-1">
                        <Mail className="h-4 w-4 flex-shrink-0" />
                        {site.contact_email}
                      </p>
                    )}

                    {site.project_manager && (
                      <p className="text-muted-foreground text-sm mb-2">
                        <strong>PM:</strong> {site.project_manager}
                      </p>
                    )}

                    {site.estimated_duration && (
                      <p className="text-muted-foreground text-sm mb-2 flex items-center gap-1">
                        <Calendar className="h-4 w-4 flex-shrink-0" />
                        {site.estimated_duration}
                      </p>
                    )}

                    {site.budget_info && (
                      <p className="text-muted-foreground text-sm mb-2 flex items-center gap-1">
                        <DollarSign className="h-4 w-4 flex-shrink-0" />
                        {site.budget_info.substring(0, 50)}{site.budget_info.length > 50 && '...'}
                      </p>
                    )}

                    {site.special_instructions && (
                      <p className="text-muted-foreground text-sm mb-2 flex items-center gap-1">
                        <FileText className="h-4 w-4 flex-shrink-0" />
                        {site.special_instructions.substring(0, 50)}{site.special_instructions.length > 50 && '...'}
                      </p>
                    )}

                    {site.safety_requirements && (
                      <p className="text-muted-foreground text-sm mb-3 flex items-center gap-1">
                        <Shield className="h-4 w-4 flex-shrink-0" />
                        {site.safety_requirements.substring(0, 50)}{site.safety_requirements.length > 50 && '...'}
                      </p>
                    )}
                    
                    <div className="flex gap-2 pt-2 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(site)}
                        className="flex-1"
                      >
                        <Edit2 className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleJobSiteStatus(site)}
                        className="bg-green-50 hover:bg-green-100"
                      >
                        Reactivate
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => checkJobSiteReferences(site)}
                        className="bg-blue-50 hover:bg-blue-100"
                      >
                        <AlertTriangle className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline" 
                            size="sm"
                            className="bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Job Site</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to permanently delete "{site.name}"? This action cannot be undone.
                              <br /><br />
                              <strong>Warning:</strong> This will fail if the job site has any associated employee schedules, time entries, or work orders.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteJobSite(site)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Delete Permanently
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open);
        if (!open) {
          resetForm();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Job Site</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Job Site Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter job site name..."
              />
            </div>
            
            <div>
              <Label htmlFor="edit-address">Address</Label>
              <Textarea
                id="edit-address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Enter job site address..."
                className="min-h-[80px]"
              />
            </div>
            
            <div>
              <Label htmlFor="edit-client">Client Name</Label>
              <Input
                id="edit-client"
                value={formData.client_name}
                onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                placeholder="Enter client name..."
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="edit-active"
                checked={formData.active}
                onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
              />
              <Label htmlFor="edit-active">Active</Label>
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button 
                onClick={handleEdit} 
                disabled={loading || !formData.name.trim()}
                className="flex-1"
              >
                {loading ? "Updating..." : "Update Job Site"}
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
  );
}