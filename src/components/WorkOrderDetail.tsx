import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Camera, Upload, MessageCircle, Calendar, User, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface WorkOrder {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'completed' | 'reviewed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date: string;
  created_at: string;
  assigned_to: string;
  job_site_id: string;
  job_sites?: { name: string };
  employees?: { first_name: string; last_name: string };
}

interface WorkOrderDetailProps {
  workOrder: WorkOrder;
  onBack: () => void;
  onUpdate: () => void;
}

interface Photo {
  id: string;
  photo_url: string;
  photo_type: 'deficiency' | 'completion';
  caption: string;
  uploaded_by: string;
  created_at: string;
}

interface Note {
  id: string;
  note: string;
  created_by: string;
  created_at: string;
}

export const WorkOrderDetail: React.FC<WorkOrderDetailProps> = ({
  workOrder,
  onBack,
  onUpdate
}) => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState('');
  const [uploading, setUploading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();

  const statusColors = {
    open: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-green-100 text-green-800',
    reviewed: 'bg-gray-100 text-gray-800'
  };

  const priorityColors = {
    low: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-orange-100 text-orange-800',
    urgent: 'bg-red-100 text-red-800'
  };

  useEffect(() => {
    fetchPhotos();
    fetchNotes();
  }, [workOrder.id]);

  const fetchPhotos = async () => {
    const { data, error } = await supabase
      .from('work_order_photos')
      .select('*')
      .eq('work_order_id', workOrder.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setPhotos(data);
    }
  };

  const fetchNotes = async () => {
    const { data, error } = await supabase
      .from('work_order_notes')
      .select('*')
      .eq('work_order_id', workOrder.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setNotes(data);
    }
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>, photoType: 'deficiency' | 'completion') => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${workOrder.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('work-order-photos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('work-order-photos')
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase
        .from('work_order_photos')
        .insert({
          work_order_id: workOrder.id,
          photo_url: publicUrl,
          photo_type: photoType,
          uploaded_by: 'temp-user-id', // TODO: Replace with actual user ID
          caption: ''
        });

      if (dbError) throw dbError;

      toast({
        title: "Success",
        description: "Photo uploaded successfully",
      });

      fetchPhotos();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to upload photo",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    try {
      const { error } = await supabase
        .from('work_order_notes')
        .insert({
          work_order_id: workOrder.id,
          note: newNote,
          created_by: 'temp-user-id' // TODO: Replace with actual user ID
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Note added successfully",
      });

      setNewNote('');
      fetchNotes();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to add note",
        variant: "destructive",
      });
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    setUpdating(true);

    try {
      const updateData: any = { status: newStatus };
      
      if (newStatus === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('work_orders')
        .update(updateData)
        .eq('id', workOrder.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Work order status updated",
      });

      onUpdate();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold">{workOrder.title}</h1>
        <div className="flex gap-2 ml-auto">
          <Badge className={priorityColors[workOrder.priority]}>
            {workOrder.priority}
          </Badge>
          <Badge className={statusColors[workOrder.status]}>
            {workOrder.status.replace('_', ' ')}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>{workOrder.description}</p>
              
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {workOrder.job_sites?.name}
                </div>
                <div className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  {workOrder.employees?.first_name} {workOrder.employees?.last_name}
                </div>
                {workOrder.due_date && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Due: {format(new Date(workOrder.due_date), 'MMM d, yyyy')}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="photos">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="photos">Photos ({photos.length})</TabsTrigger>
              <TabsTrigger value="notes">Notes ({notes.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="photos" className="space-y-4">
              <div className="flex gap-2">
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handlePhotoUpload(e, 'deficiency')}
                    className="hidden"
                    id="deficiency-upload"
                  />
                  <Button asChild variant="outline" disabled={uploading}>
                    <label htmlFor="deficiency-upload" className="cursor-pointer">
                      <Camera className="h-4 w-4 mr-2" />
                      Add Deficiency Photo
                    </label>
                  </Button>
                </div>
                
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handlePhotoUpload(e, 'completion')}
                    className="hidden"
                    id="completion-upload"
                  />
                  <Button asChild variant="outline" disabled={uploading}>
                    <label htmlFor="completion-upload" className="cursor-pointer">
                      <Upload className="h-4 w-4 mr-2" />
                      Add Completion Photo
                    </label>
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {photos.map((photo) => (
                  <div key={photo.id} className="space-y-2">
                    <img
                      src={photo.photo_url}
                      alt="Work order photo"
                      className="w-full h-32 object-cover rounded-lg"
                    />
                    <Badge variant={photo.photo_type === 'deficiency' ? 'destructive' : 'default'}>
                      {photo.photo_type}
                    </Badge>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="notes" className="space-y-4">
              <div className="space-y-2">
                <Textarea
                  placeholder="Add a note..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                />
                <Button onClick={handleAddNote} disabled={!newNote.trim()}>
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Add Note
                </Button>
              </div>

              <div className="space-y-3">
                {notes.map((note) => (
                  <Card key={note.id}>
                    <CardContent className="pt-4">
                      <p className="mb-2">{note.note}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(note.created_at), 'MMM d, yyyy at h:mm a')}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={workOrder.status} onValueChange={handleStatusUpdate}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="reviewed">Reviewed</SelectItem>
                </SelectContent>
              </Select>
              
              {updating && (
                <p className="text-sm text-muted-foreground">Updating...</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};