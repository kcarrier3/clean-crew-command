import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Camera, X } from 'lucide-react';

interface CreateWorkOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface JobSite {
  id: string;
  name: string;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
}

export const CreateWorkOrderDialog = ({ open, onOpenChange, onSuccess }: CreateWorkOrderDialogProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [jobSiteId, setJobSiteId] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [jobSites, setJobSites] = useState<JobSite[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchJobSites();
      fetchEmployees();
    }
  }, [open]);

  const fetchJobSites = async () => {
    const { data, error } = await supabase
      .from('job_sites')
      .select('id, name')
      .eq('active', true);
    
    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch job sites",
        variant: "destructive",
      });
    } else {
      setJobSites(data || []);
    }
  };

  const fetchEmployees = async () => {
    const { data, error } = await supabase
      .from('employees')
      .select('id, first_name, last_name')
      .eq('active', true);
    
    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch employees",
        variant: "destructive",
      });
    } else {
      setEmployees(data || []);
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setPhotos(prev => [...prev, ...files]);
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const uploadPhoto = async (file: File, workOrderId: string) => {
    const fileName = `${workOrderId}/${Date.now()}-${file.name}`;
    
    const { error: uploadError } = await supabase.storage
      .from('work-order-photos')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { error: dbError } = await supabase
      .from('work_order_photos')
      .insert({
        work_order_id: workOrderId,
        photo_url: fileName,
        photo_type: 'deficiency',
        uploaded_by: 'current-user' // TODO: Replace with actual user ID when auth is implemented
      });

    if (dbError) throw dbError;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description || !jobSiteId || !assignedTo || !dueDate) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Create work order
      const { data: workOrder, error: workOrderError } = await supabase
        .from('work_orders')
        .insert({
          title,
          description,
          priority,
          job_site_id: jobSiteId,
          assigned_to: assignedTo,
          due_date: dueDate,
          created_by: 'current-user' // TODO: Replace with actual user ID when auth is implemented
        })
        .select()
        .single();

      if (workOrderError) throw workOrderError;

      // Upload photos
      for (const photo of photos) {
        await uploadPhoto(photo, workOrder.id);
      }

      toast({
        title: "Success",
        description: "Work order created successfully",
      });

      // Reset form
      setTitle('');
      setDescription('');
      setPriority('medium');
      setJobSiteId('');
      setAssignedTo('');
      setDueDate('');
      setPhotos([]);
      
      onSuccess();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create work order",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Work Order</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter work order title"
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the quality issue or deficiency"
              rows={3}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="priority">Priority *</Label>
              <Select value={priority} onValueChange={(value: any) => setPriority(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="dueDate">Due Date *</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="jobSite">Job Site *</Label>
            <Select value={jobSiteId} onValueChange={setJobSiteId}>
              <SelectTrigger>
                <SelectValue placeholder="Select job site" />
              </SelectTrigger>
              <SelectContent>
                {jobSites.map(site => (
                  <SelectItem key={site.id} value={site.id}>
                    {site.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="assignedTo">Assign To *</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger>
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map(employee => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.first_name} {employee.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Photos</Label>
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('photo-input')?.click()}
                className="w-full"
              >
                <Camera className="h-4 w-4 mr-2" />
                Add Photos
              </Button>
              <input
                id="photo-input"
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoSelect}
                className="hidden"
              />
              
              {photos.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((photo, index) => (
                    <div key={index} className="relative">
                      <img
                        src={URL.createObjectURL(photo)}
                        alt={`Photo ${index + 1}`}
                        className="w-full h-20 object-cover rounded"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                        onClick={() => removePhoto(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Work Order"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};