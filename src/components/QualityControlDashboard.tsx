import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Camera, FileText, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { CreateWorkOrderDialog } from './CreateWorkOrderDialog';
import { WorkOrderDetailsDialog } from './WorkOrderDetailsDialog';
import { useToast } from '@/hooks/use-toast';

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
  employees?: { first_name: string; last_name: string };
  created_by_employee?: { first_name: string; last_name: string };
}

const QualityControlDashboard = () => {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchWorkOrders();
  }, []);

  const fetchWorkOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('work_orders')
        .select(`
          *,
          job_sites(name),
          employees:assigned_to(first_name, last_name),
          created_by_employee:created_by(first_name, last_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWorkOrders((data || []) as unknown as WorkOrder[]);
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'low':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  const filterWorkOrders = (status?: string) => {
    if (!status) return workOrders;
    return workOrders.filter(wo => wo.status === status);
  };

  const WorkOrderCard = ({ workOrder }: { workOrder: WorkOrder }) => (
    <Card 
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => setSelectedWorkOrder(workOrder)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            {getStatusIcon(workOrder.status)}
            <h3 className="font-semibold text-sm">{workOrder.title}</h3>
          </div>
          <Badge className={`${getPriorityColor(workOrder.priority)} text-white text-xs`}>
            {workOrder.priority}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
          {workOrder.description}
        </p>
        <div className="space-y-1 text-xs text-muted-foreground">
          <div>Site: {workOrder.job_sites?.name}</div>
          <div>Assigned: {workOrder.employees?.first_name} {workOrder.employees?.last_name}</div>
          <div>Due: {new Date(workOrder.due_date).toLocaleDateString()}</div>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Quality Control</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-4 bg-muted rounded mb-2"></div>
                <div className="h-3 bg-muted rounded mb-2"></div>
                <div className="h-3 bg-muted rounded w-3/4"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Quality Control</h2>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Work Order
        </Button>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">All ({workOrders.length})</TabsTrigger>
          <TabsTrigger value="open">Open ({filterWorkOrders('open').length})</TabsTrigger>
          <TabsTrigger value="in_progress">In Progress ({filterWorkOrders('in_progress').length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({filterWorkOrders('completed').length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workOrders.map((workOrder) => (
              <WorkOrderCard key={workOrder.id} workOrder={workOrder} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="open" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filterWorkOrders('open').map((workOrder) => (
              <WorkOrderCard key={workOrder.id} workOrder={workOrder} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="in_progress" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filterWorkOrders('in_progress').map((workOrder) => (
              <WorkOrderCard key={workOrder.id} workOrder={workOrder} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="completed" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filterWorkOrders('completed').map((workOrder) => (
              <WorkOrderCard key={workOrder.id} workOrder={workOrder} />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <CreateWorkOrderDialog 
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={() => {
          fetchWorkOrders();
          setCreateDialogOpen(false);
        }}
      />

      {selectedWorkOrder && (
        <WorkOrderDetailsDialog
          workOrder={selectedWorkOrder}
          open={!!selectedWorkOrder}
          onOpenChange={(open) => !open && setSelectedWorkOrder(null)}
          onUpdate={fetchWorkOrders}
        />
      )}
    </div>
  );
};

export default QualityControlDashboard;