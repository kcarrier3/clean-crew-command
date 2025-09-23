import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Camera, Upload, X, Plus, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CreateWorkOrderDialog } from './CreateWorkOrderDialog';

interface JobSite {
  id: string;
  name: string;
  address?: string;
}

interface InspectionPhoto {
  id: string;
  file: File;
  preview: string;
  caption?: string;
}

interface StartInspectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const StartInspectionDialog = ({ open, onOpenChange, onSuccess }: StartInspectionDialogProps) => {
  const [jobSites, setJobSites] = useState<JobSite[]>([]);
  const [selectedJobSite, setSelectedJobSite] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<InspectionPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateWorkOrder, setShowCreateWorkOrder] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchJobSites();
    }
  }, [open]);

  const fetchJobSites = async () => {
    try {
      const { data, error } = await supabase
        .from('job_sites')
        .select('id, name, address')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      setJobSites(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch accounts",
        variant: "destructive",
      });
    }
  };

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      if (file.type.startsWith('image/')) {
        const id = Math.random().toString(36).substr(2, 9);
        const preview = URL.createObjectURL(file);
        
        setPhotos(prev => [...prev, {
          id,
          file,
          preview,
          caption: ''
        }]);
      }
    });
  };

  const removePhoto = (id: string) => {
    setPhotos(prev => {
      const photo = prev.find(p => p.id === id);
      if (photo) {
        URL.revokeObjectURL(photo.preview);
      }
      return prev.filter(p => p.id !== id);
    });
  };

  const updatePhotoCaption = (id: string, caption: string) => {
    setPhotos(prev => prev.map(photo => 
      photo.id === id ? { ...photo, caption } : photo
    ));
  };

  const uploadPhotosToStorage = async () => {
    const uploadPromises = photos.map(async (photo) => {
      const fileName = `inspections/${Date.now()}-${photo.file.name}`;
      
      const { data, error } = await supabase.storage
        .from('work-order-photos')
        .upload(fileName, photo.file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('work-order-photos')
        .getPublicUrl(fileName);

      return {
        url: publicUrl,
        caption: photo.caption
      };
    });

    return Promise.all(uploadPromises);
  };

  const handleSubmit = async () => {
    if (!selectedJobSite) {
      toast({
        title: "Error",
        description: "Please select an account",
        variant: "destructive",
      });
      return;
    }

    if (!notes.trim() && photos.length === 0) {
      toast({
        title: "Error",
        description: "Please add notes or photos for the inspection",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Upload photos if any
      let uploadedPhotos: { url: string; caption?: string }[] = [];
      if (photos.length > 0) {
        uploadedPhotos = await uploadPhotosToStorage();
      }

      // For now, we'll just show a success message
      // In a real implementation, you might want to create an inspections table
      toast({
        title: "Success",
        description: `Inspection completed for account. ${uploadedPhotos.length} photos uploaded.`,
      });

      // Reset form
      setSelectedJobSite('');
      setNotes('');
      setPhotos([]);
      
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save inspection",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedJobSite('');
    setNotes('');
    photos.forEach(photo => URL.revokeObjectURL(photo.preview));
    setPhotos([]);
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    onOpenChange(open);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Start an Inspection
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Account Selection */}
            <div className="space-y-2">
              <Label htmlFor="jobSite">Account *</Label>
              <Select value={selectedJobSite} onValueChange={setSelectedJobSite}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an account" />
                </SelectTrigger>
                <SelectContent>
                  {jobSites.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      <div>
                        <div className="font-medium">{site.name}</div>
                        {site.address && (
                          <div className="text-sm text-muted-foreground">{site.address}</div>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Notes Section */}
            <div className="space-y-2">
              <Label htmlFor="notes">Inspection Notes</Label>
              <Textarea
                id="notes"
                placeholder="Enter inspection notes, observations, and findings..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
            </div>

            {/* Photo Upload Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Photos</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('photo-upload')?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Photos
                  </Button>
                </div>
              </div>
              
              <input
                id="photo-upload"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handlePhotoUpload}
              />

              {photos.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {photos.map((photo) => (
                    <Card key={photo.id}>
                      <CardContent className="p-4">
                        <div className="relative mb-3">
                          <img
                            src={photo.preview}
                            alt="Inspection photo"
                            className="w-full h-48 object-cover rounded"
                          />
                          <Button
                            variant="destructive"
                            size="sm"
                            className="absolute top-2 right-2"
                            onClick={() => removePhoto(photo.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <Input
                          placeholder="Add a caption..."
                          value={photo.caption}
                          onChange={(e) => updatePhotoCaption(photo.id, e.target.value)}
                        />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Work Order Creation Option */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Found Issues?</h4>
                  <p className="text-sm text-muted-foreground">
                    Create a work order if repairs or maintenance are needed
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateWorkOrder(true)}
                  disabled={!selectedJobSite}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Work Order
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? "Saving..." : "Complete Inspection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Work Order Creation Dialog */}
      <CreateWorkOrderDialog
        open={showCreateWorkOrder}
        onOpenChange={setShowCreateWorkOrder}
        onSuccess={() => {
          setShowCreateWorkOrder(false);
          toast({
            title: "Success",
            description: "Work order created from inspection",
          });
        }}
        preSelectedJobSite={selectedJobSite}
      />
    </>
  );
};