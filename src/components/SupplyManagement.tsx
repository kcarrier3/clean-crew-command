import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Package } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import SupplyItemsTab from './supply/SupplyItemsTab';
import SupplyStockTab from './supply/SupplyStockTab';
import SupplyMovementsTab from './supply/SupplyMovementsTab';
import SupplyRequestsTab from './supply/SupplyRequestsTab';
import SupplyLocationsTab from './supply/SupplyLocationsTab';
import FixedAssetsTab from './supply/FixedAssetsTab';

const SupplyManagement = () => {
  const { isManager } = useAuth();
  const canManage = isManager();

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
              Track inventory across the warehouse, trucks, and customer accounts.
            </p>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="stock" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="stock">Stock</TabsTrigger>
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="assets">Fixed Assets</TabsTrigger>
          <TabsTrigger value="movements">Movements</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          {canManage && <TabsTrigger value="locations">Locations</TabsTrigger>}
        </TabsList>
        <TabsContent value="stock"><SupplyStockTab /></TabsContent>
        <TabsContent value="items"><SupplyItemsTab canManage={canManage} /></TabsContent>
        <TabsContent value="assets"><FixedAssetsTab canManage={canManage} /></TabsContent>
        <TabsContent value="movements"><SupplyMovementsTab canManage={canManage} /></TabsContent>
        <TabsContent value="requests"><SupplyRequestsTab canManage={canManage} /></TabsContent>
        {canManage && <TabsContent value="locations"><SupplyLocationsTab /></TabsContent>}
      </Tabs>
    </div>
  );
};

export default SupplyManagement;