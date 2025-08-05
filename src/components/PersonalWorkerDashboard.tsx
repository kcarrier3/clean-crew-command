import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, Calendar, MapPin, FileText, CalendarDays } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import TimeClock from './TimeClock';
import TimeOffRequests from './TimeOffRequests';

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

interface PersonalWorkerDashboardProps {
  selectedEmployee?: Employee;
}

const PersonalWorkerDashboard = ({ selectedEmployee }: PersonalWorkerDashboardProps) => {
  const [todaySchedules, setTodaySchedules] = useState<Schedule[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (selectedEmployee) {
      fetchTodaySchedules();
    }
  }, [selectedEmployee]);

  const fetchTodaySchedules = async () => {
    if (!selectedEmployee) return;

    try {
      const currentDay = new Date().getDay();
      const adjustedDay = currentDay === 0 ? 7 : currentDay;
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('employee_schedules')
        .select(`
          *,
          job_sites:job_site_id(id, name, address, client_name),
          employees:employee_id(id, employee_id, first_name, last_name, job_title)
        `)
        .eq('employee_id', selectedEmployee.id)
        .eq('active', true)
        .contains('days_of_week', [adjustedDay])
        .lte('start_date', today)
        .or(`end_date.is.null,end_date.gte.${today}`);

      if (error) throw error;
      setTodaySchedules(data || []);
    } catch (error) {
      console.error('Error fetching today\'s schedules:', error);
      toast({
        title: "Error",
        description: "Failed to load today's schedule",
        variant: "destructive",
      });
    }
  };

  const formatTime = (time: string) => {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString([], { 
      hour: 'numeric', 
      minute: '2-digit' 
    });
  };

  if (!selectedEmployee) {
    return (
      <Card>
        <CardContent className="p-8">
          <p className="text-muted-foreground text-center">Select an employee to view their dashboard</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Dashboard for {selectedEmployee.first_name} {selectedEmployee.last_name}
          </CardTitle>
          <p className="text-muted-foreground">
            Employee ID: {selectedEmployee.employee_id} • {selectedEmployee.job_title}
          </p>
        </CardHeader>
      </Card>

      <Tabs defaultValue="schedule" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="schedule">My Schedule</TabsTrigger>
          <TabsTrigger value="timetracking">Time Tracking</TabsTrigger>
          <TabsTrigger value="timeoff">Time Off</TabsTrigger>
        </TabsList>
        
        <TabsContent value="schedule">
          <div className="space-y-4">
            {todaySchedules.length === 0 ? (
              <Card>
                <CardContent className="p-8">
                  <p className="text-muted-foreground text-center">No shifts scheduled for today</p>
                </CardContent>
              </Card>
            ) : (
              todaySchedules.map((schedule) => (
                <Card key={schedule.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Clock className="h-5 w-5 text-blue-600" />
                        <div>
                          <h3 className="font-semibold text-lg">
                            {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Today's Shift
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-green-700 border-green-200">
                        Scheduled
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="flex items-start gap-3">
                        <MapPin className="h-4 w-4 mt-1 text-muted-foreground" />
                        <div>
                          <h4 className="font-medium">{schedule.job_sites.name}</h4>
                          <p className="text-sm text-muted-foreground">{schedule.job_sites.address}</p>
                          <p className="text-sm text-muted-foreground">Client: {schedule.job_sites.client_name}</p>
                        </div>
                      </div>
                    </div>

                    {schedule.notes && (
                      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="h-4 w-4 text-blue-600" />
                          <span className="font-medium text-blue-800 text-sm">Shift Notes:</span>
                        </div>
                        <p className="text-blue-700 text-sm">{schedule.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="timetracking">
          <TimeClock forManager={false} selectedEmployeeId={selectedEmployee?.id} />
        </TabsContent>
        
        <TabsContent value="timeoff">
          <TimeOffRequests 
            isManager={false} 
            currentEmployeeId={selectedEmployee.id} 
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PersonalWorkerDashboard;