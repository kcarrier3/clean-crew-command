import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Camera, Upload, X, Plus, FileText, CheckCircle,
  AlertTriangle, XCircle, Download, ChevronDown, ChevronUp
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { CreateWorkOrderDialog } from './CreateWorkOrderDialog';

type Rating = 'green' | 'yellow' | 'red' | null;

interface JobSite {
  id: string;
  name: string;
  address?: string;
}

interface EmployeeOption {
  id: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
}

interface TemplateItem {
  id: string;
  category: string;
  item_name: string;
  sort_order: number;
}

interface InspectionItemState {
  template_item_id: string;
  category: string;
  item_name: string;
  sort_order: number;
  rating: Rating;
  notes: string;
  photos: LocalPhoto[];
}

interface LocalPhoto {
  localId: string;
  file: File;
  preview: string;
  caption: string;
}

interface StartInspectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const RatingButton = ({
  value, current, onChange
}: { value: Rating; current: Rating; onChange: (v: Rating) => void }) => {
  const config = {
    green: { label: 'Green', icon: CheckCircle, bg: 'bg-green-500 text-white', outline: 'border-green-500 text-green-700 hover:bg-green-50' },
    yellow: { label: 'Yellow', icon: AlertTriangle, bg: 'bg-yellow-400 text-white', outline: 'border-yellow-400 text-yellow-700 hover:bg-yellow-50' },
    red: { label: 'Red', icon: XCircle, bg: 'bg-red-500 text-white', outline: 'border-red-500 text-red-700 hover:bg-red-50' },
  };
  const c = config[value!];
  const Icon = c.icon;
  const isSelected = current === value;
  return (
    <button
      type="button"
      onClick={() => onChange(isSelected ? null : value)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium transition-colors ${
        isSelected ? c.bg : `bg-background ${c.outline}`
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {c.label}
    </button>
  );
};

export const StartInspectionDialog = ({ open, onOpenChange, onSuccess }: StartInspectionDialogProps) => {
  const [jobSites, setJobSites] = useState<JobSite[]>([]);
  const [selectedJobSite, setSelectedJobSite] = useState('');
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('none');
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [items, setItems] = useState<InspectionItemState[]>([]);
  const [overallNotes, setOverallNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [showCreateWorkOrder, setShowCreateWorkOrder] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { profile, canCreateWorkOrders } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeItemForPhoto, setActiveItemForPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchJobSites();
      fetchDefaultTemplate();
      fetchEmployees();
    }
  }, [open]);

  const fetchJobSites = async () => {
    const { data } = await supabase
      .from('job_sites')
      .select('id, name, address')
      .eq('active', true)
      .order('name');
    setJobSites(data || []);
  };

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from('profiles_directory' as any)
      .select('id, first_name, last_name, job_title')
      .order('last_name');
    setEmployees((data as any) || []);
  };

  const fetchDefaultTemplate = async () => {
    setLoadingTemplate(true);
    const { data: templates } = await supabase
      .from('inspection_templates')
      .select('id')
      .eq('is_default', true)
      .limit(1);

    if (templates && templates.length > 0) {
      const tid = templates[0].id;
      setTemplateId(tid);
      const { data: templateItems } = await supabase
        .from('inspection_template_items')
        .select('id, category, item_name, sort_order')
        .eq('template_id', tid)
        .order('sort_order');

      if (templateItems) {
        setItems(templateItems.map((ti: TemplateItem) => ({
          template_item_id: ti.id,
          category: ti.category,
          item_name: ti.item_name,
          sort_order: ti.sort_order,
          rating: null,
          notes: '',
          photos: [],
        })));
      }
    }
    setLoadingTemplate(false);
  };

  const updateItemRating = (templateItemId: string, rating: Rating) => {
    setItems(prev => prev.map(item =>
      item.template_item_id === templateItemId ? { ...item, rating } : item
    ));
  };

  const updateItemNotes = (templateItemId: string, notes: string) => {
    setItems(prev => prev.map(item =>
      item.template_item_id === templateItemId ? { ...item, notes } : item
    ));
  };

  const handlePhotoSelect = (templateItemId: string) => {
    setActiveItemForPhoto(templateItemId);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeItemForPhoto || !e.target.files) return;
    const files = Array.from(e.target.files);
    const newPhotos: LocalPhoto[] = files
      .filter(f => f.type.startsWith('image/'))
      .map(f => ({
        localId: Math.random().toString(36).slice(2),
        file: f,
        preview: URL.createObjectURL(f),
        caption: '',
      }));

    setItems(prev => prev.map(item =>
      item.template_item_id === activeItemForPhoto
        ? { ...item, photos: [...item.photos, ...newPhotos] }
        : item
    ));
    e.target.value = '';
  };

  const removePhoto = (templateItemId: string, localId: string) => {
    setItems(prev => prev.map(item => {
      if (item.template_item_id !== templateItemId) return item;
      const photo = item.photos.find(p => p.localId === localId);
      if (photo) URL.revokeObjectURL(photo.preview);
      return { ...item, photos: item.photos.filter(p => p.localId !== localId) };
    }));
  };

  const updatePhotoCaption = (templateItemId: string, localId: string, caption: string) => {
    setItems(prev => prev.map(item =>
      item.template_item_id === templateItemId
        ? { ...item, photos: item.photos.map(p => p.localId === localId ? { ...p, caption } : p) }
        : item
    ));
  };

  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  // Compute score
  const ratedItems = items.filter(i => i.rating !== null);
  const greenCount = items.filter(i => i.rating === 'green').length;
  const yellowCount = items.filter(i => i.rating === 'yellow').length;
  const redCount = items.filter(i => i.rating === 'red').length;
  const score = ratedItems.length > 0
    ? Math.round(((greenCount * 100) + (yellowCount * 50)) / ratedItems.length)
    : null;
  const overallRating: Rating = score === null ? null : score >= 80 ? 'green' : score >= 50 ? 'yellow' : 'red';

  const categories = [...new Set(items.map(i => i.category))];

  const uploadPhoto = async (inspectionId: string, itemDbId: string | null, photo: LocalPhoto) => {
    const ext = photo.file.name.split('.').pop() || 'jpg';
    const path = `${inspectionId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('inspection-photos')
      .upload(path, photo.file);
    if (uploadError) throw uploadError;

    const { data: signedData } = await supabase.storage
      .from('inspection-photos')
      .createSignedUrl(path, 60 * 60 * 24 * 365); // 1 year

    await supabase.from('inspection_photos').insert({
      inspection_id: inspectionId,
      inspection_item_id: itemDbId,
      storage_path: path,
      public_url: signedData?.signedUrl || null,
      caption: photo.caption || null,
      uploaded_by: profile?.id,
    });
  };

  const handleSubmit = async () => {
    if (!selectedJobSite) {
      toast({ title: 'Error', description: 'Please select an account', variant: 'destructive' });
      return;
    }
    if (ratedItems.length === 0) {
      toast({ title: 'Error', description: 'Please rate at least one checklist item', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      // 1. Create inspection record
      const { data: inspection, error: inspError } = await supabase
        .from('inspections')
        .insert({
          job_site_id: selectedJobSite,
          template_id: templateId,
          inspector_id: profile!.id,
          employee_id: selectedEmployee && selectedEmployee !== 'none' ? selectedEmployee : null,
          status: 'completed',
          overall_score: score,
          overall_rating: overallRating,
          notes: overallNotes || null,
          completed_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (inspError) throw inspError;
      const inspectionId = inspection.id;

      // 2. Insert inspection items
      const itemInserts = items
        .filter(i => i.rating !== null || i.notes)
        .map(i => ({
          inspection_id: inspectionId,
          template_item_id: i.template_item_id,
          category: i.category,
          item_name: i.item_name,
          rating: i.rating,
          notes: i.notes || null,
          sort_order: i.sort_order,
        }));

      const { data: insertedItems, error: itemsError } = await supabase
        .from('inspection_items')
        .insert(itemInserts)
        .select('id, template_item_id');

      if (itemsError) throw itemsError;

      // 3. Upload photos for each item
      const itemIdMap: Record<string, string> = {};
      (insertedItems || []).forEach((ii: { id: string; template_item_id: string }) => {
        itemIdMap[ii.template_item_id] = ii.id;
      });

      for (const item of items) {
        if (item.photos.length > 0) {
          const dbItemId = itemIdMap[item.template_item_id] || null;
          for (const photo of item.photos) {
            await uploadPhoto(inspectionId, dbItemId, photo);
          }
        }
      }

      toast({
        title: 'Inspection Completed!',
        description: `Score: ${score}% — Overall rating: ${overallRating?.toUpperCase()}`,
      });

      resetForm();
      onSuccess?.();
      onOpenChange(false);
    } catch (error: unknown) {
      console.error('Inspection save error:', error);
      toast({ title: 'Error', description: 'Failed to save inspection. Please try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedJobSite('');
    setSelectedEmployee('none');
    setOverallNotes('');
    items.forEach(item => item.photos.forEach(p => URL.revokeObjectURL(p.preview)));
    setItems([]);
    setCollapsedCategories(new Set());
    fetchDefaultTemplate();
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) resetForm();
    onOpenChange(isOpen);
  };

  const scoreColor = overallRating === 'green'
    ? 'text-green-600'
    : overallRating === 'yellow'
    ? 'text-yellow-600'
    : overallRating === 'red'
    ? 'text-red-600'
    : 'text-muted-foreground';

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Quality Inspection
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Account Selection */}
            <div className="space-y-2">
              <Label>Account *</Label>
              <Select value={selectedJobSite} onValueChange={setSelectedJobSite}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an account to inspect" />
                </SelectTrigger>
                <SelectContent>
                  {jobSites.map(site => (
                    <SelectItem key={site.id} value={site.id}>
                      <div>
                        <div className="font-medium">{site.name}</div>
                        {site.address && <div className="text-xs text-muted-foreground">{site.address}</div>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Worker being inspected */}
            <div className="space-y-2">
              <Label>Worker being inspected</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="Select the worker this inspection is for" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-muted-foreground">— Not tied to a specific worker —</span>
                  </SelectItem>
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>
                      <div>
                        <div className="font-medium">{emp.first_name} {emp.last_name}</div>
                        {emp.job_title && (
                          <div className="text-xs text-muted-foreground">{emp.job_title}</div>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Selected worker will be able to view this inspection report on their dashboard.
              </p>
            </div>

            {/* Score Summary */}
            {ratedItems.length > 0 && (
              <Card className={`border-2 ${
                overallRating === 'green' ? 'border-green-400' :
                overallRating === 'yellow' ? 'border-yellow-400' :
                'border-red-400'
              }`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold">Current Score</span>
                    <span className={`text-2xl font-bold ${scoreColor}`}>{score}%</span>
                  </div>
                  <Progress value={score ?? 0} className="h-2 mb-3" />
                  <div className="flex gap-4 text-sm">
                    <span className="flex items-center gap-1 text-green-700">
                      <CheckCircle className="h-3.5 w-3.5" /> {greenCount} Green
                    </span>
                    <span className="flex items-center gap-1 text-yellow-700">
                      <AlertTriangle className="h-3.5 w-3.5" /> {yellowCount} Yellow
                    </span>
                    <span className="flex items-center gap-1 text-red-700">
                      <XCircle className="h-3.5 w-3.5" /> {redCount} Red
                    </span>
                    <span className="text-muted-foreground ml-auto">
                      {ratedItems.length}/{items.length} rated
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Checklist */}
            {loadingTemplate ? (
              <p className="text-center text-muted-foreground py-4">Loading checklist...</p>
            ) : (
              categories.map(category => {
                const categoryItems = items.filter(i => i.category === category);
                const isCollapsed = collapsedCategories.has(category);
                const catGreen = categoryItems.filter(i => i.rating === 'green').length;
                const catRed = categoryItems.filter(i => i.rating === 'red').length;
                const catRated = categoryItems.filter(i => i.rating !== null).length;

                return (
                  <Card key={category}>
                    <CardHeader
                      className="pb-2 cursor-pointer select-none"
                      onClick={() => toggleCategory(category)}
                    >
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{category}</CardTitle>
                        <div className="flex items-center gap-2">
                          {catRated > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {catRated}/{categoryItems.length} rated
                            </span>
                          )}
                          {catRed > 0 && (
                            <Badge className="bg-red-100 text-red-800 text-xs">{catRed} Red</Badge>
                          )}
                          {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                        </div>
                      </div>
                    </CardHeader>

                    {!isCollapsed && (
                      <CardContent className="space-y-4 pt-0">
                        {categoryItems.map(item => (
                          <div key={item.template_item_id} className="space-y-2">
                            <div className="flex items-start justify-between gap-3">
                              <span className="text-sm font-medium flex-1 pt-1">{item.item_name}</span>
                              <div className="flex gap-1.5 flex-shrink-0">
                                <RatingButton value="green" current={item.rating} onChange={r => updateItemRating(item.template_item_id, r)} />
                                <RatingButton value="yellow" current={item.rating} onChange={r => updateItemRating(item.template_item_id, r)} />
                                <RatingButton value="red" current={item.rating} onChange={r => updateItemRating(item.template_item_id, r)} />
                              </div>
                            </div>

                            {/* Notes and photos for this item */}
                            {(item.rating === 'yellow' || item.rating === 'red' || item.notes || item.photos.length > 0) && (
                              <div className="ml-2 pl-3 border-l-2 border-muted space-y-2">
                                <Input
                                  placeholder={item.rating === 'red' ? 'Describe the issue...' : 'Add notes (optional)...'}
                                  value={item.notes}
                                  onChange={e => updateItemNotes(item.template_item_id, e.target.value)}
                                  className="text-sm"
                                />
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handlePhotoSelect(item.template_item_id)}
                                  >
                                    <Camera className="h-3.5 w-3.5 mr-1.5" />
                                    Add Photo
                                  </Button>
                                  {item.photos.map(photo => (
                                    <div key={photo.localId} className="relative group">
                                      <img
                                        src={photo.preview}
                                        alt="inspection"
                                        className="h-16 w-16 object-cover rounded border"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => removePhoto(item.template_item_id, photo.localId)}
                                        className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full h-4 w-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                      >
                                        <X className="h-2.5 w-2.5" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            <Separator className="mt-2" />
                          </div>
                        ))}
                      </CardContent>
                    )}
                  </Card>
                );
              })
            )}

            {/* Overall Notes */}
            <div className="space-y-2">
              <Label>Overall Inspection Notes</Label>
              <Textarea
                placeholder="General observations, commendations, or concerns for this inspection..."
                value={overallNotes}
                onChange={e => setOverallNotes(e.target.value)}
                rows={3}
              />
            </div>

            {/* Work Order Option */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Found Issues?</h4>
                  <p className="text-sm text-muted-foreground">
                    Create a work order if repairs or maintenance are needed
                  </p>
                </div>
                {canCreateWorkOrders() && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreateWorkOrder(true)}
                    disabled={!selectedJobSite}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Work Order
                  </Button>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={loading || ratedItems.length === 0}>
              {loading ? 'Saving...' : `Complete Inspection${score !== null ? ` (${score}%)` : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateWorkOrderDialog
        open={showCreateWorkOrder}
        onOpenChange={setShowCreateWorkOrder}
        onSuccess={() => {
          setShowCreateWorkOrder(false);
          toast({ title: 'Success', description: 'Work order created from inspection' });
        }}
        preSelectedJobSite={selectedJobSite}
      />
    </>
  );
};
