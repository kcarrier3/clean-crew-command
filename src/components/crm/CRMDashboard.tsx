import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Briefcase, DollarSign, Bell, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PipelineBoard } from './PipelineBoard';
import { LeadsList } from './LeadsList';
import { DealDialog } from './DealDialog';
import { ActivitiesFeed } from './ActivitiesFeed';
import { CompaniesList } from './CompaniesList';
import { ContactsList } from './ContactsList';
import { TasksList } from './TasksList';
import type { CrmDeal, CrmLead, CrmStage } from './types';

export default function CRMDashboard() {
  const { toast } = useToast();
  const [stages, setStages] = useState<CrmStage[]>([]);
  const [deals, setDeals] = useState<CrmDeal[]>([]);
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [openActsCount, setOpenActsCount] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<CrmDeal | null>(null);
  const [tab, setTab] = useState('pipeline');

  const loadAll = async () => {
    const [{ data: s }, { data: d }, { data: l }, { count }] = await Promise.all([
      (supabase as any).from('crm_pipeline_stages').select('*').eq('active', true).order('sort_order'),
      (supabase as any).from('crm_deals').select('*').order('updated_at', { ascending: false }),
      (supabase as any).from('crm_leads').select('*').order('created_at', { ascending: false }),
      (supabase as any).from('crm_activities').select('id', { count: 'exact', head: true }).is('completed_at', null),
    ]);
    if (s) setStages(s); else toast({ title: 'Failed to load stages', variant: 'destructive' });
    setDeals(d || []);
    setLeads(l || []);
    setOpenActsCount(count || 0);
  };

  useEffect(() => { loadAll(); }, []);

  const openDealsValue = deals
    .filter(d => {
      const st = stages.find(s => s.id === d.stage_id);
      return st && !st.is_won && !st.is_lost;
    })
    .reduce((s, d) => s + (Number(d.value) || 0), 0);

  const wonThisMonth = deals.filter(d => {
    if (!d.won_at) return false;
    const w = new Date(d.won_at);
    const now = new Date();
    return w.getMonth() === now.getMonth() && w.getFullYear() === now.getFullYear();
  });

  const newLeads = leads.filter(l => l.status === 'new').length;

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs"><Briefcase className="h-4 w-4" /> Open Deals</div>
          <p className="text-2xl font-bold mt-1">{deals.filter(d => {
            const st = stages.find(s => s.id === d.stage_id); return st && !st.is_won && !st.is_lost;
          }).length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs"><DollarSign className="h-4 w-4" /> Pipeline Value</div>
          <p className="text-2xl font-bold mt-1">${openDealsValue.toLocaleString()}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs"><Users className="h-4 w-4" /> New Leads</div>
          <p className="text-2xl font-bold mt-1">{newLeads}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs"><Bell className="h-4 w-4" /> Open Follow-ups</div>
          <p className="text-2xl font-bold mt-1">{openActsCount}</p>
        </CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="companies">Companies</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="activities">Follow-ups</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="mt-4">
          <PipelineBoard
            stages={stages}
            deals={deals}
            onChanged={loadAll}
            onDealClick={d => { setEditingDeal(d); setDialogOpen(true); }}
            onNewDeal={() => { setEditingDeal(null); setDialogOpen(true); }}
          />
        </TabsContent>

        <TabsContent value="leads" className="mt-4">
          <LeadsList stages={stages} onChanged={loadAll} />
        </TabsContent>

        <TabsContent value="companies" className="mt-4">
          <CompaniesList onChanged={loadAll} />
        </TabsContent>

        <TabsContent value="contacts" className="mt-4">
          <ContactsList onChanged={loadAll} />
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          <TasksList onChanged={loadAll} />
        </TabsContent>

        <TabsContent value="activities" className="mt-4">
          <ActivitiesFeed
            deals={deals}
            onOpenDeal={d => { setEditingDeal(d); setDialogOpen(true); setTab('pipeline'); }}
            reloadKey={openActsCount}
          />
        </TabsContent>
      </Tabs>

      <DealDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        deal={editingDeal}
        stages={stages}
        leads={leads}
        onChanged={loadAll}
      />

      <p className="text-sm text-center mt-8">
        Won the deal? Head to the <strong>Accounts</strong> tab to create the Job Site.
      </p>
    </div>
  );
}