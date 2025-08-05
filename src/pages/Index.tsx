import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TimeTracking from '@/components/TimeTracking';
import WorkerStatusDashboard from '@/components/WorkerStatusDashboard';
import SchedulingDashboard from '@/components/SchedulingDashboard';
import EmployeeSelector from '@/components/EmployeeSelector';

const Index = () => {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Summit Connect</h1>
          <p className="text-muted-foreground">Janitorial Services Management System</p>
        </div>
        
        <Tabs defaultValue="employee" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="employee">Employee Portal</TabsTrigger>
            <TabsTrigger value="dashboard">Manager Dashboard</TabsTrigger>
            <TabsTrigger value="clock">Time Clock</TabsTrigger>
            <TabsTrigger value="scheduling">Scheduling</TabsTrigger>
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
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
