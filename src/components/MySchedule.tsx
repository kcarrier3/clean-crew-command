import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Clock, MapPin, Plus, CheckCircle, XCircle, AlertCircle, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface Schedule {
  id: string;
  start_time: string;
  end_time: string;
  days_of_week: number[];
  start_date: string;
  end_date: string | null;
  notes: string | null;
  job_sites: {
    id: string;
    name: string;
    address: string | null;
    client_name: string | null;
    special_instructions: string | null;
  };
}

interface TimeOffRequest {
  id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'declined';
  requested_at: string;
  reviewed_at: string | null;
  manager_notes: string | null;
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const MySchedule = () => {
  const { profile } = useAuth();
  const { toast } = useToast();

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [timeOffRequests, setTimeOffRequests] = useState<TimeOffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    start_date: '',
    end_date: '',
    reason: '',
  });

  useEffect(() => {
    if (profile?.id) {
      fetchSchedules();
      fetchTimeOffRequests();

      // Real-time subscription for time off request status updates
      const channel = supabase
        .channel('my_time_off_requests')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'time_off_requests',
            filter: `employee_id=eq.${profile.id}`,
          },
          (payload) => {
            setTimeOffRequests(prev =>
              prev.map(r => r.id === payload.new.id ? { ...r, ...payload.new } : r)
            );
            const updated = payload.new as TimeOffRequest;
            if (updated.status === 'approved') {
              toast({ title: 'Time Off Approved!', description: `Your request for ${updated.start_date} has been approved.` });
            } else if (updated.status === 'declined') {
              toast({ title: 'Time Off Declined', description: `Your request for ${updated.start_date} was declined.`, variant: 'destructive' });
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [profile?.id]);

  const fetchSchedules = async () => {
    if (!profile?.id) return;
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('employee_schedules')
      .select(`
        id, start_time, end_time, days_of_week, start_date, end_date, notes,
        job_sites:job_site_id(id, name, address, client_name, special_instructions)
      `)
      .eq('employee_id', profile.id)
      .eq('active', true)
      .or(`end_date.is.null,end_date.gte.${today}`)
      .order('start_date');

    if (error) {
      toast({ title: 'Error', description: 'Failed to load schedule', variant: 'destructive' });
    } else {
      setSchedules(data || []);
    }
    setLoading(false);
  };

  const fetchTimeOffRequests = async () => {
    if (!profile?.id) return;
    const { data, error } = await supabase
      .from('time_off_requests')
      .select('id, start_date, end_date, reason, status, requested_at, reviewed_at, manager_notes')
      .eq('employee_id', profile.id)
      .order('requested_at', { ascending: false });

    if (error) {
      toast({ title: 'Error', description: 'Failed to load time off requests', variant: 'destructive' });
    } else {
      setTimeOffRequests((data || []) as TimeOffRequest[]);
    }
  };

  const submitTimeOffRequest = async () => {
    if (!profile?.id || !formData.start_date || !formData.end_date) {
      toast({ title: 'Error', description: 'Please fill in the start and end dates', variant: 'destructive' });
      return;
    }
    if (formData.end_date < formData.start_date) {
      toast({ title: 'Error', description: 'End date must be on or after start date', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('time_off_requests').insert({
      employee_id: profile.id,
      start_date: formData.start_date,
      end_date: formData.end_date,
      reason: formData.reason || null,
    });

    if (error) {
      toast({ title: 'Error', description: 'Failed to submit request', variant: 'destructive' });
    } else {
      toast({ title: 'Request Submitted', description: 'Your time off request has been sent to your manager.' });
      setIsDialogOpen(false);
      setFormData({ start_date: '', end_date: '', reason: '' });
      fetchTimeOffRequests();
    }
    setSubmitting(false);
  };

  const formatTime = (time: string) => {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDays = (days: number[]) => {
    if (days.length === 7) return 'Every day';
    if (days.length === 5 && !days.includes(6) && !days.includes(7)) return 'Mon – Fri';
    return days.map(d => DAY_SHORT[d - 1]).join(', ');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'declined':
        return <Badge className="bg-red-100 text-red-800 border-red-200"><XCircle className="h-3 w-3 mr-1" />Declined</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200"><AlertCircle className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  const isToday = (days: number[]) => {
    const today = new Date().getDay(); // 0=Sun
    const adjusted = today === 0 ? 7 : today;
    return days.includes(adjusted);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">My Schedule</h2>
          <p className="text-muted-foreground text-sm">View your shifts and manage time off requests</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Request Time Off
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Request Time Off</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="tor_start">Start Date *</Label>
                  <Input
                    id="tor_start"
                    type="date"
                    value={formData.start_date}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={e => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="tor_end">End Date *</Label>
                  <Input
                    id="tor_end"
                    type="date"
                    value={formData.end_date}
                    min={formData.start_date || new Date().toISOString().split('T')[0]}
                    onChange={e => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="tor_reason">Reason (optional)</Label>
                <Textarea
                  id="tor_reason"
                  placeholder="Vacation, personal day, medical appointment..."
                  value={formData.reason}
                  onChange={e => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                  rows={3}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={submitTimeOffRequest} disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="schedule">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="schedule">
            <Calendar className="h-4 w-4 mr-2" />
            My Shifts
          </TabsTrigger>
          <TabsTrigger value="timeoff">
            <Clock className="h-4 w-4 mr-2" />
            Time Off Requests
          </TabsTrigger>
        </TabsList>

        {/* My Shifts */}
        <TabsContent value="schedule" className="space-y-4 mt-4">
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading schedule...</p>
          ) : schedules.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg mb-1">No active schedules</h3>
                <p className="text-sm text-muted-foreground">
                  Your manager hasn't assigned any shifts yet. Check back later.
                </p>
              </CardContent>
            </Card>
          ) : (
            schedules.map(schedule => (
              <Card key={schedule.id} className={isToday(schedule.days_of_week) ? 'border-primary' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      {schedule.job_sites?.name}
                    </CardTitle>
                    {isToday(schedule.days_of_week) && (
                      <Badge className="bg-primary text-primary-foreground text-xs">Today</Badge>
                    )}
                  </div>
                  {schedule.job_sites?.client_name && (
                    <CardDescription>{schedule.job_sites.client_name}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-4 text-sm flex-wrap">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      <span className="font-medium text-foreground">
                        {formatTime(schedule.start_time)} – {formatTime(schedule.end_time)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDays(schedule.days_of_week)}
                    </div>
                  </div>

                  {schedule.job_sites?.address && (
                    <p className="text-xs text-muted-foreground">{schedule.job_sites.address}</p>
                  )}

                  {schedule.end_date && (
                    <p className="text-xs text-muted-foreground">
                      Schedule ends: {new Date(schedule.end_date + 'T00:00:00').toLocaleDateString()}
                    </p>
                  )}

                  {schedule.notes && (
                    <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded text-sm">
                      <div className="flex items-center gap-1.5 mb-1 text-blue-800 dark:text-blue-200 font-medium">
                        <FileText className="h-3.5 w-3.5" />
                        Shift Notes
                      </div>
                      <p className="text-blue-700 dark:text-blue-300 whitespace-pre-wrap">{schedule.notes}</p>
                    </div>
                  )}

                  {schedule.job_sites?.special_instructions && (
                    <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded text-sm">
                      <div className="flex items-center gap-1.5 mb-1 text-amber-800 dark:text-amber-200 font-medium">
                        <FileText className="h-3.5 w-3.5" />
                        Special Instructions
                      </div>
                      <p className="text-amber-700 dark:text-amber-300 whitespace-pre-wrap">
                        {schedule.job_sites.special_instructions}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Time Off Requests */}
        <TabsContent value="timeoff" className="space-y-4 mt-4">
          {timeOffRequests.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg mb-1">No time off requests</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  You haven't submitted any time off requests yet.
                </p>
                <Button onClick={() => setIsDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Request Time Off
                </Button>
              </CardContent>
            </Card>
          ) : (
            timeOffRequests.map(request => (
              <Card key={request.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">
                          {new Date(request.start_date + 'T00:00:00').toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric'
                          })}
                          {request.start_date !== request.end_date && (
                            <> – {new Date(request.end_date + 'T00:00:00').toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric', year: 'numeric'
                            })}</>
                          )}
                        </span>
                        {getStatusBadge(request.status)}
                      </div>
                      {request.reason && (
                        <p className="text-sm text-muted-foreground">{request.reason}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Submitted {new Date(request.requested_at).toLocaleDateString()}
                      </p>
                      {request.manager_notes && (
                        <div className="mt-2 p-2 bg-muted rounded text-sm">
                          <span className="font-medium">Manager note: </span>
                          {request.manager_notes}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MySchedule;
