import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft, MapPin, Clock, DollarSign, FileText, Lock, Shield,
  Plus, ClipboardList, Camera, Users, CheckCircle, AlertTriangle, XCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { AccountContacts } from './AccountContacts';
import { CreateWorkOrderDialog } from './CreateWorkOrderDialog';
import { WorkOrderDetail } from './WorkOrderDetail';
import { format } from 'date-fns';

interface JobSite {
  id: string;
  name: string;
  address: string | null;
  client_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  estimated_duration: string | null;
  budget_info: string | null;
  special_instructions: string | null;
  access_instructions: string | null;
  safety_requirements: string | null;
  is_recurring_monthly: boolean;
  budgeted_hours: number | null;
  used_hours: number | null;
  remaining_hours: number | null;
  active: boolean;
}

interface WorkOrder {
  id: string;
  title: string;
  status: 'open' | 'in_progress' | 'completed' | 'reviewed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  created_at: string;
  due_date: string | null;
  profiles?: { first_name: string; last_name: string };
}

interface Inspection {
  id: string;
  overall_score: number | null;
  overall_rating: 'green' | 'yellow' | 'red' | null;
  completed_at: string | null;
  profiles: { first_name: string; last_name: string };
}

interface ScheduledEmployee {
  id: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
  shift_start: string;
  shift_end: string;
}

interface AccountDetailProps {
  jobSite: JobSite;
  onBack: () => void;
}

const statusColors: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  reviewed: 'bg-gray-100 text-gray-800',
};

const priorityColors: Record<string, string> = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800',
};

const RatingIcon = ({ rating }: { rating: 'green' | 'yellow' | 'red' | null }) => {
  if (rating === 'green') return <CheckCircle className="h-4 w-4 text-green-600" />;
  if (rating === 'yellow') return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
  if (rating === 'red') return <XCircle className="h-4 w-4 text-red-600" />;
  return null;
};

