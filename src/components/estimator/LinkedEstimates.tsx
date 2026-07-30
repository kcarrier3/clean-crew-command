import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calculator, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_INPUTS, calculateEstimate, money } from './calc';

interface Props {
  leadId: string;
  companyName?: string | null;
  companyId?: string | null;
  contactId?: string | null;
}

/**
 * Compact estimates panel for an opportunity. Renders only when estimates
 * exist, or as a single "Create Estimate" action for estimator users.
 */
export function LinkedEstimates({ leadId, companyName, companyId, contactId }: Props) {
  const navigate = useNavigate();
  const { user, canEstimate } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await (supabase as any)
      .from('estimates')
      .select('id,name,status,current_revision_id,updated_at')
      .eq('lead_id', leadId)
      .order('updated_at', { ascending: false });
    const list = data || [];
    setRows(list);
    const revIds = list.map((r: any) => r.current_revision_id).filter(Boolean);
    if (revIds.length) {
      const { data: revs } = await (supabase as any)
        .from('estimate_revisions').select('id,monthly_price').in('id', revIds);
      const map: Record<string, number> = {};
      (revs || []).forEach((r: any) => { map[r.id] = Number(r.monthly_price) || 0; });
      setPrices(map);
    }
  }, [leadId]);

  useEffect(() => { if (leadId) load(); }, [leadId, load]);

  const create = async () => {
    if (!user) return;
    setBusy(true);
    const { data: est, error } = await (supabase as any).from('estimates').insert({
      name: `${companyName || 'New'} estimate`,
      lead_id: leadId,
      company_id: companyId ?? null,
      contact_id: contactId ?? null,
      status: 'draft',
      created_by: user.id,
      owner_id: user.id,
    }).select().single();
    if (error || !est) {
      setBusy(false);
      toast({ title: 'Could not create estimate', description: error?.message, variant: 'destructive' });
      return;
    }
    const o = calculateEstimate(DEFAULT_INPUTS);
    const { data: rev } = await (supabase as any).from('estimate_revisions').insert({
      estimate_id: est.id,
      revision_number: 1,
      status: 'draft',
      created_by: user.id,
      ...DEFAULT_INPUTS,
      labor_hours_per_visit: o.labor_hours_per_visit,
      monthly_labor_hours: o.monthly_labor_hours,
      loaded_labor_rate: o.loaded_labor_rate,
      monthly_labor_cost: o.monthly_labor_cost,
      monthly_supply_cost: o.monthly_supply_cost,
      total_direct_cost: o.total_direct_cost,
      overhead_amount: o.overhead_amount,
      price_per_visit: o.price_per_visit,
      monthly_price: o.monthly_price,
      annual_price: o.annual_price,
      price_per_sqft: o.price_per_sqft,
      gross_margin_percent: o.gross_margin_percent,
      markup_percent: o.markup_on_direct_percent,
    }).select().single();
    if (rev) await (supabase as any).from('estimates').update({ current_revision_id: rev.id }).eq('id', est.id);
    setBusy(false);
    navigate(`/estimating/${est.id}`);
  };

  if (!canEstimate()) return null;
  if (rows.length === 0) {
    return (
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={create} disabled={busy}>
          <Calculator className="h-4 w-4 mr-2" /> Create Estimate
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm flex items-center gap-2">
          <Calculator className="h-4 w-4" /> Estimates ({rows.length})
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={create} disabled={busy}>
          <Plus className="h-4 w-4 mr-1" /> New
        </Button>
      </CardHeader>
      <CardContent className="pt-0 space-y-1">
        {rows.map(r => (
          <button
            key={r.id}
            type="button"
            onClick={() => navigate(`/estimating/${r.id}`)}
            className="w-full flex items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-muted/60 transition-colors"
          >
            <span className="flex-1 truncate text-sm">{r.name}</span>
            <span className="text-sm font-medium tabular-nums">
              {r.current_revision_id ? `${money(prices[r.current_revision_id] || 0)}/mo` : '—'}
            </span>
            <Badge variant={r.status === 'completed' ? 'default' : 'outline'} className="text-[10px]">
              {r.status === 'completed' ? 'Completed' : 'Draft'}
            </Badge>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

export default LinkedEstimates;
