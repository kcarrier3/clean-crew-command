import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Calculator, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { SEO } from '@/components/SEO';
import { EstimatorShell } from '@/components/estimator/EstimatorShell';
import { OpportunityPicker } from '@/components/estimator/OpportunityPicker';
import { DEFAULT_INPUTS, calculateEstimate, money } from '@/components/estimator/calc';
import type { CrmLead } from '@/components/crm/types';

interface EstimateRow {
  id: string;
  name: string;
  status: string;
  lead_id: string;
  updated_at: string;
  completed_at: string | null;
  current_revision_id: string | null;
}

export default function Estimating() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading, canEstimate } = useAuth();
  const [rows, setRows] = useState<EstimateRow[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [leadNames, setLeadNames] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<'draft' | 'completed'>('draft');
  const [search, setSearch] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [loading, user, navigate]);

  const load = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from('estimates')
      .select('id,name,status,lead_id,updated_at,completed_at,current_revision_id')
      .order('updated_at', { ascending: false });
    if (error) {
      toast({ title: 'Failed to load estimates', description: error.message, variant: 'destructive' });
      return;
    }
    const list: EstimateRow[] = data || [];
    setRows(list);

    const revIds = list.map(r => r.current_revision_id).filter(Boolean) as string[];
    if (revIds.length) {
      const { data: revs } = await (supabase as any)
        .from('estimate_revisions').select('id,monthly_price').in('id', revIds);
      const map: Record<string, number> = {};
      (revs || []).forEach((r: any) => { map[r.id] = Number(r.monthly_price) || 0; });
      setPrices(map);
    }

    const leadIds = Array.from(new Set(list.map(r => r.lead_id).filter(Boolean)));
    if (leadIds.length) {
      const { data: leads } = await (supabase as any)
        .from('crm_leads').select('id,company_name').in('id', leadIds);
      const map: Record<string, string> = {};
      (leads || []).forEach((l: any) => { map[l.id] = l.company_name; });
      setLeadNames(map);
    }
  }, [toast]);

  useEffect(() => { if (user) load(); }, [user, load]);

  const createForLead = async (lead: CrmLead) => {
    if (!user) return;
    setBusy(true);
    const { data: est, error } = await (supabase as any)
      .from('estimates')
      .insert({
        name: `${lead.company_name} estimate`,
        lead_id: lead.id,
        company_id: lead.company_id ?? null,
        contact_id: lead.primary_contact_id ?? null,
        status: 'draft',
        created_by: user.id,
        owner_id: user.id,
      })
      .select()
      .single();
    if (error || !est) {
      setBusy(false);
      toast({ title: 'Could not create estimate', description: error?.message, variant: 'destructive' });
      return;
    }
    const outputs = calculateEstimate(DEFAULT_INPUTS);
    const { data: rev, error: revErr } = await (supabase as any)
      .from('estimate_revisions')
      .insert({
        estimate_id: est.id,
        revision_number: 1,
        status: 'draft',
        created_by: user.id,
        ...DEFAULT_INPUTS,
        labor_hours_per_visit: outputs.labor_hours_per_visit,
        monthly_labor_hours: outputs.monthly_labor_hours,
        loaded_labor_rate: outputs.loaded_labor_rate,
        monthly_labor_cost: outputs.monthly_labor_cost,
        monthly_supply_cost: outputs.monthly_supply_cost,
        total_direct_cost: outputs.total_direct_cost,
        overhead_amount: outputs.overhead_amount,
        price_per_visit: outputs.price_per_visit,
        monthly_price: outputs.monthly_price,
        annual_price: outputs.annual_price,
        price_per_sqft: outputs.price_per_sqft,
        gross_margin_percent: outputs.gross_margin_percent,
        markup_percent: outputs.markup_on_direct_percent,
      })
      .select()
      .single();
    if (revErr) {
      setBusy(false);
      toast({ title: 'Could not create estimate', description: revErr.message, variant: 'destructive' });
      return;
    }
    await (supabase as any).from('estimates').update({ current_revision_id: rev.id }).eq('id', est.id);
    setBusy(false);
    navigate(`/estimating/${est.id}`);
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (r.status !== tab) return false;
      if (!q) return true;
      return r.name.toLowerCase().includes(q) || (leadNames[r.lead_id] || '').toLowerCase().includes(q);
    });
  }, [rows, tab, search, leadNames]);

  if (loading) return null;

  if (!canEstimate()) {
    return (
      <EstimatorShell title="Estimating">
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            You do not have access to Estimating.
          </CardContent>
        </Card>
      </EstimatorShell>
    );
  }

  return (
    <>
      <SEO
        title="Estimating — Crew Compass"
        description="Build janitorial cleaning estimates from square footage, production rate, labor burden and supply cost with clear overhead, margin and markup."
        path="/estimating"
      />
      <EstimatorShell
        title="Estimating"
        subtitle="Janitorial sales estimator"
        actions={
          <Button size="sm" onClick={() => setPickerOpen(true)} disabled={busy}>
            <Plus className="h-4 w-4 mr-1" /> New Estimate
          </Button>
        }
      >
        <div className="space-y-3">
          <Tabs value={tab} onValueChange={v => setTab(v as 'draft' | 'completed')}>
            <TabsList className="grid grid-cols-2 w-full max-w-md">
              <TabsTrigger value="draft">Draft Estimates</TabsTrigger>
              <TabsTrigger value="completed">Completed Estimates</TabsTrigger>
            </TabsList>
          </Tabs>

          <Input
            placeholder="Search estimates or opportunities…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

          {visible.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center space-y-3">
                <Calculator className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {tab === 'draft' ? 'No draft estimates yet.' : 'No completed estimates yet.'}
                </p>
                {tab === 'draft' && (
                  <Button onClick={() => setPickerOpen(true)} disabled={busy}>
                    <Plus className="h-4 w-4 mr-1" /> New Estimate
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {visible.map(r => (
                <Card
                  key={r.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(`/estimating/${r.id}`)}
                >
                  <CardContent className="py-3 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{r.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                        <Building2 className="h-3 w-3 shrink-0" />
                        {leadNames[r.lead_id] || 'Opportunity'}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold tabular-nums">
                        {r.current_revision_id ? `${money(prices[r.current_revision_id] || 0)}/mo` : '—'}
                      </div>
                      <Badge variant={r.status === 'completed' ? 'default' : 'outline'} className="mt-1 text-[10px]">
                        {r.status === 'completed' ? 'Completed' : 'Draft'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </EstimatorShell>

      <OpportunityPicker open={pickerOpen} onOpenChange={setPickerOpen} onSelect={createForLead} />
    </>
  );
}
