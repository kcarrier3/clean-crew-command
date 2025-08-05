import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Clock, Calendar, FileText } from 'lucide-react';
import TimeTracking from '@/components/TimeTracking';
import WorkerStatusDashboard from '@/components/WorkerStatusDashboard';
import SchedulingDashboard from '@/components/SchedulingDashboard';
import EmployeeSelector from '@/components/EmployeeSelector';
import QualityControlDashboard from '@/components/QualityControlDashboard';
import { WorkOrdersDashboard } from '@/components/WorkOrdersDashboard';
import { NotificationBell } from '@/components/NotificationBell';
import { TestNotificationButton } from '@/components/TestNotificationButton';

const Index = () => {
  const [activeTab, setActiveTab] = useState("employee");

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop padding, reduced mobile padding */}
      <div className="p-6 md:p-6 pb-24 md:pb-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8 flex justify-between items-center">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold mb-2">Summit Connect</h1>
              <p className="text-muted-foreground text-sm md:text-base">Janitorial Services Management System</p>
            </div>
            <div className="flex items-center gap-3">
              <TestNotificationButton />
              <NotificationBell />
            </div>
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* Desktop: Show all tabs */}
            <TabsList className="hidden md:grid w-full grid-cols-6">
              <TabsTrigger value="employee">Employee Portal</TabsTrigger>
              <TabsTrigger value="dashboard">Manager Dashboard</TabsTrigger>
              <TabsTrigger value="clock">Time Clock</TabsTrigger>
              <TabsTrigger value="scheduling">Scheduling</TabsTrigger>
              <TabsTrigger value="quality">Quality Control</TabsTrigger>
              <TabsTrigger value="workorders">Work Orders</TabsTrigger>
            </TabsList>

            {/* Mobile: Show only main tabs */}
            <TabsList className="md:hidden grid w-full grid-cols-3">
              <TabsTrigger value="employee">Employee Portal</TabsTrigger>
              <TabsTrigger value="dashboard">Manager Dashboard</TabsTrigger>
              <TabsTrigger value="quality">Quality Control</TabsTrigger>
            </TabsList>
            
            <TabsContent value="employee" className="mt-6">
              <EmployeeSelector />
            </TabsContent>
            
            <TabsContent value="dashboard" className="mt-6">
              <WorkerStatusDashboard />
            </TabsContent>
            
            <TabsContent value="clock" className="mt-6">
              <TimeTracking />
            </TabsContent>
            
            <TabsContent value="scheduling" className="mt-6">
              <SchedulingDashboard />
            </TabsContent>
            
            <TabsContent value="quality" className="mt-6">
              <QualityControlDashboard />
            </TabsContent>
            
            <TabsContent value="workorders" className="mt-6">
              <WorkOrdersDashboard />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Mobile Bottom Navigation - Fixed at bottom */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4">
        <div className="flex justify-around items-center max-w-md mx-auto">
          <Button
            variant={activeTab === "clock" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("clock")}
            className="flex flex-col items-center gap-1 h-auto py-2 px-3"
          >
            <Clock className="h-5 w-5" />
            <span className="text-xs">Time Clock</span>
          </Button>
          
          <Button
            variant={activeTab === "scheduling" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("scheduling")}
            className="flex flex-col items-center gap-1 h-auto py-2 px-3"
          >
            <Calendar className="h-5 w-5" />
            <span className="text-xs">Schedule</span>
          </Button>
          
          <Button
            variant={activeTab === "workorders" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("workorders")}
            className="flex flex-col items-center gap-1 h-auto py-2 px-3"
          >
            <FileText className="h-5 w-5" />
            <span className="text-xs">Work Orders</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
