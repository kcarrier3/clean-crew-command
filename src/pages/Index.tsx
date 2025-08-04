import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TimeTracking from '@/components/TimeTracking';
import WorkerStatusDashboard from '@/components/WorkerStatusDashboard';

const Index = () => {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Summit Connect</h1>
          <p className="text-muted-foreground">Janitorial Services Management System</p>
        </div>
        
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="dashboard">Worker Dashboard</TabsTrigger>
            <TabsTrigger value="clock">Time Clock</TabsTrigger>
          </TabsList>
          
          <TabsContent value="dashboard" className="mt-6">
            <WorkerStatusDashboard />
          </TabsContent>
          
          <TabsContent value="clock" className="mt-6">
            <TimeTracking />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
