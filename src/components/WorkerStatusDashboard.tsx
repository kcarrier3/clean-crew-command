import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, Users, AlertCircle, CheckCircle2, Timer, FileText, CalendarDays } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import TimeTracking from './TimeTracking';
import TimeOffRequests from './TimeOffRequests';

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
  notes: string | null;
  job_sites: JobSite;
  employees: Employee;
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

interface WorkerStatus {
  employee: Employee;
  schedule: Schedule | null;
  timeEntry: TimeEntry | null;
  status: 'clocked-in' | 'late' | 'no-show' | 'scheduled';
  minutesLate?: number;
}

const WorkerStatusDashboard = () => {
  const [workerStatuses, setWorkerStatuses] = useState<WorkerStatus[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const { toast } = useToast();

  useEffect(() => {
    fetchWorkerStatuses();
    
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      fetchWorkerStatuses(); // Refresh data every minute to update statuses
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  const fetchWorkerStatuses = async () => {
    try {
      // Get current day of week (1=Monday, 7=Sunday)
      const currentDay = new Date().getDay();
      const adjustedDay = currentDay === 0 ? 7 : currentDay;
      const today = new Date().toISOString().split('T')[0];

      // Fetch all employees
      const { data: employees, error: employeesError } = await supabase
        .from('employees')
        .select('*')
        .eq('active', true)
        .order('first_name');

      if (employeesError) throw employeesError;

      // Fetch today's schedules
      const { data: schedules, error: schedulesError } = await supabase
        .from('employee_schedules')
        .select(`
          *,
          job_sites:job_site_id(id, name, address, client_name),
          employees:employee_id(id, employee_id, first_name, last_name)
        `)
        .eq('active', true)
        .contains('days_of_week', [adjustedDay])
        .lte('start_date', today)
        .or(`end_date.is.null,end_date.gte.${today}`);

      if (schedulesError) throw schedulesError;

      // Fetch active time entries (clocked in workers)
      const { data: timeEntries, error: timeEntriesError } = await supabase
        .from('time_entries')
        .select(`
          *,
          employees:employee_id(id, employee_id, first_name, last_name),
          job_sites:job_site_id(id, name, address, client_name)
        `)
        .is('clock_out', null)
        .order('clock_in', { ascending: true }); // Ordered by who clocked in first

      if (timeEntriesError) throw timeEntriesError;

      // Create worker status objects
      const statuses: WorkerStatus[] = [];

      // Process employees with schedules
      schedules?.forEach((schedule) => {
        const employee = schedule.employees;
        const timeEntry = timeEntries?.find(entry => entry.employee_id === employee.id);
        
        let status: WorkerStatus['status'] = 'scheduled';
        let minutesLate = 0;

        if (timeEntry) {
          status = 'clocked-in';
        } else {
          // Check if employee is late or no-show
          const scheduledTime = new Date(`${today}T${schedule.start_time}`);
          const now = new Date();
          const diffMs = now.getTime() - scheduledTime.getTime();
          minutesLate = Math.floor(diffMs / (1000 * 60));

          if (minutesLate > 15) {
            status = 'no-show';
          } else if (minutesLate > 0) {
            status = 'late';
          }
        }

        statuses.push({
          employee,
          schedule,
          timeEntry: timeEntry || null,
          status,
          minutesLate: minutesLate > 0 ? minutesLate : undefined
        });
      });

      // Add employees who are clocked in but don't have a schedule today
      timeEntries?.forEach((timeEntry) => {
        const alreadyAdded = statuses.find(s => s.employee.id === timeEntry.employee_id);
        if (!alreadyAdded) {
          statuses.push({
            employee: timeEntry.employees,
            schedule: null,
            timeEntry,
            status: 'clocked-in'
          });
        }
      });

      // Sort: clocked in first, then by first name
      statuses.sort((a, b) => {
        if (a.timeEntry && b.timeEntry) {
          return new Date(a.timeEntry.clock_in).getTime() - new Date(b.timeEntry.clock_in).getTime();
        }
        if (a.timeEntry && !b.timeEntry) return -1;
        if (!a.timeEntry && b.timeEntry) return 1;
        return a.employee.first_name.localeCompare(b.employee.first_name);
      });

      setWorkerStatuses(statuses);

    } catch (error) {
      console.error('Error fetching worker statuses:', error);
      toast({ 
        title: 'Error', 
        description: 'Failed to fetch worker statuses', 
        variant: 'destructive' 
      });
    }
  };

  const getStatusIcon = (status: WorkerStatus['status']) => {
    switch (status) {
      case 'clocked-in':
        return <div className="w-3 h-3 bg-green-500 rounded-full" />;
      case 'late':
        return <div className="w-3 h-3 bg-yellow-500 rounded-full" />;
      case 'no-show':
        return <div className="w-3 h-3 bg-red-500 rounded-full" />;
      default:
        return <div className="w-3 h-3 bg-gray-400 rounded-full" />;
    }
  };

  const getStatusBadge = (status: WorkerStatus['status'], minutesLate?: number) => {
    switch (status) {
      case 'clocked-in':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Clocked In</Badge>;
      case 'late':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">
          Late ({minutesLate}m)
        </Badge>;
      case 'no-show':
        return <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-200">
          No Show ({minutesLate}m)
        </Badge>;
      default:
        return <Badge variant="outline">Scheduled</Badge>;
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

  const getStatusCounts = () => {
    return {
      clockedIn: workerStatuses.filter(w => w.status === 'clocked-in').length,
      late: workerStatuses.filter(w => w.status === 'late').length,
      noShow: workerStatuses.filter(w => w.status === 'no-show').length,
      scheduled: workerStatuses.filter(w => w.status === 'scheduled').length
    };
  };

  const counts = getStatusCounts();

  return (
    <div className="space-y-6">
      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold text-green-600">{counts.clockedIn}</p>
                <p className="text-sm text-muted-foreground">Clocked In</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Timer className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold text-yellow-600">{counts.late}</p>
                <p className="text-sm text-muted-foreground">Late</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-2xl font-bold text-red-600">{counts.noShow}</p>
                <p className="text-sm text-muted-foreground">No Show</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-gray-500" />
              <div>
                <p className="text-2xl font-bold text-gray-600">{counts.scheduled}</p>
                <p className="text-sm text-muted-foreground">Scheduled</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Worker Status List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Worker Status - {currentTime.toLocaleDateString()}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {workerStatuses.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No workers scheduled for today</p>
          ) : (
            <div className="space-y-3">
              {workerStatuses.map((worker) => (
                <div key={worker.employee.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-4">
                    {getStatusIcon(worker.status)}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">
                          {worker.employee.first_name} {worker.employee.last_name}
                        </h3>
                        <Badge variant="outline" className="text-xs">
                          {worker.employee.employee_id}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                        {worker.schedule && (
                          <>
                            <span>Scheduled: {worker.schedule.start_time} - {worker.schedule.end_time}</span>
                            <span>@ {worker.schedule.job_sites.name}</span>
                          </>
                        )}
                        {worker.timeEntry && (
                          <>
                            <span>Clocked in: {new Date(worker.timeEntry.clock_in).toLocaleTimeString()}</span>
                            <span>@ {worker.timeEntry.job_sites.name}</span>
                          </>
                         )}
                       </div>
                       {worker.schedule?.notes && (
                         <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                           <div className="flex items-center gap-2 mb-1">
                             <FileText className="h-3 w-3 text-blue-600" />
                             <span className="font-medium text-blue-800 text-xs">Shift Notes:</span>
                           </div>
                           <p className="text-blue-700 text-xs">{worker.schedule.notes}</p>
                         </div>
                       )}
                     </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {worker.timeEntry && (
                      <div className="text-right">
                        <div className="font-mono text-lg font-semibold">
                          {formatDuration(worker.timeEntry.clock_in)}
                        </div>
                        <div className="text-xs text-muted-foreground">Hours worked</div>
                      </div>
                    )}
                    {getStatusBadge(worker.status, worker.minutesLate)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WorkerStatusDashboard;