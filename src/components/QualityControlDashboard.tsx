import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Calendar, User, MapPin, AlertCircle, Camera, ClipboardList, QrCode } from 'lucide-react';
import InspectionHistory from './InspectionHistory';
import PorterReports from './PorterReports';
import PorterAssignmentsAdmin from './PorterAssignmentsAdmin';
import { supabase } from '@/integrations/supabase/client';
import { CreateWorkOrderDialog } from './CreateWorkOrderDialog';
import { WorkOrderDetail } from './WorkOrderDetail';
import { StartInspectionDialog } from './StartInspectionDialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';

interface WorkOrder {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'completed' | 'reviewed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  job_site_id: string;
  assigned_to: string;
  created_by: string;
  created_at: string;
  due_date: string;
  job_sites?: { name: string };
  profiles?: { first_name: string; last_name: string };
}

const QualityControlDashboard = () => {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [inspectionDialogOpen, setInspectionDialogOpen] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const { toast } = useToast();
  const { canCreateWorkOrders } = useAuth();

  useEffect(() => {
    fetchWorkOrders();
  }, []);

  const fetchWorkOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('work_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const assigneeIds = Array.from(
        new Set((data || []).map((wo: any) => wo.assigned_to).filter(Boolean))
      );
      let profilesById: Record<string, { first_name: string; last_name: string }> = {};
      if (assigneeIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles_directory' as any)
          .select('id, first_name, last_name')
          .in('id', assigneeIds);
        (profs || []).forEach((p: any) => {
          profilesById[p.id] = { first_name: p.first_name, last_name: p.last_name };
        });
      }
      const siteIds = Array.from(
        new Set((data || []).map((wo: any) => wo.job_site_id).filter(Boolean))
      );
      let sitesById: Record<string, { name: string }> = {};
      if (siteIds.length > 0) {
        const { data: sites } = await supabase
          .from('job_sites')
          .select('id, name')
          .in('id', siteIds);
        (sites || []).forEach((s: any) => {
          sitesById[s.id] = { name: s.name };
        });
      }
      const merged = (data || []).map((wo: any) => ({
        ...wo,
        job_sites: wo.job_site_id ? sitesById[wo.job_site_id] : undefined,
        profiles: wo.assigned_to ? profilesById[wo.assigned_to] : undefined,
      }));
      setWorkOrders(merged as unknown as WorkOrder[]);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch work orders",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const statusColors = {
    open: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-green-100 text-green-800',
    reviewed: 'bg-gray-100 text-gray-800'
  };

  const priorityColors = {
    low: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-orange-100 text-orange-800',
    urgent: 'bg-red-100 text-red-800'
  };

  const filteredWorkOrders = workOrders.filter(wo => {
    if (activeTab === 'all') return true;
    return wo.status === activeTab;
  });

  const getStatusCounts = () => {
    return {
      all: workOrders.length,
      open: workOrders.filter(wo => wo.status === 'open').length,
      in_progress: workOrders.filter(wo => wo.status === 'in_progress').length,
      completed: workOrders.filter(wo => wo.status === 'completed').length,
      reviewed: workOrders.filter(wo => wo.status === 'reviewed').length
    };
  };

  const counts = getStatusCounts();

  if (selectedWorkOrder) {
    return (
      <WorkOrderDetail
        workOrder={selectedWorkOrder}
        onBack={() => setSelectedWorkOrder(null)}
        onUpdate={fetchWorkOrders}
      />
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
        <h1 className="text-2xl sm:text-3xl font-bold">Quality Control</h1>
        <div className="flex flex-col gap-2 w-full sm:w-auto sm:flex-row">
          <Button 
            variant="orange" 
            className="w-full sm:w-auto"
            onClick={() => setInspectionDialogOpen(true)}
          >
            <Camera className="h-4 w-4 mr-2" />
            Start an Inspection
          </Button>
          {canCreateWorkOrders() && (
            <Button className="w-full sm:w-auto" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Work Order
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="inspections">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 h-auto w-full max-w-2xl mb-4">
          <TabsTrigger value="inspections" className="whitespace-normal text-xs sm:text-sm py-2">
            <Camera className="h-4 w-4 mr-2" />
            Inspections
          </TabsTrigger>
          <TabsTrigger value="workorders" className="whitespace-normal text-xs sm:text-sm py-2">
            <ClipboardList className="h-4 w-4 mr-2" />
            Work Orders
          </TabsTrigger>
          <TabsTrigger value="porter" className="whitespace-normal text-xs sm:text-sm py-2">
            <QrCode className="h-4 w-4 mr-2" />
            Porter Reports
          </TabsTrigger>
          {canCreateWorkOrders() && (
            <TabsTrigger value="porter-setup" className="whitespace-normal text-xs sm:text-sm py-2">
              <QrCode className="h-4 w-4 mr-2" />
              QR Setup
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="inspections">
          <InspectionHistory />
        </TabsContent>

        <TabsContent value="porter">
          <PorterReports />
        </TabsContent>

        <TabsContent value="porter-setup">
          <PorterAssignmentsAdmin />
        </TabsContent>

        <TabsContent value="workorders">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-2 sm:grid-cols-5 h-auto w-full max-w-lg">
          <TabsTrigger value="all" className="whitespace-normal text-xs sm:text-sm py-2">All ({counts.all})</TabsTrigger>
          <TabsTrigger value="open" className="whitespace-normal text-xs sm:text-sm py-2">Open ({counts.open})</TabsTrigger>
          <TabsTrigger value="in_progress" className="whitespace-normal text-xs sm:text-sm py-2">In Progress ({counts.in_progress})</TabsTrigger>
          <TabsTrigger value="completed" className="whitespace-normal text-xs sm:text-sm py-2">Completed ({counts.completed})</TabsTrigger>
          <TabsTrigger value="reviewed" className="whitespace-normal text-xs sm:text-sm py-2">Reviewed ({counts.reviewed})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          <div className="grid gap-4">
            {loading ? (
              <div className="text-center py-8">Loading work orders...</div>
            ) : filteredWorkOrders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No work orders found
              </div>
            ) : (
              filteredWorkOrders.map((workOrder) => (
                <Card 
                  key={workOrder.id} 
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedWorkOrder(workOrder)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{workOrder.title}</CardTitle>
                      <div className="flex gap-2">
                        <Badge className={priorityColors[workOrder.priority]}>
                          {workOrder.priority}
                        </Badge>
                        <Badge className={statusColors[workOrder.status]}>
                          {workOrder.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground mb-4 line-clamp-2">
                      {workOrder.description}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {workOrder.job_sites?.name}
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        {workOrder.profiles?.first_name} {workOrder.profiles?.last_name}
                      </div>
                      {workOrder.due_date && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          Due: {format(new Date(workOrder.due_date), 'MMM d, yyyy')}
                        </div>
                      )}
                      {workOrder.priority === 'urgent' && (
                        <div className="flex items-center gap-1 text-red-600">
                          <AlertCircle className="h-4 w-4" />
                          Urgent
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
        </Tabs>

        </TabsContent>
      </Tabs>

      <CreateWorkOrderDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={fetchWorkOrders}
      />

      <StartInspectionDialog
        open={inspectionDialogOpen}
        onOpenChange={setInspectionDialogOpen}
        onSuccess={fetchWorkOrders}
      />
    </div>
  );
};

export default QualityControlDashboard;