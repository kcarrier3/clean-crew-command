import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReadyToBillTab } from './ReadyToBillTab';
import { RecurringInvoicingTab } from './RecurringInvoicingTab';
import { InvoicesTab } from './InvoicesTab';
import { PaymentsTab } from './PaymentsTab';
import { EmailActivityTab } from './EmailActivityTab';
import { BillingPerformanceTab } from './BillingPerformanceTab';
import { BillingSettingsTab } from './BillingSettingsTab';

export const BillingDashboard = () => {
  const [tab, setTab] = useState('ready');
  const [focusInvoiceId, setFocusInvoiceId] = useState<string | null>(null);

  const openInvoice = (id: string) => { setFocusInvoiceId(id); setTab('invoices'); };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Billing</h2>
        <p className="text-sm text-muted-foreground">
          Completed work flows straight into the billing queue so nothing gets finished and forgotten.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-2 h-auto gap-1 md:inline-flex md:w-auto md:h-10">
          <TabsTrigger value="ready">Ready to Bill</TabsTrigger>
          <TabsTrigger value="recurring">Recurring Invoicing</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="email">Email Activity</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="ready" className="mt-4">
          <ReadyToBillTab onInvoiceCreated={openInvoice} />
        </TabsContent>
        <TabsContent value="recurring" className="mt-4">
          <RecurringInvoicingTab onOpenInvoice={openInvoice} />
        </TabsContent>
        <TabsContent value="invoices" className="mt-4">
          <InvoicesTab focusInvoiceId={focusInvoiceId} onFocusHandled={() => setFocusInvoiceId(null)} />
        </TabsContent>
        <TabsContent value="payments" className="mt-4"><PaymentsTab /></TabsContent>
        <TabsContent value="email" className="mt-4"><EmailActivityTab /></TabsContent>
        <TabsContent value="performance" className="mt-4"><BillingPerformanceTab /></TabsContent>
        <TabsContent value="settings" className="mt-4"><BillingSettingsTab /></TabsContent>
      </Tabs>
    </div>
  );
};

export default BillingDashboard;