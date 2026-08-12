import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Briefcase, DollarSign, Bell, Users, Clock, Mail, Phone, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { PipelineBoard } from './PipelineBoard';
import { LeadsList } from './LeadsList';
import { DealDialog } from './DealDialog';
import { ActivitiesFeed } from './ActivitiesFeed';
import { CompaniesList } from './CompaniesList';
import { ContactsList } from './ContactsList';
import { TasksList } from './TasksList';
import { CRMReports } from './CRMReports';
import { LostReport } from './LostReport';
import { LEAD_STATUS_LABELS, type CrmDeal, type CrmLead, type CrmStage } from './types';

const STATUS_COLORS: Record<CrmLead['status'], string> = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  qualified: 'bg-green-100 text-green-800',
  unqualified: 'bg-gray-200 text-gray-700',
  converted: 'bg-purple-100 text-purple-800',
};

export default function CRMDashboard() {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stages, setStages] = useState<CrmStage[]>([]);
  const [deals, setDeals] = useState<CrmDeal[]>([]);
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [openActsCount, setOpenActsCount] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<CrmDeal | null>(null);
  const [tab, setTab] = useState('recent');
  const [recent, setRecent] = useState<Array<{ lead: CrmLead; lastAt: number }>>([]);
  const [recentLoading, setRecentLoading] = useState(true);

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

  const loadRecent = async () => {
    if (!user) {
      setRecentLoading(false);
      return;
    }
    setRecentLoading(true);
    const userId = user.id;

    const [{ data: owned }, { data: acts }, { data: tasks }, { data: dealRows }] = await Promise.all([
      (supabase as any).from('crm_leads').select('*').or(`assigned_to.eq.${userId},created_by.eq.${userId}`),
      (supabase as any).from('crm_activities')
        .select('lead_id, created_at, completed_at, updated_at')
        .or(`owner_id.eq.${userId},created_by.eq.${userId}`)
        .not('lead_id', 'is', null),
      (supabase as any).from('crm_tasks')
        .select('lead_id, created_at, completed_at, updated_at')
        .or(`assigned_to.eq.${userId},created_by.eq.${userId}`)
        .not('lead_id', 'is', null),
      (supabase as any).from('crm_deals')
        .select('lead_id, created_at, updated_at, won_at')
        .or(`owner_id.eq.${userId},created_by.eq.${userId}`)
        .not('lead_id', 'is', null),
    ]);

    const lastInteraction = new Map<string, number>();
    const track = (leadId: string | null, ts: string | null) => {
      if (!leadId || !ts) return;
      const t = new Date(ts).getTime();
      const current = lastInteraction.get(leadId);
      if (!current || t > current) lastInteraction.set(leadId, t);
    };

    owned?.forEach((l: CrmLead) => track(l.id, l.updated_at || l.created_at));
    acts?.forEach((a: any) => track(a.lead_id, a.completed_at || a.updated_at || a.created_at));
    tasks?.forEach((t: any) => track(t.lead_id, t.completed_at || t.updated_at || t.created_at));
    dealRows?.forEach((d: any) => track(d.lead_id, d.won_at || d.updated_at || d.created_at));

    const ids = Array.from(lastInteraction.keys());
    if (ids.length === 0) {
      setRecent([]);
      setRecentLoading(false);
      return;
    }

    const { data: leadRows } = await (supabase as any).from('crm_leads').select('*').in('id', ids);
    const merged = (leadRows || [])
      .map((l: CrmLead) => ({ lead: l, lastAt: lastInteraction.get(l.id) || new Date(l.updated_at || l.created_at).getTime() }))
      .sort((a: any, b: any) => b.lastAt - a.lastAt)
      .slice(0, 15);
    setRecent(merged);
    setRecentLoading(false);
  };

  useEffect(() => { loadAll(); loadRecent(); }, [user]);

  // Pipeline value = open opportunities' amounts + open deals not tied to an opportunity
  const isOpenStage = (stageId?: string | null) => {
    const st = stages.find(s => s.id === stageId);
    return !!st && !st.is_won && !st.is_lost;
  };

  const openLeads = leads.filter(
    l => l.status !== 'unqualified' && (l.stage_id ? isOpenStage(l.stage_id) : true)
  );
  const openLeadIds = new Set(openLeads.map(l => l.id));

  const openLeadsValue = openLeads.reduce((s, l) => s + (Number(l.amount) || 0), 0);

  const openDeals = deals.filter(d => isOpenStage(d.stage_id));
  const standaloneDealsValue = openDeals
    .filter(d => !d.lead_id || !openLeadIds.has(d.lead_id))
    .reduce((s, d) => s + (Number(d.value) || 0), 0);

  const openDealsValue = openLeadsValue + standaloneDealsValue;
  const openPipelineCount = openLeads.length + openDeals.filter(d => !d.lead_id || !openLeadIds.has(d.lead_id)).length;

  const wonThisMonth = deals.filter(d => {
    if (!d.won_at) return false;
    const w = new Date(d.won_at);
    const now = new Date();
    return w.getMonth() === now.getMonth() && w.getFullYear() === now.getFullYear();
  });

  const newLeads = leads.filter(l => l.status === 'new').length;

  // "Needs attention": won/post-award opportunities that haven't moved in 30+ days
  const stageById = new Map(stages.map(s => [s.id, s]));
  const lastTouched = (l: CrmLead) => {
    const candidates = [l.updated_at, l.sf_last_modified_date, l.created_at]
      .filter(Boolean)
      .map(d => new Date(d as string).getTime())
      .filter(t => !Number.isNaN(t));
    return candidates.length ? Math.max(...candidates) : 0;
  };
  const THIRTY_DAYS = 30 * 86400000;
  const needsAttention = leads
    .filter(l => {
      const st = l.stage_id ? stageById.get(l.stage_id) : undefined;
      if (st?.is_lost) return false;
      const isWonOrPostAward =
        l.status === 'converted' || (!!st && !st.is_lost && st.sort_order >= 40 && !st.is_won);
      if (!isWonOrPostAward) return false;
      return Date.now() - lastTouched(l) > THIRTY_DAYS;
    })
    .map(l => ({ lead: l, lastAt: lastTouched(l) }))
    .sort((a, b) => a.lastAt - b.lastAt);

  const daysAgo = (ts: number) => Math.floor((Date.now() - ts) / 86400000);

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs"><Briefcase className="h-4 w-4" /> Open Deals</div>
          <p className="text-2xl font-bold mt-1">{openPipelineCount}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs"><DollarSign className="h-4 w-4" /> Pipeline Value</div>
          <p className="text-2xl font-bold mt-1">${openDealsValue.toLocaleString()}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs"><Users className="h-4 w-4" /> New Opportunities</div>
          <p className="text-2xl font-bold mt-1">{newLeads}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs"><Bell className="h-4 w-4" /> Open Follow-ups</div>
          <p className="text-2xl font-bold mt-1">{openActsCount}</p>
        </CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-2 h-auto gap-1 md:inline-grid md:grid-flow-col md:w-auto">
          <TabsTrigger value="recent">Recent</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="leads">Opportunities</TabsTrigger>
          <TabsTrigger value="companies">Accounts</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="activities">Follow-ups</TabsTrigger>
        </TabsList>

        <TabsContent value="recent" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-2">
          {recentLoading ? (
            <p className="text-muted-foreground text-sm">Loading recent opportunities…</p>
          ) : recent.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">
              No recent opportunities. Open or create an opportunity to see it here.
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {recent.map(({ lead, lastAt }) => (
                <Card
                  key={lead.id}
                  className="hover:shadow-md hover:border-primary/40 transition cursor-pointer"
                  onClick={() => navigate(`/crm/opportunities/${lead.id}`)}
                >
                  <CardContent className="p-4 flex flex-wrap items-center gap-3 justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{lead.name || `${lead.company_name} opportunity`}</p>
                        <Badge className={STATUS_COLORS[lead.status] + ' text-xs'}>{LEAD_STATUS_LABELS[lead.status]}</Badge>
                        {lead.source && <Badge variant="outline" className="text-xs">{lead.source}</Badge>}
                      </div>
                      {lead.company_name && <p className="text-sm text-muted-foreground">{lead.company_name}</p>}
                      <div className="flex gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                        {lead.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{lead.email}</span>}
                        {lead.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{lead.phone}</span>}
                      </div>
                    </div>
                    <div className="text-right min-w-[120px]">
                      <p className="text-sm font-medium">${(Number(lead.amount) || 0).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                        <Clock className="h-3 w-3" />
                        {(() => {
                          const diff = Date.now() - lastAt;
                          const mins = Math.floor(diff / 60000);
                          const hours = Math.floor(diff / 3600000);
                          const days = Math.floor(diff / 86400000);
                          if (mins < 1) return 'just now';
                          if (mins < 60) return `${mins}m ago`;
                          if (hours < 24) return `${hours}h ago`;
                          if (days < 30) return `${days}d ago`;
                          return new Date(lastAt).toLocaleDateString();
                        })()}
                      </p>
                      {lead.stage_id && (
                        <p className="text-xs text-muted-foreground">{stages.find(s => s.id === lead.stage_id)?.name}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <h3 className="font-semibold text-sm">Needs Attention</h3>
                <Badge variant="outline" className="text-xs">{needsAttention.length}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Won opportunities with no stage change in 30+ days.
              </p>
              {needsAttention.length === 0 ? (
                <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">
                  Nothing stalled. Nice work.
                </CardContent></Card>
              ) : (
                <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
                  {needsAttention.map(({ lead, lastAt }) => (
                    <Card
                      key={lead.id}
                      className="border-amber-300/70 hover:shadow-md transition cursor-pointer"
                      onClick={() => navigate(`/crm/opportunities/${lead.id}`)}
                    >
                      <CardContent className="p-3">
                        <p className="font-medium text-sm truncate">{lead.name || `${lead.company_name} opportunity`}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant="secondary" className="text-xs">
                            {(lead.stage_id && stageById.get(lead.stage_id)?.name) || LEAD_STATUS_LABELS[lead.status]}
                          </Badge>
                          <span className="text-xs text-amber-700">{daysAgo(lastAt)}d without update</span>
                        </div>
                        {Number(lead.amount) > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            ${(Number(lead.amount) || 0).toLocaleString()}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

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

        <TabsContent value="reports" className="mt-4">
          <div className="space-y-4">
            <CRMReports />
            <LostReport />
          </div>
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