import { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Plus, Camera, FileText, Calendar as CalendarIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ManagerReport {
  id: string;
  manager_id: string;
  report_date: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  photos: ManagerReportPhoto[];
}

interface ManagerReportPhoto {
  id: string;
  report_id: string;
  photo_url: string;
  caption: string | null;
  uploaded_by: string;
  created_at: string;
}

export default function ManagerLog() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [reports, setReports] = useState<ManagerReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<ManagerReport | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);

  useEffect(() => {
    fetchReportsForMonth();
  }, [currentMonth]);

  const fetchReportsForMonth = async () => {
    setLoading(true);
    try {
      const startDate = startOfMonth(currentMonth);
      const endDate = endOfMonth(currentMonth);
      
      const { data: reportsData, error: reportsError } = await supabase
        .from('manager_reports')
        .select(`
          *,
          manager_report_photos (*)
        `)
        .gte('report_date', format(startDate, 'yyyy-MM-dd'))
        .lte('report_date', format(endDate, 'yyyy-MM-dd'))
        .order('report_date', { ascending: false });

      if (reportsError) throw reportsError;
      
      // Map the data to match our interface
      const mappedReports = reportsData?.map(report => ({
        ...report,
        photos: report.manager_report_photos || []
      })) || [];
      
      setReports(mappedReports);
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast({
        title: "Error",
        description: "Failed to fetch reports",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateReport = async () => {
    if (!user || !title.trim() || !content.trim()) return;
    
    setLoading(true);
    try {
      // Create the report
      const { data: reportData, error: reportError } = await supabase
        .from('manager_reports')
        .insert({
          manager_id: user.id,
          report_date: format(selectedDate, 'yyyy-MM-dd'),
          title: title.trim(),
          content: content.trim()
        })
        .select()
        .single();

      if (reportError) throw reportError;

      // Upload photos if any
      const photoUrls: string[] = [];
      for (const photo of photos) {
        const fileName = `${reportData.id}/${crypto.randomUUID()}-${photo.name}`;
        const { error: uploadError } = await supabase.storage
          .from('manager-report-photos')
          .upload(fileName, photo);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('manager-report-photos')
          .getPublicUrl(fileName);

        // Save photo record
        const { error: photoError } = await supabase
          .from('manager_report_photos')
          .insert({
            report_id: reportData.id,
            photo_url: publicUrl,
            uploaded_by: user.id
          });

        if (photoError) throw photoError;
        photoUrls.push(publicUrl);
      }

      toast({
        title: "Success",
        description: "Report created successfully"
      });

      // Reset form
      setTitle('');
      setContent('');
      setPhotos([]);
      setIsCreateDialogOpen(false);
      
      // Refresh reports
      fetchReportsForMonth();
    } catch (error) {
      console.error('Error creating report:', error);
      toast({
        title: "Error",
        description: "Failed to create report",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setPhotos(prev => [...prev, ...files]);
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const getReportsForDate = (date: Date) => {
    return reports.filter(report => 
      isSameDay(new Date(report.report_date), date)
    );
  };

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  });

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Manager Log</h2>
          <p className="text-muted-foreground">End of day reports and documentation</p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Report
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create End of Day Report</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="date">Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !selectedDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => date && setSelectedDate(date)}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div>
                <Label htmlFor="title">Report Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter report title..."
                />
              </div>
              
              <div>
                <Label htmlFor="content">Report Content</Label>
                <Textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Describe the day's activities, issues, achievements..."
                  className="min-h-[120px]"
                />
              </div>
              
              <div>
                <Label htmlFor="photos">Photos</Label>
                <div className="space-y-2">
                  <Input
                    id="photos"
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="cursor-pointer"
                  />
                  {photos.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {photos.map((photo, index) => (
                        <div key={index} className="relative">
                          <Badge variant="secondary" className="pr-8">
                            {photo.name}
                            <button
                              onClick={() => removePhoto(index)}
                              className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-destructive"
                            >
                              ×
                            </button>
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button 
                  onClick={handleCreateReport} 
                  disabled={loading || !title.trim() || !content.trim()}
                  className="flex-1"
                >
                  {loading ? "Creating..." : "Create Report"}
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

      {/* Month Navigation */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigateMonth('prev')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <CardTitle className="text-lg">
              {format(currentMonth, 'MMMM yyyy')}
            </CardTitle>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigateMonth('next')}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-sm font-medium text-muted-foreground p-2">
                {day}
              </div>
            ))}
            
            {daysInMonth.map(day => {
              const dayReports = getReportsForDate(day);
              const hasReports = dayReports.length > 0;
              
              return (
                <button
                  key={day.toString()}
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    "p-2 text-sm rounded-md border transition-colors relative",
                    isSameDay(day, selectedDate) 
                      ? "bg-primary text-primary-foreground" 
                      : "hover:bg-muted",
                    isToday(day) && "ring-2 ring-primary ring-offset-2",
                    hasReports && "bg-blue-50 border-blue-200"
                  )}
                >
                  <div>{format(day, 'd')}</div>
                  {hasReports && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2">
                      <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Reports for Selected Date */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">
          Reports for {format(selectedDate, 'MMMM d, yyyy')}
        </h3>
        
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground mt-2">Loading reports...</p>
          </div>
        ) : (
          <>
            {getReportsForDate(selectedDate).length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No reports for this date</p>
                </CardContent>
              </Card>
            ) : (
              getReportsForDate(selectedDate).map(report => (
                <Card key={report.id} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold mb-1">{report.title}</h4>
                        <p className="text-muted-foreground text-sm line-clamp-3 mb-2">
                          {report.content}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Created: {format(new Date(report.created_at), 'h:mm a')}</span>
                          {report.photos && report.photos.length > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              <Camera className="h-3 w-3 mr-1" />
                              {report.photos.length} photo{report.photos.length !== 1 ? 's' : ''}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedReport(report);
                          setIsViewDialogOpen(true);
                        }}
                      >
                        View
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </>
        )}
      </div>

      {/* View Report Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedReport?.title}</DialogTitle>
            <p className="text-muted-foreground">
              {selectedReport && format(new Date(selectedReport.report_date), 'MMMM d, yyyy')}
            </p>
          </DialogHeader>
          {selectedReport && (
            <div className="space-y-4">
              <div>
                <Label>Report Content</Label>
                <div className="mt-1 p-3 bg-muted rounded-md text-sm whitespace-pre-wrap">
                  {selectedReport.content}
                </div>
              </div>
              
              {selectedReport.photos && selectedReport.photos.length > 0 && (
                <div>
                  <Label>Photos ({selectedReport.photos.length})</Label>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedReport.photos.map(photo => (
                      <div key={photo.id} className="space-y-2">
                        <img
                          src={photo.photo_url}
                          alt={photo.caption || 'Report photo'}
                          className="w-full h-48 object-cover rounded-md border"
                        />
                        {photo.caption && (
                          <p className="text-sm text-muted-foreground">{photo.caption}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="text-xs text-muted-foreground">
                Created: {format(new Date(selectedReport.created_at), 'PPP p')}
                {selectedReport.updated_at !== selectedReport.created_at && (
                  <span className="ml-2">
                    • Updated: {format(new Date(selectedReport.updated_at), 'PPP p')}
                  </span>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}