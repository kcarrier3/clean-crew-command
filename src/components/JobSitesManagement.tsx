import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { MapPin, Plus, Edit2, Building2, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface JobSite {
  id: string;
  name: string;
  address: string | null;
  client_name: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface FormData {
  name: string;
  address: string;
  client_name: string;
  active: boolean;
}

export default function JobSitesManagement() {
  const { toast } = useToast();
  const { isManager } = useAuth();
  const [jobSites, setJobSites] = useState<JobSite[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingJobSite, setEditingJobSite] = useState<JobSite | null>(null);
  
  // Form state
  const [formData, setFormData] = useState<FormData>({
    name: '',
    address: '',
    client_name: '',
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
          active: formData.active
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Job site created successfully"
      });

      // Reset form and close dialog
      setFormData({ name: '', address: '', client_name: '', active: true });
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
          active: formData.active
        })
        .eq('id', editingJobSite.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Job site updated successfully"
      });

      // Reset form and close dialog
      setFormData({ name: '', address: '', client_name: '', active: true });
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
      active: jobSite.active
    });
    setIsEditDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({ name: '', address: '', client_name: '', active: true });
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
              
              <div>
                <Label htmlFor="client_name">Client Name</Label>
                <Input
                  id="client_name"
                  value={formData.client_name}
                  onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                  placeholder="Enter client name..."
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                />
                <Label htmlFor="active">Active</Label>
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
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold">{site.name}</h3>
                      <div className="flex items-center gap-1">
                        <Badge variant="default" className="bg-green-100 text-green-800">
                          Active
                        </Badge>
                      </div>
                    </div>
                    
                    {site.address && (
                      <p className="text-sm text-muted-foreground mb-1">
                        📍 {site.address}
                      </p>
                    )}
                    
                    {site.client_name && (
                      <p className="text-sm text-muted-foreground mb-3">
                        👤 {site.client_name}
                      </p>
                    )}
                    
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditDialog(site)}
                        className="flex-1"
                      >
                        <Edit2 className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleJobSiteStatus(site)}
                        className="text-orange-600 hover:bg-orange-50"
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
      {inactiveJobSites.length > 0 && (
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
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-gray-700">{site.name}</h3>
                      <Badge variant="secondary">
                        Inactive
                      </Badge>
                    </div>
                    
                    {site.address && (
                      <p className="text-sm text-muted-foreground mb-1">
                        📍 {site.address}
                      </p>
                    )}
                    
                    {site.client_name && (
                      <p className="text-sm text-muted-foreground mb-3">
                        👤 {site.client_name}
                      </p>
                    )}
                    
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditDialog(site)}
                        className="flex-1"
                      >
                        <Edit2 className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleJobSiteStatus(site)}
                        className="text-green-600 hover:bg-green-50"
                      >
                        Activate
                      </Button>
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
        if (!open) resetForm();
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