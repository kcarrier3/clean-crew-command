import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Camera, MessageSquare, Calendar, User, MapPin, X, Eye } from 'lucide-react';

interface WorkOrder {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'completed' | 'reviewed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  job_site_id: string;
  assigned_to: string;
  created_by: string;
  created_at: string;
  due_date: string;
  job_sites?: { name: string };
  employees?: { first_name: string; last_name: string };
  created_by_employee?: { first_name: string; last_name: string };
}

interface WorkOrderPhoto {
  id: string;
  photo_url: string;
  photo_type: 'deficiency' | 'completion';
  uploaded_by: string;
  created_at: string;
  signed_url?: string;
}

interface WorkOrderNote {
  id: string;
  note: string;
  created_by: string;
  created_at: string;
}

interface WorkOrderDetailsDialogProps {
  workOrder: WorkOrder;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export const WorkOrderDetailsDialog = ({ workOrder, open, onOpenChange, onUpdate }: WorkOrderDetailsDialogProps) => {
  const [photos, setPhotos] = useState<WorkOrderPhoto[]>([]);
  const [notes, setNotes] = useState<WorkOrderNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [status, setStatus] = useState(workOrder.status);
  const [loading, setLoading] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchPhotos();
      fetchNotes();
      setStatus(workOrder.status);
    }
  }, [open, workOrder.id]);

  const fetchPhotos = async () => {
    const { data, error } = await supabase
      .from('work_order_photos')
      .select('*')
      .eq('work_order_id', workOrder.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch photos",
        variant: "destructive",
      });
    } else {
      // Generate signed URLs for each photo
      const photosWithSignedUrls = await Promise.all(
        (data || []).map(async (photo) => {
          const { data: signedUrlData } = await supabase.storage
            .from('work-order-photos')
            .createSignedUrl(photo.photo_url, 3600);
          return {
            ...photo,
            signed_url: signedUrlData?.signedUrl
          };
        })
      );
      setPhotos(photosWithSignedUrls);
    }
  };

  const fetchNotes = async () => {
    const { data, error } = await supabase
      .from('work_order_notes')
      .select('*')
      .eq('work_order_id', workOrder.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch notes",
        variant: "destructive",
      });
    } else {
      setNotes(data || []);
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setNewPhotos(prev => [...prev, ...files]);
  };

  const removeNewPhoto = (index: number) => {
    setNewPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const uploadPhoto = async (file: File, photoType: 'deficiency' | 'completion') => {
    const fileName = `${workOrder.id}/${Date.now()}-${file.name}`;
    
    const { error: uploadError } = await supabase.storage
      .from('work-order-photos')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data: userData } = await supabase.auth.getUser();

    const { error: dbError } = await supabase
      .from('work_order_photos')
      .insert({
        work_order_id: workOrder.id,
        photo_url: fileName, // Store file path for signed URL generation
        photo_type: photoType,
        uploaded_by: userData.user?.id || 'current-user'
      });

    if (dbError) throw dbError;
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    try {
      const { error } = await supabase
        .from('work_order_notes')
        .insert({
          work_order_id: workOrder.id,
          note: newNote.trim(),
          created_by: 'current-user' // TODO: Replace with actual user ID when auth is implemented
        });

      if (error) throw error;

      setNewNote('');
      fetchNotes();
      toast({
        title: "Success",
        description: "Note added successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add note",
        variant: "destructive",
      });
    }
  };

  const handleUploadPhotos = async () => {
    if (newPhotos.length === 0) return;

    setLoading(true);
    try {
      const photoType = status === 'completed' ? 'completion' : 'deficiency';
      
      for (const photo of newPhotos) {
        await uploadPhoto(photo, photoType);
      }

      setNewPhotos([]);
      fetchPhotos();
      toast({
        title: "Success",
        description: "Photos uploaded successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to upload photos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async () => {
    try {
      const { error } = await supabase
        .from('work_orders')
        .update({ status })
        .eq('id', workOrder.id);

      if (error) throw error;

      onUpdate();
      toast({
        title: "Success",
        description: "Work order status updated",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      });
    }
  };

  const getPhotoUrl = (photo: WorkOrderPhoto) => {
    // Use pre-fetched signed URL if available
    return photo.signed_url || photo.photo_url;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'low':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>{workOrder.title}</DialogTitle>
              <Badge className={`${getPriorityColor(workOrder.priority)} text-white`}>
                {workOrder.priority}
              </Badge>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Work Order Details */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4" />
                    <span>{workOrder.job_sites?.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4" />
                    <span>Assigned to: {workOrder.employees?.first_name} {workOrder.employees?.last_name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4" />
                    <span>Due: {new Date(workOrder.due_date).toLocaleDateString()}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Created by: {workOrder.created_by_employee?.first_name} {workOrder.created_by_employee?.last_name}
                  </div>
                  <div className="text-sm">
                    {workOrder.description}
                  </div>
                  
                  <div className="pt-2">
                    <label className="text-sm font-medium">Status</label>
                    <div className="flex gap-2 mt-1">
                      <Select value={status} onValueChange={(value: any) => setStatus(value)}>
                        <SelectTrigger className="flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="reviewed">Reviewed</SelectItem>
                        </SelectContent>
                      </Select>
                      {status !== workOrder.status && (
                        <Button onClick={handleStatusUpdate}>Update</Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Photos Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Photos</CardTitle>
                </CardHeader>
                <CardContent>
                  {photos.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      {photos.map((photo) => (
                        <div key={photo.id} className="relative group">
                          <img
                            src={getPhotoUrl(photo)}
                            alt="Work order photo"
                            className="w-full h-24 object-cover rounded cursor-pointer"
                            onClick={() => setViewingPhoto(getPhotoUrl(photo))}
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all rounded flex items-center justify-center">
                            <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <Badge 
                            className="absolute top-1 right-1 text-xs"
                            variant={photo.photo_type === 'deficiency' ? 'destructive' : 'default'}
                          >
                            {photo.photo_type}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('new-photo-input')?.click()}
                      className="w-full"
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      Add Photos
                    </Button>
                    <input
                      id="new-photo-input"
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handlePhotoSelect}
                      className="hidden"
                    />
                    
                    {newPhotos.length > 0 && (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          {newPhotos.map((photo, index) => (
                            <div key={index} className="relative">
                              <img
                                src={URL.createObjectURL(photo)}
                                alt={`New photo ${index + 1}`}
                                className="w-full h-20 object-cover rounded"
                              />
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                                onClick={() => removeNewPhoto(index)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                        <Button 
                          onClick={handleUploadPhotos} 
                          disabled={loading}
                          className="w-full"
                        >
                          {loading ? "Uploading..." : "Upload Photos"}
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Notes Section */}
            <div>
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Notes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Textarea
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Add a note..."
                      rows={3}
                    />
                    <Button onClick={handleAddNote} disabled={!newNote.trim()}>
                      Add Note
                    </Button>
                  </div>

                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {notes.map((note) => (
                      <div key={note.id} className="p-3 bg-muted rounded-lg">
                        <p className="text-sm">{note.note}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(note.created_at).toLocaleString()}
                        </p>
                      </div>
                    ))}
                    {notes.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No notes yet
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Photo Viewer Dialog */}
      {viewingPhoto && (
        <Dialog open={!!viewingPhoto} onOpenChange={() => setViewingPhoto(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Photo View</DialogTitle>
            </DialogHeader>
            <div className="flex justify-center">
              <img
                src={viewingPhoto}
                alt="Work order photo"
                className="max-w-full max-h-[70vh] object-contain"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};