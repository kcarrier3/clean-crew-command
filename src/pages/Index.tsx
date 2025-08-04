import TimeTracking from '@/components/TimeTracking';

const Index = () => {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Clean Crew Command</h1>
          <p className="text-muted-foreground">Janitorial Services Management System</p>
        </div>
        <TimeTracking />
      </div>
    </div>
  );
};

export default Index;
