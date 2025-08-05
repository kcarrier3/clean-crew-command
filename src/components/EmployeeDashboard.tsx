import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, MapPin, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import TimeClock from '@/components/TimeClock';

interface Schedule {
  id: string;
  start_time: string;
  end_time: string;
  notes: string | null;
  job_sites: {
    id: string;
    name: string;
    address: string | null;
    client_name: string | null;
  };
}

const EmployeeDashboard = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [todaySchedules, setTodaySchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      fetchTodaySchedules();
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

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading profile...</p>
      </div>
    );
  }

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
    </div>
  );
};

export default EmployeeDashboard;