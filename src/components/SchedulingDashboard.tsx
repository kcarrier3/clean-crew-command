import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Clock, Users, MapPin, Plus, List, Grid3X3, ArrowUpDown, CalendarDays } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import ScheduleListView from './ScheduleListView';
import WeeklyScheduleView from './WeeklyScheduleView';
import ManagerTimeOffReview from './ManagerTimeOffReview';

interface Employee {
  id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  job_title: string;
}

interface JobSite {
  id: string;
  name: string;
  address: string;
  client_name: string;
}

interface Schedule {
  id: string;
  employee_id: string;
  job_site_id: string;
  start_time: string;
  end_time: string;
  days_of_week: number[];
  start_date: string;
  end_date: string | null;
  notes: string | null;
  active: boolean;
  employees: Employee;
  job_sites: JobSite;
}

interface ScheduleFormData {
  employee_id: string;
  job_site_id: string;
  start_time: string;
  end_time: string;
  days_of_week: number[];
  start_date: string;
  end_date: string;
  notes: string;
}

const SchedulingDashboard = () => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [jobSites, setJobSites] = useState<JobSite[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'weekly'>('list');
  const [sortBy, setSortBy] = useState<'alphabetical' | 'job_title'>('alphabetical');
  const [formData, setFormData] = useState<ScheduleFormData>({
    employee_id: '',
    job_site_id: '',
    start_time: '',
    end_time: '',
    days_of_week: [],
    start_date: '',
    end_date: '',
    notes: ''
  });
  const { toast } = useToast();

  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch schedules with employee and account data
      const { data: schedulesData, error: schedulesError } = await supabase
        .from('employee_schedules')
        .select(`
          *,
          employees:employee_id(id, employee_id, first_name, last_name, job_title),
          job_sites:job_site_id(id, name, address, client_name)
        `)
        .eq('active', true)
        .order('start_date', { ascending: true });

      if (schedulesError) throw schedulesError;

      // Fetch employees
      const { data: employeesData, error: employeesError } = await supabase
        .from('employees')
        .select('*')
        .eq('active', true)
        .order('first_name');

      if (employeesError) throw employeesError;

      // Fetch accounts
      const { data: jobSitesData, error: jobSitesError } = await supabase
        .from('job_sites')
        .select('*')
        .eq('active', true)
        .order('name');

      if (jobSitesError) throw jobSitesError;

      setSchedules(schedulesData || []);
      setEmployees(employeesData || []);
      setJobSites(jobSitesData || []);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch scheduling data',
        variant: 'destructive'
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingSchedule) {
        // Update existing schedule
        const { error } = await supabase
          .from('employee_schedules')
          .update({
            employee_id: formData.employee_id,
            job_site_id: formData.job_site_id,
            start_time: formData.start_time,
            end_time: formData.end_time,
            days_of_week: formData.days_of_week,
            start_date: formData.start_date,
            end_date: formData.end_date || null,
            notes: formData.notes || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingSchedule.id);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Schedule updated successfully'
        });
      } else {
        // Create new schedule
        const { error } = await supabase
          .from('employee_schedules')
          .insert({
            employee_id: formData.employee_id,
            job_site_id: formData.job_site_id,
            start_time: formData.start_time,
            end_time: formData.end_time,
            days_of_week: formData.days_of_week,
            start_date: formData.start_date,
            end_date: formData.end_date || null,
            notes: formData.notes || null
          });

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Schedule created successfully'
        });
      }

      // Reset form and close dialog
      resetForm();
      setIsDialogOpen(false);
      setEditingSchedule(null);
      fetchData();

    } catch (error) {
      console.error('Error saving schedule:', error);
      toast({
        title: 'Error',
        description: 'Failed to save schedule',
        variant: 'destructive'
      });
    }
  };

  const handleEdit = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setFormData({
      employee_id: schedule.employee_id,
      job_site_id: schedule.job_site_id,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      days_of_week: schedule.days_of_week,
      start_date: schedule.start_date,
      end_date: schedule.end_date || '',
      notes: schedule.notes || ''
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (scheduleId: string) => {
    try {
      const { error } = await supabase
        .from('employee_schedules')
        .update({ active: false })
        .eq('id', scheduleId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Schedule deleted successfully'
      });
      
      fetchData();
    } catch (error) {
      console.error('Error deleting schedule:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete schedule',
        variant: 'destructive'
      });
    }
  };

  const resetForm = () => {
    setFormData({
      employee_id: '',
      job_site_id: '',
      start_time: '',
      end_time: '',
      days_of_week: [],
      start_date: '',
      end_date: '',
      notes: ''
    });
  };

  const handleDayToggle = (dayNumber: number) => {
    setFormData(prev => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(dayNumber)
        ? prev.days_of_week.filter(d => d !== dayNumber)
        : [...prev.days_of_week, dayNumber].sort()
    }));
  };

  const formatDaysOfWeek = (days: number[]) => {
    return days.map(day => dayNames[day - 1]).join(', ');
  };

  const formatTime = (time: string) => {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString([], { 
      hour: 'numeric', 
      minute: '2-digit' 
    });
  };

  return (
    <Tabs defaultValue="schedules" className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Employee Management</h2>
          <p className="text-muted-foreground">Manage employee schedules, assignments, and time off requests</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setEditingSchedule(null); }}>
              <Plus className="h-4 w-4 mr-2" />
              New Schedule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingSchedule ? 'Edit Schedule' : 'Create New Schedule'}
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="employee">Employee</Label>
                  <Select 
                    value={formData.employee_id} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, employee_id: value }))}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.first_name} {employee.last_name} ({employee.employee_id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="jobSite">Account</Label>
                  <Select 
                    value={formData.job_site_id} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, job_site_id: value }))}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {jobSites.map((site) => (
                        <SelectItem key={site.id} value={site.id}>
                          {site.name} - {site.client_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startTime">Start Time</Label>
                  <Input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="endTime">End Time</Label>
                  <Input
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div>
                <Label>Days of Week</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {dayNames.map((day, index) => (
                    <div key={day} className="flex items-center space-x-2">
                      <Checkbox
                        id={`day-${index + 1}`}
                        checked={formData.days_of_week.includes(index + 1)}
                        onCheckedChange={() => handleDayToggle(index + 1)}
                      />
                      <Label htmlFor={`day-${index + 1}`} className="text-sm">
                        {day}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="endDate">End Date (Optional)</Label>
                  <Input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Shift Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Enter any special instructions, address details, or important information for this shift..."
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className="mt-1"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Workers will see these notes when viewing their scheduled shifts
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    setEditingSchedule(null);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  {editingSchedule ? 'Update Schedule' : 'Create Schedule'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="schedules">Schedules</TabsTrigger>
        <TabsTrigger value="timeoff">Time Off Requests</TabsTrigger>
      </TabsList>

      <TabsContent value="schedules" className="space-y-6">
        {/* Schedule Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Calendar className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{schedules.length}</p>
                  <p className="text-sm text-muted-foreground">Active Schedules</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{new Set(schedules.map(s => s.employee_id)).size}</p>
                  <p className="text-sm text-muted-foreground">Scheduled Employees</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <MapPin className="h-8 w-8 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold">{new Set(schedules.map(s => s.job_site_id)).size}</p>
                  <p className="text-sm text-muted-foreground">Active Accounts</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* View Controls */}
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4 mr-2" />
              List View
            </Button>
            <Button
              variant={viewMode === 'weekly' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('weekly')}
            >
              <Grid3X3 className="h-4 w-4 mr-2" />
              Weekly View
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4" />
            <Select value={sortBy} onValueChange={(value: 'alphabetical' | 'job_title') => setSortBy(value)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alphabetical">Sort Alphabetically</SelectItem>
                <SelectItem value="job_title">Sort by Job Title</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Schedule Views */}
        {viewMode === 'list' ? (
          <ScheduleListView
            schedules={schedules}
            sortBy={sortBy}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        ) : (
          <WeeklyScheduleView
            schedules={schedules}
            sortBy={sortBy}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}
      </TabsContent>

      <TabsContent value="timeoff">
        <ManagerTimeOffReview />
      </TabsContent>
    </Tabs>
  );
};

export default SchedulingDashboard;