export const AccountDetail = ({ jobSite, onBack }: AccountDetailProps) => {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [scheduledEmployees, setScheduledEmployees] = useState<ScheduledEmployee[]>([]);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [createWOOpen, setCreateWOOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { isManager } = useAuth();

  useEffect(() => {
    fetchAll();
  }, [jobSite.id]);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchWorkOrders(), fetchInspections(), fetchScheduledEmployees()]);
    setLoading(false);
  };

  const fetchWorkOrders = async () => {
    const { data } = await supabase
      .from('work_orders')
      .select(`
        id, title, status, priority, created_at, due_date,
        profiles:assigned_to(first_name, last_name)
      `)
      .eq('job_site_id', jobSite.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setWorkOrders((data || []) as unknown as WorkOrder[]);
  };

  const fetchInspections = async () => {
    const { data } = await supabase
      .from('inspections')
      .select(`
        id, overall_score, overall_rating, completed_at,
        profiles:inspector_id(first_name, last_name)
      `)
      .eq('job_site_id', jobSite.id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(10);
    setInspections((data || []) as unknown as Inspection[]);
  };

  const fetchScheduledEmployees = async () => {
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const { data } = await supabase
      .from('employee_schedules')
      .select(`
        id, shift_start, shift_end,
        profiles:employee_id(id, first_name, last_name, job_title)
      `)
      .eq('job_site_id', jobSite.id)
      .gte('shift_start', today)
      .lte('shift_start', nextWeek)
      .order('shift_start');

    if (data) {
      const employees = data.map((s: any) => ({
        id: s.profiles?.id,
        first_name: s.profiles?.first_name,
        last_name: s.profiles?.last_name,
        job_title: s.profiles?.job_title,
        shift_start: s.shift_start,
        shift_end: s.shift_end,
      }));
      setScheduledEmployees(employees);
    }
  };

  const hoursPercent = jobSite.budgeted_hours && jobSite.used_hours
    ? Math.min(100, Math.round((jobSite.used_hours / jobSite.budgeted_hours) * 100))
    : 0;

  const openWorkOrders = workOrders.filter(wo => wo.status === 'open' || wo.status === 'in_progress');
  const avgScore = inspections.length > 0
    ? Math.round(inspections.reduce((sum, i) => sum + (i.overall_score || 0), 0) / inspections.length)
    : null;

  if (selectedWorkOrder) {
    return (
      <WorkOrderDetail
        workOrder={selectedWorkOrder as any}
        onBack={() => setSelectedWorkOrder(null)}
        onUpdate={fetchWorkOrders}
      />
    );
  }

  return (
    <div className="p-3 md:p-6 space-y-6 max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-start gap-2 md:gap-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="mt-1">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 md:gap-3 flex-wrap">
            <h1 className="text-xl md:text-2xl font-bold break-words">{jobSite.name}</h1>
            <Badge variant={jobSite.active ? 'default' : 'secondary'}>
              {jobSite.active ? 'Active' : 'Inactive'}
            </Badge>
            {jobSite.is_recurring_monthly && (
              <Badge variant="outline">Recurring Monthly</Badge>
            )}
          </div>
          {jobSite.address && (
            <p className="text-muted-foreground flex items-start gap-1 mt-1 text-sm break-words">
              <MapPin className="h-3.5 w-3.5" />
              {jobSite.address}
            </p>
          )}
        </div>
        {isManager() && (
          <Button onClick={() => setCreateWOOpen(true)} size="sm" className="shrink-0">
            <Plus className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">New Work Order</span>
            <span className="md:hidden">New WO</span>
          </Button>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-orange-600">{openWorkOrders.length}</p>
            <p className="text-xs text-muted-foreground">Open Work Orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{inspections.length}</p>
            <p className="text-xs text-muted-foreground">Inspections</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className={`text-2xl font-bold ${avgScore === null ? 'text-muted-foreground' : avgScore >= 80 ? 'text-green-600' : avgScore >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
              {avgScore !== null ? `${avgScore}%` : '—'}
            </p>
            <p className="text-xs text-muted-foreground">Avg QA Score</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{scheduledEmployees.length}</p>
            <p className="text-xs text-muted-foreground">Scheduled (7 days)</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="grid grid-cols-4 w-full max-w-lg h-auto">
          <TabsTrigger value="overview" className="text-xs md:text-sm px-1 py-1.5">Overview</TabsTrigger>
          <TabsTrigger value="workorders" className="text-xs md:text-sm px-1 py-1.5">
            <span className="truncate">Work Orders</span>
            {openWorkOrders.length > 0 && (
              <Badge className="ml-1 bg-orange-500 text-white text-[10px] h-4 px-1">
                {openWorkOrders.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="inspections" className="text-xs md:text-sm px-1 py-1.5">QA History</TabsTrigger>
          <TabsTrigger value="team" className="text-xs md:text-sm px-1 py-1.5">Team</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          {/* Contacts */}
          <Card>
            <CardContent className="p-4">
              <AccountContacts jobSiteId={jobSite.id} />
            </CardContent>
          </Card>

          {/* Budget */}
          {jobSite.budgeted_hours && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Budget Hours
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="flex justify-between text-sm mb-2">
                  <span>Used: {jobSite.used_hours || 0} hrs</span>
                  <span>Budget: {jobSite.budgeted_hours} hrs</span>
                </div>
                <Progress value={hoursPercent} className={`h-2 ${hoursPercent > 90 ? 'bg-red-100' : ''}`} />
                <p className="text-xs text-muted-foreground mt-1">
                  {jobSite.remaining_hours ?? (jobSite.budgeted_hours - (jobSite.used_hours || 0))} hrs remaining
                </p>
              </CardContent>
            </Card>
          )}

          {/* Instructions */}
          {(jobSite.special_instructions || jobSite.access_instructions || jobSite.safety_requirements) && (
            <Card>
              <CardContent className="p-4 space-y-3">
                {jobSite.special_instructions && (
                  <div>
                    <p className="text-sm font-semibold flex items-center gap-1.5 mb-1">
                      <FileText className="h-3.5 w-3.5" />
                      Special Instructions
                    </p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{jobSite.special_instructions}</p>
                  </div>
                )}
                {jobSite.access_instructions && (
                  <div>
                    <p className="text-sm font-semibold flex items-center gap-1.5 mb-1">
                      <Lock className="h-3.5 w-3.5" />
                      Access Instructions
                      <Badge variant="outline" className="text-xs">Secure</Badge>
                    </p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{jobSite.access_instructions}</p>
                  </div>
                )}
                {jobSite.safety_requirements && (
                  <div>
                    <p className="text-sm font-semibold flex items-center gap-1.5 mb-1">
                      <Shield className="h-3.5 w-3.5" />
                      Safety Requirements
                    </p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{jobSite.safety_requirements}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Work Orders Tab */}
        <TabsContent value="workorders" className="mt-4 space-y-3">
          {workOrders.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No work orders for this account yet.</p>
                {isManager() && (
                  <Button className="mt-3" onClick={() => setCreateWOOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Work Order
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            workOrders.map(wo => (
              <Card
                key={wo.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedWorkOrder(wo)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-medium">{wo.title}</p>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        <Badge className={priorityColors[wo.priority] + ' text-xs'}>{wo.priority}</Badge>
                        <Badge className={statusColors[wo.status] + ' text-xs'}>{wo.status.replace('_', ' ')}</Badge>
                        {wo.profiles && (
                          <span className="text-xs text-muted-foreground">
                            Assigned: {wo.profiles.first_name} {wo.profiles.last_name}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground text-right">
                      {format(new Date(wo.created_at), 'MMM d')}
                      {wo.due_date && (
                        <p>Due: {format(new Date(wo.due_date), 'MMM d')}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* QA History Tab */}
        <TabsContent value="inspections" className="mt-4 space-y-3">
          {inspections.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <Camera className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No inspections recorded for this account yet.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Score trend summary */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Average QA Score</span>
                    <span className={`text-xl font-bold ${avgScore !== null && avgScore >= 80 ? 'text-green-600' : avgScore !== null && avgScore >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {avgScore !== null ? `${avgScore}%` : '—'}
                    </span>
                  </div>
                  <Progress value={avgScore ?? 0} className="h-1.5" />
                </CardContent>
              </Card>

              {inspections.map(inspection => (
                <Card key={inspection.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <RatingIcon rating={inspection.overall_rating} />
                        <div>
                          <p className="font-medium text-sm">
                            {inspection.overall_score !== null ? `${inspection.overall_score.toFixed(0)}%` : 'No score'}
                            {' '}
                            <span className="capitalize text-muted-foreground font-normal">
                              — {inspection.overall_rating || 'unrated'}
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            By {inspection.profiles?.first_name} {inspection.profiles?.last_name}
                            {inspection.completed_at && (
                              <> · {format(new Date(inspection.completed_at), 'MMM d, yyyy')}</>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team" className="mt-4 space-y-3">
          {scheduledEmployees.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No employees scheduled for this account in the next 7 days.</p>
              </CardContent>
            </Card>
          ) : (
            scheduledEmployees.map(emp => (
              <Card key={`${emp.id}-${emp.shift_start}`}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{emp.first_name} {emp.last_name}</p>
                      {emp.job_title && (
                        <p className="text-xs text-muted-foreground">{emp.job_title}</p>
                      )}
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <p>{format(new Date(emp.shift_start), 'EEE MMM d')}</p>
                      <p>
                        {format(new Date(emp.shift_start), 'h:mm a')} –{' '}
                        {format(new Date(emp.shift_end), 'h:mm a')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <CreateWorkOrderDialog
        open={createWOOpen}
        onOpenChange={setCreateWOOpen}
        onSuccess={() => { setCreateWOOpen(false); fetchWorkOrders(); }}
        preSelectedJobSite={jobSite.id}
      />
    </div>
  );
};
