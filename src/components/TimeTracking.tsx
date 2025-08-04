import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Clock, PlayCircle, StopCircle, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Employee {
  id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
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
  job_sites: JobSite;
}

interface TimeEntry {
  id: string;
  employee_id: string;
  job_site_id: string;
  clock_in: string;
  clock_out: string | null;
  employees: Employee;
  job_sites: JobSite;
}

const TimeTracking = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [jobSites, setJobSites] = useState<JobSite[]>([]);
  const [activeEntries, setActiveEntries] = useState<TimeEntry[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [selectedJobSite, setSelectedJobSite] = useState<string>('');
  const [scheduledJobSite, setScheduledJobSite] = useState<Schedule | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const { toast } = useToast();

  useEffect(() => {
    fetchEmployees();
    fetchJobSites();
    fetchActiveEntries();
    
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Auto-select job site when employee is selected
  useEffect(() => {
    if (selectedEmployee) {
      fetchEmployeeSchedule(selectedEmployee);
    } else {
      setScheduledJobSite(null);
      setSelectedJobSite('');
    }
  }, [selectedEmployee]);

  const fetchEmployees = async () => {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('active', true)
      .order('first_name');
    
    if (error) {
      toast({ title: 'Error', description: 'Failed to fetch employees', variant: 'destructive' });
    } else {
      setEmployees(data || []);
    }
  };

  const fetchJobSites = async () => {
    const { data, error } = await supabase
      .from('job_sites')
      .select('*')
      .eq('active', true)
      .order('name');
    
    if (error) {
      toast({ title: 'Error', description: 'Failed to fetch job sites', variant: 'destructive' });
    } else {
      setJobSites(data || []);
    }
  };

  const fetchActiveEntries = async () => {
    const { data, error } = await supabase
      .from('time_entries')
      .select(`
        *,
        employees:employee_id(id, employee_id, first_name, last_name),
        job_sites:job_site_id(id, name, address, client_name)
      `)
      .is('clock_out', null)
      .order('clock_in', { ascending: false });
    
    if (error) {
      toast({ title: 'Error', description: 'Failed to fetch active entries', variant: 'destructive' });
    } else {
      setActiveEntries(data || []);
    }
  };

  const fetchEmployeeSchedule = async (employeeId: string) => {
    const currentDay = new Date().getDay(); // 0=Sunday, 1=Monday, etc.
    const adjustedDay = currentDay === 0 ? 7 : currentDay; // Convert to 1=Monday, 7=Sunday
    
    const { data, error } = await supabase
      .from('employee_schedules')
      .select(`
        *,
        job_sites:job_site_id(id, name, address, client_name)
      `)
      .eq('employee_id', employeeId)
      .eq('active', true)
      .contains('days_of_week', [adjustedDay])
      .lte('start_date', new Date().toISOString().split('T')[0])
      .or(`end_date.is.null,end_date.gte.${new Date().toISOString().split('T')[0]}`)
      .single();

    if (error) {
      console.log('No schedule found for employee');
      setScheduledJobSite(null);
      setSelectedJobSite('');
    } else if (data) {
      setScheduledJobSite(data);
      setSelectedJobSite(data.job_site_id);
    }
  };

  const clockIn = async () => {
    if (!selectedEmployee || !selectedJobSite) {
      toast({ title: 'Error', description: 'Please select an employee and job site', variant: 'destructive' });
      return;
    }

    // Check if employee is already clocked in
    const existingEntry = activeEntries.find(entry => entry.employee_id === selectedEmployee);
    if (existingEntry) {
      toast({ title: 'Error', description: 'Employee is already clocked in', variant: 'destructive' });
      return;
    }

    const { error } = await supabase
      .from('time_entries')
      .insert({
        employee_id: selectedEmployee,
        job_site_id: selectedJobSite,
        clock_in: new Date().toISOString()
      });

    if (error) {
      toast({ title: 'Error', description: 'Failed to clock in', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Clocked in successfully!' });
      setSelectedEmployee('');
      setSelectedJobSite('');
      fetchActiveEntries();
    }
  };

  const clockOut = async (entryId: string) => {
    const { error } = await supabase
      .from('time_entries')
      .update({ clock_out: new Date().toISOString() })
      .eq('id', entryId);

    if (error) {
      toast({ title: 'Error', description: 'Failed to clock out', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Clocked out successfully!' });
      fetchActiveEntries();
    }
  };

  const formatDuration = (clockIn: string) => {
    const start = new Date(clockIn);
    const now = currentTime;
    const diff = now.getTime() - start.getTime();
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Clock In/Out Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Time Clock
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger>
                <SelectValue placeholder="Select Employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.first_name} {employee.last_name} ({employee.employee_id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="space-y-2">
              <Select value={selectedJobSite} onValueChange={setSelectedJobSite}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Job Site" />
                </SelectTrigger>
                <SelectContent>
                  {jobSites.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.name} - {site.client_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {scheduledJobSite && (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Badge variant="outline" className="text-xs">
                    Scheduled: {scheduledJobSite.job_sites.name}
                  </Badge>
                  <span className="text-xs">
                    {scheduledJobSite.start_time} - {scheduledJobSite.end_time}
                  </span>
                </div>
              )}
            </div>

            <Button 
              onClick={clockIn} 
              className="w-full"
              disabled={!selectedEmployee || !selectedJobSite}
            >
              <PlayCircle className="h-4 w-4 mr-2" />
              Clock In
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Active Time Entries */}
      <Card>
        <CardHeader>
          <CardTitle>Currently Clocked In</CardTitle>
        </CardHeader>
        <CardContent>
          {activeEntries.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No one is currently clocked in</p>
          ) : (
            <div className="space-y-4">
              {activeEntries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">
                        {entry.employees.first_name} {entry.employees.last_name}
                      </h3>
                      <Badge variant="secondary">{entry.employees.employee_id}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {entry.job_sites.name}
                      </div>
                      <div>
                        Started: {new Date(entry.clock_in).toLocaleTimeString()}
                      </div>
                      <div className="font-mono text-lg text-foreground">
                        {formatDuration(entry.clock_in)}
                      </div>
                    </div>
                  </div>
                  <Button 
                    onClick={() => clockOut(entry.id)}
                    variant="outline"
                    size="sm"
                  >
                    <StopCircle className="h-4 w-4 mr-2" />
                    Clock Out
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TimeTracking;