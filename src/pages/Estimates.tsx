import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Calculator, Settings, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { SEO } from '@/components/SEO';
import { EstimatorShell } from '@/components/estimator/EstimatorShell';
import { ESTIMATE_STATUS_LABELS, money } from '@/components/estimator/calc';

interface EstimateRow {
  id: string;
  name: string;
  status: string;
  company_id: string | null;
  created_at: string;
  updated_at: string;
  current_revision_id: string | null;
}

const FILTERS = [
  { v: 'open', label: 'Open' },
  { v: 'pending_approval', label: 'Approval' },
  { v: 'approved', label: 'Approved' },
  { v: 'all', label: 'All' },
];

const statusVariant = (s: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (s === 'approved' || s === 'won') return 'default';
  if (s === 'rejected' || s === 'lost') return 'destructive';
  if (s === 'pending_approval') return 'secondary';
  return 'outline';
};

export default function Estimates() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading, canEstimate, canApproveEstimate } = useAuth();
  const [rows, setRows] = useState<EstimateRow[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [companies, setCompanies] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState('open');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [loading, user, navigate]);

  const load = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from('estimates')
      .select('id,name,status,company_id,created_at,updated_at,current_revision_id')
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
        .from('estimate_revisions')
        .select('id,monthly_price')
        .in('id', revIds);
      const map: Record<string, number> = {};
      (revs || []).forEach((r: any) => { map[r.id] = Number(r.monthly_price) || 0; });
      setPrices(map);
    }

    const companyIds = Array.from(new Set(list.map(r => r.company_id).filter(Boolean))) as string[];
    if (companyIds.length) {
      const { data: cos } = await (supabase as any)
        .from('crm_companies')
        .select('id,name')
        .in('id', companyIds);
      const map: Record<string, string> = {};
      (cos || []).forEach((c: any) => { map[c.id] = c.name; });
      setCompanies(map);
    }
  }, [toast]);

  useEffect(() => { if (user) load(); }, [user, load]);

  const createEstimate = async () => {
    if (!user) return;
    setBusy(true);
    const { data, error } = await (supabase as any)
      .from('estimates')
      .insert({ name: 'New estimate', created_by: user.id, owner_id: user.id, status: 'draft' })
      .select()
      .single();
    setBusy(false);
    if (error) {
      toast({ title: 'Could not create estimate', description: error.message, variant: 'destructive' });
      return;
    }
    navigate(`/estimates/${data.id}`);
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (filter === 'open' && ['approved', 'rejected', 'won', 'lost'].includes(r.status)) return false;
      if (filter === 'pending_approval' && r.status !== 'pending_approval') return false;
      if (filter === 'approved' && !['approved', 'won'].includes(r.status)) return false;
      if (!q) return true;
      const co = r.company_id ? (companies[r.company_id] || '') : '';
      return r.name.toLowerCase().includes(q) || co.toLowerCase().includes(q);
    });
  }, [rows, filter, search, companies]);

  if (loading) return null;

  if (!canEstimate()) {
    return (
      <EstimatorShell title="Sales Estimator">
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            You do not have access to the Sales Estimator.
          </CardContent>
        </Card>
      </EstimatorShell>
    );
  }

  return (
    <>
      <SEO
        title="Sales Estimator — Crew Compass"
        description="Build janitorial cleaning estimates from square footage, production rates, labor burden and supply cost, with clear margin and markup."
        path="/estimates"
      />
      <EstimatorShell
        title="Sales Estimator"
        subtitle="Janitorial bid pricing"
        actions={
          <>
            {canApproveEstimate() && (
              <Button variant="ghost" size="icon" aria-label="Estimator settings" onClick={() => navigate('/estimates/settings')}>
                <Settings className="h-5 w-5" />
              </Button>
            )}
            <Button size="sm" onClick={createEstimate} disabled={busy}>
              <Plus className="h-4 w-4 mr-1" /> New
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            placeholder="Search estimates or accounts…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <ToggleGroup
            type="single"
            value={filter}
            onValueChange={v => v && setFilter(v)}
            className="justify-start flex-wrap"
          >
            {FILTERS.map(f => (
              <ToggleGroupItem key={f.v} value={f.v} size="sm" className="text-xs">
                {f.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          {visible.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center space-y-3">
                <Calculator className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No estimates yet.</p>
                <Button onClick={createEstimate} disabled={busy}>
                  <Plus className="h-4 w-4 mr-1" /> Start an estimate
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {visible.map(r => (
                <Card
                  key={r.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(`/estimates/${r.id}`)}
                >
                  <CardContent className="py-3 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{r.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                        {r.company_id && companies[r.company_id] ? (
                          <>
                            <Building2 className="h-3 w-3 shrink-0" />
                            {companies[r.company_id]}
                          </>
                        ) : (
                          'No account linked'
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold tabular-nums">
                        {r.current_revision_id ? `${money(prices[r.current_revision_id] || 0)}/mo` : '—'}
                      </div>
                      <Badge variant={statusVariant(r.status)} className="mt-1 text-[10px]">
                        {ESTIMATE_STATUS_LABELS[r.status] || r.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </EstimatorShell>
    </>
  );
}