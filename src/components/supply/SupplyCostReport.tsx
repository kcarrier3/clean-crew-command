import { Fragment, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Package, Download, DollarSign } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';

type JobSite = { id: string; name: string };
type Movement = {
  id: string;
  job_site_id: string | null;
  quantity: number;
  unit_price: number | null;
  total_value: number | null;
  created_at: string;
  movement_type: string;
  item: { id: string; name: string; unit: string; unit_cost: number | null } | null;
};

type Row = {
  jobSite: JobSite;
  supplyCost: number;
  supplyRevenue: number;
  details: Array<{ name: string; qty: number; unit: string; unitCost: number; cost: number; revenue: number }>;
};

const fmtMoney = (n: number) => `$${n.toFixed(2)}`;

export default function SupplyCostReport() {
  const today = new Date();
  const [startDate, setStartDate] = useState(format(startOfMonth(today), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(today), 'yyyy-MM-dd'));
  const [jobSites, setJobSites] = useState<JobSite[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    const startIso = new Date(startDate + 'T00:00:00').toISOString();
    const endIso = new Date(endDate + 'T23:59:59').toISOString();
    const [{ data: js }, { data: mv }] = await Promise.all([
      supabase.from('job_sites').select('id, name').eq('active', true).order('name'),
      supabase.from('supply_movements')
        .select('id, job_site_id, quantity, unit_price, total_value, created_at, movement_type, item:supply_items(id, name, unit, unit_cost)')
        .not('job_site_id', 'is', null)
        .gte('created_at', startIso).lte('created_at', endIso),
    ]);
    setJobSites((js as any) || []);
    setMovements((mv as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const rows: Row[] = useMemo(() => {
    const map = new Map<string, Row>();
    for (const m of movements) {
      if (!m.job_site_id || !m.item) continue;
      const js = jobSites.find(j => j.id === m.job_site_id);
      if (!js) continue;
      const qty = Number(m.quantity);
      const unitCost = Number(m.item.unit_cost ?? 0);
      const cost = qty * unitCost;
      const revenue = m.total_value != null ? Number(m.total_value) : (m.unit_price != null ? Number(m.unit_price) * qty : 0);
      let r = map.get(js.id);
      if (!r) { r = { jobSite: js, supplyCost: 0, supplyRevenue: 0, details: [] }; map.set(js.id, r); }
      r.supplyCost += cost;
      r.supplyRevenue += revenue;
      const existing = r.details.find(d => d.name === m.item!.name);
      if (existing) { existing.qty += qty; existing.cost += cost; existing.revenue += revenue; }
      else r.details.push({ name: m.item.name, qty, unit: m.item.unit, unitCost, cost, revenue });
    }
    return Array.from(map.values()).sort((a, b) => b.supplyCost - a.supplyCost);
  }, [movements, jobSites]);

  const totals = useMemo(() => rows.reduce(
    (acc, r) => ({ cost: acc.cost + r.supplyCost, revenue: acc.revenue + r.supplyRevenue }),
    { cost: 0, revenue: 0 }
  ), [rows]);

  const exportCsv = () => {
    const lines = ['Account,Supply Cost,Supply Revenue,Margin'];
    for (const r of rows) {
      lines.push([
        `"${r.jobSite.name.replace(/"/g, '""')}"`,
        r.supplyCost.toFixed(2),
        r.supplyRevenue.toFixed(2),
        (r.supplyRevenue - r.supplyCost).toFixed(2),
      ].join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `supply-cost-${startDate}_${endDate}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Supply Cost Report</CardTitle>
          <p className="text-sm text-muted-foreground">Supply expenses by account, based on movements logged with an account.</p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div><Label>Start date</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
            <div><Label>End date</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
            <Button onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Run report'}</Button>
            <Button variant="outline" onClick={exportCsv} disabled={!rows.length}>
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4"><div className="text-muted-foreground text-sm">Total supply cost</div><div className="text-2xl font-bold">{fmtMoney(totals.cost)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-muted-foreground text-sm">Total supply revenue</div><div className="text-2xl font-bold">{fmtMoney(totals.revenue)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-sm"><DollarSign className="h-4 w-4" />Margin</div><div className="text-2xl font-bold">{fmtMoney(totals.revenue - totals.cost)}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Account</TableHead>
                <TableHead className="text-right">Supply cost</TableHead>
                <TableHead className="text-right">Supply revenue</TableHead>
                <TableHead className="text-right">Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => (
                <Fragment key={r.jobSite.id}>
                  <TableRow>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setExpanded(s => ({ ...s, [r.jobSite.id]: !s[r.jobSite.id] }))}>
                        {expanded[r.jobSite.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </Button>
                    </TableCell>
                    <TableCell className="font-medium">{r.jobSite.name}</TableCell>
                    <TableCell className="text-right">{fmtMoney(r.supplyCost)}</TableCell>
                    <TableCell className="text-right">{fmtMoney(r.supplyRevenue)}</TableCell>
                    <TableCell className="text-right font-semibold">{fmtMoney(r.supplyRevenue - r.supplyCost)}</TableCell>
                  </TableRow>
                  {expanded[r.jobSite.id] && (
                    <TableRow>
                      <TableCell></TableCell>
                      <TableCell colSpan={4} className="bg-muted/30">
                        <Table>
                          <TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Unit cost</TableHead><TableHead className="text-right">Cost</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
                          <TableBody>
                            {r.details.map((d, i) => (
                              <TableRow key={i}>
                                <TableCell>{d.name}</TableCell>
                                <TableCell className="text-right">{d.qty} {d.unit}</TableCell>
                                <TableCell className="text-right">{fmtMoney(d.unitCost)}</TableCell>
                                <TableCell className="text-right">{fmtMoney(d.cost)}</TableCell>
                                <TableCell className="text-right">{fmtMoney(d.revenue)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
              {!rows.length && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">{loading ? 'Loading…' : 'No supply activity in this period.'}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}