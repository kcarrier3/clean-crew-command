import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Clock, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface LateNotification {
  id: string;
  employee_id: string;
  time_entry_id: string;
  notified_at: string;
  minutes_late: number;
  employee: {
    first_name: string;
    last_name: string;
    job_title: string;
  };
}

export function LateNotifications() {
  const { hasRole } = useAuth();
  const [notifications, setNotifications] = useState<LateNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const isManager = hasRole('manager') || hasRole('admin');

  useEffect(() => {
    if (isManager) {
      fetchLateNotifications();
      
      // Set up real-time subscription for new late notifications
      const channel = supabase
        .channel('late-notifications-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'late_notifications'
          },
          (payload) => {
            console.log('New late notification:', payload);
            fetchLateNotifications();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      setLoading(false);
    }
  }, [isManager]);

  const fetchLateNotifications = async () => {
    try {
      setLoading(true);
      
      // Get notifications from the last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data, error } = await supabase
        .from('late_notifications')
        .select(`
          *,
          employee:employee_id(
            first_name,
            last_name,
            job_title
          )
        `)
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setNotifications(data as any || []);
    } catch (error) {
      console.error('Error fetching late notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isManager) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          You don't have permission to view late notifications.
        </AlertDescription>
      </Alert>
    );
  }

  if (loading) {
    return <div>Loading notifications...</div>;
  }

  const todayNotifications = notifications.filter(n => {
    const notifDate = new Date(n.notified_at);
    const today = new Date();
    return notifDate.toDateString() === today.toDateString();
  });

  const olderNotifications = notifications.filter(n => {
    const notifDate = new Date(n.notified_at);
    const today = new Date();
    return notifDate.toDateString() !== today.toDateString();
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Late Clock-Ins
          </CardTitle>
          <CardDescription>
            Workers who clocked in more than 15 minutes late
          </CardDescription>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No late clock-ins in the past 7 days
            </p>
          ) : (
            <div className="space-y-6">
              {todayNotifications.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-3">Today</h3>
                  <div className="space-y-2">
                    {todayNotifications.map((notification) => (
                      <Card key={notification.id} className="border-l-4 border-l-orange-500">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3 flex-1">
                              <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
                                <User className="h-5 w-5 text-orange-600" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-medium">
                                    {notification.employee.first_name} {notification.employee.last_name}
                                  </p>
                                  <Badge variant="outline" className="text-xs">
                                    {notification.employee.job_title}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  Clocked in {notification.minutes_late} minutes late
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {formatDistanceToNow(new Date(notification.notified_at), { addSuffix: true })}
                                </p>
                              </div>
                            </div>
                            <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                              {notification.minutes_late} min
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {olderNotifications.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-3">Earlier</h3>
                  <div className="space-y-2">
                    {olderNotifications.map((notification) => (
                      <Card key={notification.id} className="border-l-4 border-l-gray-300">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3 flex-1">
                              <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                                <User className="h-5 w-5 text-gray-600" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-medium">
                                    {notification.employee.first_name} {notification.employee.last_name}
                                  </p>
                                  <Badge variant="outline" className="text-xs">
                                    {notification.employee.job_title}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  Clocked in {notification.minutes_late} minutes late
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {formatDistanceToNow(new Date(notification.notified_at), { addSuffix: true })}
                                </p>
                              </div>
                            </div>
                            <Badge variant="secondary">
                              {notification.minutes_late} min
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
