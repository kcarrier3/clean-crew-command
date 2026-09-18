import { GraduationCap } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import TrainingAdmin from './TrainingAdmin';
import MyTraining from './MyTraining';

export const TrainingCenter = () => {
  const { user, isManager } = useAuth();
  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <GraduationCap className="h-5 w-5 text-primary" />
        <div>
          <h2 className="text-xl font-semibold">Training</h2>
          <p className="text-sm text-muted-foreground">Onboarding and ongoing training for your staff.</p>
        </div>
      </div>

      {isManager() ? (
        <Tabs defaultValue="manage" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:w-auto md:inline-grid md:grid-flow-col">
            <TabsTrigger value="manage">Manage training</TabsTrigger>
            <TabsTrigger value="mine">My training</TabsTrigger>
          </TabsList>
          <TabsContent value="manage" className="mt-6">
            <TrainingAdmin userId={user.id} />
          </TabsContent>
          <TabsContent value="mine" className="mt-6">
            <MyTraining userId={user.id} />
          </TabsContent>
        </Tabs>
      ) : (
        <MyTraining userId={user.id} />
      )}
    </div>
  );
};

export default TrainingCenter;
