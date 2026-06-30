import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, Bell, ListChecks, ClipboardList, Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const SupplyManagement = () => {
  const { toast } = useToast();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start gap-4">
          <div className="p-3 rounded-md bg-primary/10 text-primary">
            <Package className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-2xl">Supply Management</CardTitle>
            <p className="text-muted-foreground mt-1">
              Coming soon &mdash; a single place to track inventory, reorder
              points, and crew supply requests across every account.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <FeatureRow
              icon={<ListChecks className="h-5 w-5" />}
              title="Inventory tracking"
              desc="Items on hand by location with reorder points and low-stock alerts."
            />
            <FeatureRow
              icon={<ClipboardList className="h-5 w-5" />}
              title="Crew supply requests"
              desc="Workers request supplies from the app; managers approve and route to purchasing."
            />
            <FeatureRow
              icon={<Building2 className="h-5 w-5" />}
              title="Per-account allocation"
              desc="Assign supplies and budgets per job site so costs roll up cleanly."
            />
            <FeatureRow
              icon={<Bell className="h-5 w-5" />}
              title="Reorder alerts"
              desc="Automated notifications when stock drops below threshold."
            />
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() =>
                toast({
                  title: "Thanks!",
                  description: "We'll prioritize building Supply Management next.",
                })
              }
            >
              <Bell className="h-4 w-4 mr-2" />
              Notify me when ready
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const FeatureRow = ({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) => (
  <div className="flex items-start gap-3 rounded-lg border border-border p-4">
    <div className="text-primary mt-0.5">{icon}</div>
    <div>
      <div className="font-medium">{title}</div>
      <div className="text-sm text-muted-foreground">{desc}</div>
    </div>
  </div>
);

export default SupplyManagement;