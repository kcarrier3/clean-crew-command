import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, MapPin, Calendar, ClipboardList, CalendarDays, Camera } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import TimeClock from '@/components/TimeClock';
import InspectionHistory from '@/components/InspectionHistory';

interface Schedule {
  id: string;
  start_time: string;
  end_time: string;
  notes: string | null;
  days_of_week?: number[];
  start_date?: string;
  end_date?: string | null;
  job_sites: {
    id: string;
    name: string;
    address: string | null;
    client_name: string | null;
  };
}

interface WorkOrderLite {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  job_sites?: { name: string } | null;
}

const EmployeeDashboard = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [todaySchedules, setTodaySchedules] = useState<Schedule[]>([]);
  const [weekSchedules, setWeekSchedules] = useState<Schedule[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrderLite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      fetchTodaySchedules();
      fetchWeekSchedules();
      fetchWorkOrders();
    }
  }, [profile]);

  const fetchTodaySchedules = async () => {
    if (!profile) return;

    try {
      const today = new Date();
      const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay(); // Convert Sunday (0) to 7
      const todayDate = today.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('employee_schedules')
        .select(`
          id,
          start_time,
          end_time,
          notes,
          job_sites (
            id,
            name,
            address,
            client_name
          )
        `)
        .eq('active', true)
        .contains('days_of_week', [dayOfWeek])
        .lte('start_date', todayDate)
        .or(`end_date.is.null,end_date.gte.${todayDate}`)
        .eq('employee_id', profile.id);

      if (error) {
        console.error('Error fetching schedules:', error);
        toast({
          title: "Error",
          description: "Failed to load today's schedule",
          variant: "destructive"
        });
        return;
      }

      setTodaySchedules(data || []);
    } catch (error) {
      console.error('Error fetching schedules:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWeekSchedules = async () => {
    if (!profile) return;
    try {
      const todayDate = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('employee_schedules')
        .select(`
          id, start_time, end_time, notes, days_of_week, start_date, end_date,
          job_sites ( id, name, address, client_name )
        `)
        .eq('active', true)
        .eq('employee_id', profile.id)
        .lte('start_date', todayDate)
        .or(`end_date.is.null,end_date.gte.${todayDate}`);
      if (error) throw error;
      setWeekSchedules((data || []) as any);
    } catch (e) {
      console.error('Error fetching week schedules:', e);
    }
  };

  const fetchWorkOrders = async () => {
    if (!profile) return;
    try {
      const { data, error } = await supabase
        .from('work_orders')
        .select(`id, title, description, status, priority, due_date, job_sites(name)`)
        .eq('assigned_to', profile.id)
        .in('status', ['open', 'in_progress'])
        .order('due_date', { ascending: true, nullsFirst: false });
      if (error) throw error;
      setWorkOrders((data || []) as any);
    } catch (e) {
      console.error('Error fetching work orders:', e);
    }
  };

  const formatTime = (timeString: string | null) => {
    if (!timeString) return 'Not specified';
    
    try {
      const [hours, minutes] = timeString.split(':');
      const date = new Date();
      date.setHours(parseInt(hours), parseInt(minutes));
      return date.toLocaleTimeString([], { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    } catch (error) {
      return timeString;
    }
  };

  // Build week look-ahead: Sunday-Saturday of current week
  const getWeekDays = () => {
    const today = new Date();
    const day = today.getDay(); // 0 Sun .. 6 Sat
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - day);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      return d;
    });
  };

  const getShiftsForDay = (date: Date) => {
    const jsDay = date.getDay();
    const dayIdx = jsDay === 0 ? 7 : jsDay; // 1=Mon..7=Sun
    const dateStr = date.toISOString().split('T')[0];
    return weekSchedules.filter((s) => {
      if (!s.days_of_week?.includes(dayIdx)) return false;
      if (s.start_date && s.start_date > dateStr) return false;
      if (s.end_date && s.end_date < dateStr) return false;
      return true;
    });
  };

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading profile...</p>
      </div>
    );
  }

  const weekDays = getWeekDays();
  const today = new Date();
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">
          Welcome, {profile.first_name} {profile.last_name}
        </h2>
        <p className="text-muted-foreground">
          Employee ID: {profile.employee_id || 'Not assigned'} • {profile.job_title}
        </p>
      </div>

      {/* Time Clock */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Time Clock
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TimeClock forManager={false} />
        </CardContent>
      </Card>

      {/* Today's Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Today's Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading schedule...</p>
          ) : todaySchedules.length > 0 ? (
            <div className="space-y-4">
              {todaySchedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{schedule.job_sites.name}</p>
                          {schedule.job_sites.address && (
                            <p className="text-sm text-muted-foreground">
                              {schedule.job_sites.address}
                            </p>
                          )}
                          {schedule.job_sites.client_name && (
                            <p className="text-sm text-muted-foreground">
                              Client: {schedule.job_sites.client_name}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {schedule.notes && (
                        <p className="text-sm text-muted-foreground">
                          Notes: {schedule.notes}
                        </p>
                      )}
                    </div>
                    
                    <Badge variant="outline">Scheduled</Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No shifts scheduled for today</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* My Work Orders */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            My Work Orders
          </CardTitle>
        </CardHeader>
        <CardContent>
          {workOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No active work orders assigned
            </p>
          ) : (
            <div className="space-y-3">
              {workOrders.map((wo) => (
                <div key={wo.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <p className="font-medium">{wo.title}</p>
                    <Badge variant="outline" className="capitalize shrink-0">
                      {wo.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  {wo.job_sites?.name && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {wo.job_sites.name}
                    </p>
                  )}
                  {wo.due_date && (
                    <p className="text-xs text-muted-foreground">
                      Due {new Date(wo.due_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Week Look-Ahead */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            This Week
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {weekDays.map((date) => {
              const shifts = getShiftsForDay(date);
              const isToday = isSameDay(date, today);
              return (
                <div
                  key={date.toISOString()}
                  className={`border rounded-lg p-3 ${isToday ? 'border-primary bg-primary/5' : ''}`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <p className="font-medium text-sm">
                      {date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                      {isToday && <span className="ml-2 text-xs text-primary">Today</span>}
                    </p>
                    {shifts.length === 0 && (
                      <span className="text-xs text-muted-foreground">Off</span>
                    )}
                  </div>
                  {shifts.map((s) => (
                    <div key={s.id} className="text-xs text-muted-foreground">
                      {formatTime(s.start_time)} - {formatTime(s.end_time)} • {s.job_sites.name}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmployeeDashboard;