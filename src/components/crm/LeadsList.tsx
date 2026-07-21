import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Plus, Mail, Phone, ArrowRight } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { LeadDialog } from './LeadDialog';
import { LEAD_STATUS_LABELS, type CrmLead, type CrmStage } from './types';

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
  const { toast } = useToast();
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState<CrmLead | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [view, setView] = useState<'active' | 'lost'>('active');

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

  const lostCount = leads.filter(isLost).length;
  const activeCount = leads.length - lostCount;

  const filtered = leads
    .filter(l => (view === 'lost' ? isLost(l) : !isLost(l)))
    .filter(l =>
      !filter ||
      l.company_name.toLowerCase().includes(filter.toLowerCase()) ||
      l.contact_name?.toLowerCase().includes(filter.toLowerCase()) ||
      l.email?.toLowerCase().includes(filter.toLowerCase())
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={v => v && setView(v as 'active' | 'lost')}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="active">Active ({activeCount})</ToggleGroupItem>
            <ToggleGroupItem value="lost">Lost ({lostCount})</ToggleGroupItem>
          </ToggleGroup>
          <Input
            placeholder="Search opportunities…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="max-w-xs"
          />
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> New Opportunity
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          {view === 'lost'
            ? 'No lost opportunities.'
            : 'No active opportunities. Add your first opportunity to get started.'}
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(lead => (
            <Card
              key={lead.id}
              className="hover:shadow-md hover:border-primary/40 transition cursor-pointer"
              onClick={() => { setEditing(lead); setDialogOpen(true); }}
            >
              <CardContent className="p-4 flex flex-wrap items-center gap-3 justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium">{lead.company_name}</p>
                    <Badge className={STATUS_COLORS[lead.status] + ' text-xs'}>{LEAD_STATUS_LABELS[lead.status]}</Badge>
                    {lead.source && <Badge variant="outline" className="text-xs">{lead.source}</Badge>}
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
    </div>
  );
}