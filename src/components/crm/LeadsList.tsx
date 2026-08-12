import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Plus, Mail, Phone, Clock, Merge } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { LeadDialog } from './LeadDialog';
import { MergeDialog } from './MergeDialog';
import { ClosedLostDialog } from './ClosedLostDialog';
import { mergeOpportunities } from './mergeUtils';
import { LEAD_STATUS_LABELS, PIPELINE_SHORT_LABELS, type CrmLead, type CrmStage, type CrmPipeline, type LostDetails } from './types';

const STATUS_COLORS: Record<CrmLead['status'], string> = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  qualified: 'bg-green-100 text-green-800',
  unqualified: 'bg-gray-200 text-gray-700',
  converted: 'bg-purple-100 text-purple-800',
};

interface Props {
  stages: CrmStage[];
  onChanged: () => void;
}

export function LeadsList({ stages, onChanged }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState<CrmLead | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [view, setView] = useState<'active' | 'aged' | 'lost'>('active');
  const [pipeline, setPipeline] = useState<'all' | CrmPipeline>('all');
  const [ageDays, setAgeDays] = useState('365');
  const [selected, setSelected] = useState<string[]>([]);
  const [closing, setClosing] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [lostOpen, setLostOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('crm_leads')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) toast({ title: 'Failed to load opportunities', description: error.message, variant: 'destructive' });
    setLeads(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { setSelected([]); }, [view, ageDays]);

  const convertToDeal = async (lead: CrmLead) => {
    const firstStage = stages.find(s => !s.is_won && !s.is_lost) || stages[0];
    if (!firstStage) {
      toast({ title: 'No pipeline stages configured', variant: 'destructive' });
      return;
    }
    const { error } = await (supabase as any).from('crm_deals').insert({
      name: `${lead.company_name} opportunity`,
      lead_id: lead.id,
      stage_id: firstStage.id,
      owner_id: user?.id,
      created_by: user?.id,
    });
    if (error) {
      toast({ title: 'Failed to create deal', description: error.message, variant: 'destructive' });
      return;
    }
    await (supabase as any).from('crm_leads').update({ status: 'converted' }).eq('id', lead.id);
    toast({ title: 'Deal created from opportunity' });
    load();
    onChanged();
  };

  const lostStageIds = new Set(stages.filter(s => s.is_lost).map(s => s.id));
  const isLost = (l: CrmLead) =>
    l.status === 'unqualified' || (l.stage_id ? lostStageIds.has(l.stage_id) : false);

  const daysSince = (iso: string) =>
    Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  // Imported records all share the import timestamp, so prefer the original
  // Salesforce activity dates when they exist.
  const lastActivity = (l: CrmLead) =>
    l.sf_last_modified_date || l.sf_created_date || l.updated_at || l.created_at;
  const isAged = (l: CrmLead) => !isLost(l) && daysSince(lastActivity(l)) >= Number(ageDays);

  const inPipeline = (l: CrmLead) =>
    pipeline === 'all' || (l.pipeline || 'project') === pipeline;

  const scoped = leads.filter(inPipeline);
  const lostCount = scoped.filter(isLost).length;
  const activeCount = scoped.length - lostCount;
  const agedCount = scoped.filter(isAged).length;

  const filtered = scoped
    .filter(l => (view === 'lost' ? isLost(l) : view === 'aged' ? isAged(l) : !isLost(l)))
    .sort((a, b) =>
      view === 'aged'
        ? new Date(lastActivity(a)).getTime() - new Date(lastActivity(b)).getTime()
        : 0
    )
    .filter(l =>
      !filter ||
      l.company_name.toLowerCase().includes(filter.toLowerCase()) ||
      l.contact_name?.toLowerCase().includes(filter.toLowerCase()) ||
      l.email?.toLowerCase().includes(filter.toLowerCase())
    );

  const closeOutSelected = async (details: LostDetails) => {
    if (!selected.length) return;
    setClosing(true);
    const lostStage = stages.find(s => s.is_lost);
    const { error } = await (supabase as any)
      .from('crm_leads')
      .update({ status: 'unqualified', ...details, ...(lostStage ? { stage_id: lostStage.id } : {}) })
      .in('id', selected);
    setClosing(false);
    if (error) {
      toast({ title: 'Failed to close opportunities', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: `Closed ${selected.length} opportunit${selected.length === 1 ? 'y' : 'ies'} as lost` });
    setLostOpen(false);
    setSelected([]);
    load();
    onChanged();
  };

  const runMerge = async (winnerId: string) => {
    try {
      await mergeOpportunities(winnerId, selected);
      toast({ title: `Merged ${selected.length - 1} opportunit${selected.length === 2 ? 'y' : 'ies'}` });
      setSelected([]);
      load();
      onChanged();
    } catch (e: any) {
      toast({ title: 'Merge failed', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={v => v && setView(v as 'active' | 'aged' | 'lost')}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="active">Active ({activeCount})</ToggleGroupItem>
            <ToggleGroupItem value="aged">Aged ({agedCount})</ToggleGroupItem>
            <ToggleGroupItem value="lost">Lost ({lostCount})</ToggleGroupItem>
          </ToggleGroup>
          {view === 'aged' && (
            <Select value={ageDays} onValueChange={setAgeDays}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="30">No activity 30+ days</SelectItem>
                <SelectItem value="60">No activity 60+ days</SelectItem>
                <SelectItem value="90">No activity 90+ days</SelectItem>
                <SelectItem value="180">No activity 6+ months</SelectItem>
                <SelectItem value="365">No activity 1+ year</SelectItem>
                <SelectItem value="730">No activity 2+ years</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Input
            placeholder="Search opportunities…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="max-w-xs"
          />
        </div>
        <div className="flex gap-2">
          {selected.length > 1 && (
            <Button variant="outline" onClick={() => setMergeOpen(true)}>
              <Merge className="h-4 w-4 mr-2" /> Merge {selected.length}
            </Button>
          )}
          {selected.length > 0 && <Button variant="ghost" onClick={() => setSelected([])}>Clear</Button>}
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> New Opportunity
          </Button>
        </div>
      </div>

      {view === 'aged' && filtered.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/40 px-3 py-2">
          <Checkbox
            checked={selected.length === filtered.length && filtered.length > 0}
            onCheckedChange={c => setSelected(c ? filtered.map(l => l.id) : [])}
          />
          <span className="text-sm text-muted-foreground">
            {selected.length ? `${selected.length} selected` : 'Select all'}
          </span>
          <Button
            size="sm"
            variant="destructive"
            disabled={!selected.length || closing}
            onClick={() => setLostOpen(true)}
          >
            {closing ? 'Closing…' : 'Close out as Lost'}
          </Button>
        </div>
      )}

      <ClosedLostDialog
        open={lostOpen}
        onOpenChange={setLostOpen}
        count={selected.length}
        saving={closing}
        onConfirm={closeOutSelected}
      />

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          {view === 'lost'
            ? 'No lost opportunities.'
            : view === 'aged'
            ? 'No opportunities match this age filter.'
            : 'No active opportunities. Add your first opportunity to get started.'}
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(lead => (
            <Card
              key={lead.id}
              className="hover:shadow-md hover:border-primary/40 transition cursor-pointer"
              onClick={() => navigate(`/crm/opportunities/${lead.id}`)}
            >
              <CardContent className="p-4 flex flex-wrap items-center gap-3 justify-between">
                <div onClick={e => e.stopPropagation()} className="flex items-center">
                  <Checkbox
                    checked={selected.includes(lead.id)}
                    onCheckedChange={c =>
                      setSelected(s => (c ? [...s, lead.id] : s.filter(id => id !== lead.id)))
                    }
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium">{lead.name || `${lead.company_name} opportunity`}</p>
                    <Badge className={STATUS_COLORS[lead.status] + ' text-xs'}>{LEAD_STATUS_LABELS[lead.status]}</Badge>
                    {lead.source && <Badge variant="outline" className="text-xs">{lead.source}</Badge>}
                    {view === 'aged' && (
                      <Badge variant="outline" className="text-xs flex items-center gap-1">
                        <Clock className="h-3 w-3" />{daysSince(lastActivity(lead))} days idle
                      </Badge>
                    )}
                  </div>
                  {lead.contact_name && <p className="text-sm text-muted-foreground">{lead.contact_name}</p>}
                  <div className="flex gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                    {lead.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{lead.email}</span>}
                    {lead.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{lead.phone}</span>}
                  </div>
                </div>
                <div className="flex gap-2 items-center text-xs text-muted-foreground">
                  {lead.status === 'converted'
                    ? <Badge variant="outline" className="text-xs">Awarded → Deal</Badge>
                    : <span>Deal created when awarded</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <LeadDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        lead={editing}
        onSaved={() => { load(); onChanged(); }}
      />

      <MergeDialog
        open={mergeOpen}
        onOpenChange={setMergeOpen}
        title="Merge opportunities"
        description="Choose the opportunity to keep. Notes, files, tasks, activities and estimates from the others move to it."
        candidates={selected.map(id => {
          const l = leads.find(x => x.id === id);
          return {
            id,
            label: l?.name || `${l?.company_name || ''} opportunity`,
            sub: [l?.company_name, l?.created_at ? new Date(l.created_at).toLocaleDateString() : null].filter(Boolean).join(' • '),
          };
        })}
        onConfirm={runMerge}
      />
    </div>
  );
}