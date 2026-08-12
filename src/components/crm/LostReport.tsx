import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';
import { Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from './fetchAllRows';
import type { CrmLead, CrmStage } from './types';

const WINDOWS = [30, 60, 90, 120, 180, 365];

export function LostReport() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [stages, setStages] = useState<CrmStage[]>([]);
  const [days, setDays] = useState('90');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [rows, s] = await Promise.all([
        fetchAllRows('crm_leads', '*'),
        (supabase as any).from('crm_pipeline_stages').select('*').order('sort_order'),
      ]);
      setLeads((rows as CrmLead[]) || []);
      setStages(s.data || []);
      setLoading(false);
    })();
  }, []);

  const lostStageIds = useMemo(
    () => new Set(stages.filter(s => s.is_lost).map(s => s.id)),
    [stages]
  );

  const lostLeads = useMemo(
    () => leads.filter(l => l.status === 'unqualified' || (l.stage_id ? lostStageIds.has(l.stage_id) : false)),
    [leads, lostStageIds]
  );

  const lostDate = (l: CrmLead) => new Date(l.lost_at || l.updated_at || l.created_at);
  const withinDays = (l: CrmLead, n: number) =>
    (Date.now() - lostDate(l).getTime()) / 86400000 <= n;

  const inWindow = useMemo(
    () => lostLeads.filter(l => withinDays(l, Number(days))).sort((a, b) => lostDate(b).getTime() - lostDate(a).getTime()),
    [lostLeads, days]
  );

  const windowTotals = useMemo(
    () => WINDOWS.map(n => {
      const rows = lostLeads.filter(l => withinDays(l, n));
      return {
        name: `${n}d`,
        count: rows.length,
        value: rows.reduce((s, l) => s + Number(l.amount || 0), 0),
      };
    }),
    [lostLeads]
  );

  const byReason = useMemo(() => {
    const m: Record<string, { name: string; count: number; value: number }> = {};
    inWindow.forEach(l => {
      const k = l.lost_reason || 'Not logged';
      m[k] = m[k] || { name: k, count: 0, value: 0 };
      m[k].count += 1;
      m[k].value += Number(l.amount || 0);
    });
    return Object.values(m).sort((a, b) => b.count - a.count);
  }, [inWindow]);

  const totalValue = inWindow.reduce((s, l) => s + Number(l.amount || 0), 0);
  const missingReason = inWindow.filter(l => !l.lost_reason).length;

  const exportCsv = () => {
    const header = ['Opportunity', 'Account', 'Amount', 'Reason', 'Competitor', 'Details', 'Date lost'];
    const rows = inWindow.map(l => [
      l.name || '',
      l.company_name || '',
      l.amount != null ? String(l.amount) : '',
      l.lost_reason || '',
      l.lost_competitor || '',
      (l.lost_notes || '').replace(/\s+/g, ' '),
      lostDate(l).toISOString().slice(0, 10),
    ]);
    const csv = [header, ...rows]
      .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `lost-opportunities-${days}-days.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-sm">Lost Opportunities</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup type="single" size="sm" variant="outline" value={days} onValueChange={v => v && setDays(v)}>
            {WINDOWS.map(n => <ToggleGroupItem key={n} value={String(n)}>{n}d</ToggleGroupItem>)}
          </ToggleGroup>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={!inWindow.length}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label={`Lost in last ${days} days`} value={String(inWindow.length)} />
              <Stat label="Value lost" value={`$${totalValue.toLocaleString()}`} />
              <Stat label="Lost all time" value={String(lostLeads.length)} />
              <Stat label="Missing a reason" value={String(missingReason)} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-2">Lost by time window</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={windowTotals}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" fontSize={11} />
                    <YAxis fontSize={11} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#dc2626" name="Opportunities lost" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-2">Reasons ({days} days)</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={byReason} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" fontSize={11} allowDecimals={false} />
                    <YAxis dataKey="name" type="category" fontSize={11} width={140} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#ca8a04" name="Opportunities" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="space-y-2">
              {inWindow.length === 0 ? (
                <p className="text-sm text-muted-foreground">No opportunities lost in this window.</p>
              ) : inWindow.slice(0, 100).map(l => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => navigate(`/crm/opportunities/${l.id}`)}
                  className="w-full text-left rounded border p-3 hover:border-primary/40 hover:shadow-sm transition"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{l.name || l.company_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{l.company_name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={l.lost_reason ? 'secondary' : 'destructive'}>
                        {l.lost_reason || 'No reason logged'}
                      </Badge>
                      <span className="text-sm font-semibold">
                        {l.amount != null ? `$${Number(l.amount).toLocaleString()}` : '—'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {lostDate(l).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  {l.lost_competitor && (
                    <p className="text-xs text-muted-foreground mt-1">Lost to {l.lost_competitor}</p>
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
    </div>
  );
}