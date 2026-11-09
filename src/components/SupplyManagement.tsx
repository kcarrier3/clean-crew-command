import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Package } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { getSupplyAccess } from '@/lib/supplyPermissions';
import SupplyItemsTab from './supply/SupplyItemsTab';
import SupplyStockTab from './supply/SupplyStockTab';
import SupplyMovementsTab from './supply/SupplyMovementsTab';
import SupplyRequestsTab from './supply/SupplyRequestsTab';
import SupplyLocationsTab from './supply/SupplyLocationsTab';
import FixedAssetsTab from './supply/FixedAssetsTab';
import SupplyCostReport from './supply/SupplyCostReport';
import SupplyBillingReport from './supply/SupplyBillingReport';
import SupplyBillingWeekly from './supply/SupplyBillingWeekly';
import { useState } from 'react';
import { SectionNavigation } from './layout/SectionNavigation';

const SupplyManagement = () => {
  const [tab, setTab] = useState('stock');
  const { isManager, profile, hasPermission, canViewSov } = useAuth();
  // Weekly supply billing: explicit permission, or full billing access (Owner / Office / Operations Manager).
  const canApproveSupplyBilling = hasPermission('approve_supply_billing') || canViewSov();
  const { canManage, canViewReports, canPrice } = getSupplyAccess(isManager(), profile?.job_title);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold md:hidden">Supplies</h2>
      <Card className="hidden md:block">
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

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <SectionNavigation label="Supplies" value={tab} onValueChange={setTab} options={[
          { value: 'stock', label: 'Stock' }, { value: 'items', label: 'Items' },
          { value: 'assets', label: 'Fixed Assets' }, { value: 'requests', label: 'Requests' },
          ...(canViewReports ? [{ value: 'cost-report', label: 'Cost Report' }, { value: 'billing-report', label: 'Billing Report' }] : []),
          ...(canApproveSupplyBilling ? [{ value: 'weekly-billing', label: 'Supply Billing' }] : []),
          ...(canManage ? [{ value: 'locations', label: 'Locations' }] : []),
        ]}>
        <TabsList className="grid w-full grid-cols-2 h-auto gap-1 md:inline-grid md:grid-flow-col md:w-auto">
          <TabsTrigger value="stock">Stock</TabsTrigger>
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="assets">Fixed Assets</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          {canViewReports && <TabsTrigger value="cost-report">Cost Report</TabsTrigger>}
          {canViewReports && <TabsTrigger value="billing-report">Billing Report</TabsTrigger>}
          {canApproveSupplyBilling && <TabsTrigger value="weekly-billing">Supply Billing</TabsTrigger>}
          {canManage && <TabsTrigger value="locations">Locations</TabsTrigger>}
        </TabsList>
        </SectionNavigation>
        <TabsContent value="stock" className="space-y-6">
          <SupplyStockTab />
          <SupplyMovementsTab canManage={canManage} />
        </TabsContent>
        <TabsContent value="items"><SupplyItemsTab canManage={canManage} canPrice={canPrice} /></TabsContent>
        <TabsContent value="assets"><FixedAssetsTab canManage={canManage} /></TabsContent>
        <TabsContent value="requests"><SupplyRequestsTab canManage={canManage} /></TabsContent>
        {canViewReports && <TabsContent value="cost-report"><SupplyCostReport /></TabsContent>}
        {canViewReports && <TabsContent value="billing-report"><SupplyBillingReport /></TabsContent>}
        {canApproveSupplyBilling && <TabsContent value="weekly-billing"><SupplyBillingWeekly /></TabsContent>}
        {canManage && <TabsContent value="locations"><SupplyLocationsTab /></TabsContent>}
      </Tabs>
    </div>
  );
};

export default SupplyManagement;