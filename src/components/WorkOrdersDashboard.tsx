import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Calendar, User, MapPin, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { CreateWorkOrderDialog } from './CreateWorkOrderDialog';
import { WorkOrderDetail } from './WorkOrderDetail';

interface WorkOrder {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'completed' | 'reviewed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date: string;
  created_at: string;
  assigned_to: string;
  job_site_id: string;
  job_sites?: { name: string };
  employees?: { first_name: string; last_name: string };
}

export const WorkOrdersDashboard = () => {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const { toast } = useToast();
  const { canCreateWorkOrders } = useAuth();

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

  const fetchWorkOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('work_orders')
        .select(`
          *,
          job_sites (name),
          employees (first_name, last_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWorkOrders((data || []) as unknown as WorkOrder[]);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch work orders",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkOrders();
  }, []);

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
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Work Orders</h1>
        {canCreateWorkOrders() && (
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Work Order
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 w-full max-w-lg">
          <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
          <TabsTrigger value="open">Open ({counts.open})</TabsTrigger>
          <TabsTrigger value="in_progress">In Progress ({counts.in_progress})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({counts.completed})</TabsTrigger>
          <TabsTrigger value="reviewed">Reviewed ({counts.reviewed})</TabsTrigger>
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
                        {workOrder.employees?.first_name} {workOrder.employees?.last_name}
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

      <CreateWorkOrderDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={fetchWorkOrders}
      />
    </div>
  );
};