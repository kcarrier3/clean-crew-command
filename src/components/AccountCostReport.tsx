import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, DollarSign, Clock, Package, Download } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';

type JobSite = { id: string; name: string };
type TimeEntry = {
  id: string;
  employee_id: string;
  job_site_id: string | null;
  clock_in: string;
  clock_out: string | null;
  break_minutes: number | null;
};
type Profile = {
  id: string;
  first_name: string;
  last_name: string;
  hourly_rate: number | null;
  salary_amount: number | null;
  pay_type: string | null;
};
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
  hours: number;
  laborCost: number;
  supplyCost: number;
  supplyRevenue: number;
  laborDetails: Array<{ name: string; hours: number; rate: number; cost: number }>;
  supplyDetails: Array<{ name: string; qty: number; unit: string; unitCost: number; cost: number; revenue: number }>;
};

const fmtMoney = (n: number) => `$${n.toFixed(2)}`;

export default function AccountCostReport() {
  const today = new Date();
  const [startDate, setStartDate] = useState(format(startOfMonth(today), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(today), 'yyyy-MM-dd'));
  const [jobSites, setJobSites] = useState<JobSite[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    const startIso = new Date(startDate + 'T00:00:00').toISOString();
    const endIso = new Date(endDate + 'T23:59:59').toISOString();

    const [{ data: js }, { data: te }, { data: pr }, { data: mv }] = await Promise.all([
      supabase.from('job_sites').select('id, name').eq('active', true).order('name'),
      supabase.from('time_entries')
        .select('id, employee_id, job_site_id, clock_in, clock_out, break_minutes')
        .gte('clock_in', startIso).lte('clock_in', endIso)
        .not('clock_out', 'is', null),
      supabase.from('profiles').select('id, first_name, last_name, hourly_rate, salary_amount, pay_type'),
      supabase.from('supply_movements')
        .select('id, job_site_id, quantity, unit_price, total_value, created_at, movement_type, item:supply_items(id, name, unit, unit_cost)')
        .not('job_site_id', 'is', null)
        .gte('created_at', startIso).lte('created_at', endIso),
    ]);

    setJobSites((js as any) || []);
    setEntries((te as any) || []);
    setProfiles((pr as any) || []);
    setMovements((mv as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const rows: Row[] = useMemo(() => {
    const pMap = new Map(profiles.map(p => [p.id, p]));
    const map = new Map<string, Row>();
    const getRow = (js: JobSite): Row => {
      let r = map.get(js.id);
      if (!r) {
        r = { jobSite: js, hours: 0, laborCost: 0, supplyCost: 0, supplyRevenue: 0, laborDetails: [], supplyDetails: [] };
        map.set(js.id, r);
      }
      return r;
    };
    // Labor
    for (const e of entries) {
      if (!e.job_site_id || !e.clock_out) continue;
      const js = jobSites.find(j => j.id === e.job_site_id);
      if (!js) continue;
      const p = pMap.get(e.employee_id);
      if (!p) continue;
      const ms = new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime();
      const hrs = Math.max(0, ms / 3600000 - (e.break_minutes || 0) / 60);
      const rate = Number(p.hourly_rate ?? 0);
      const cost = hrs * rate;
      const row = getRow(js);
      row.hours += hrs;
      row.laborCost += cost;
      const key = `${p.first_name} ${p.last_name}`;
      const existing = row.laborDetails.find(d => d.name === key);
      if (existing) { existing.hours += hrs; existing.cost += cost; }
      else row.laborDetails.push({ name: key, hours: hrs, rate, cost });
    }
    // Supplies
    for (const m of movements) {
      if (!m.job_site_id || !m.item) continue;
      const js = jobSites.find(j => j.id === m.job_site_id);
      if (!js) continue;
      const qty = Number(m.quantity);
      const unitCost = Number(m.item.unit_cost ?? 0);
      const cost = qty * unitCost;
      const revenue = m.total_value != null ? Number(m.total_value) : (m.unit_price != null ? Number(m.unit_price) * qty : 0);
      const row = getRow(js);
      row.supplyCost += cost;
      row.supplyRevenue += revenue;
      const existing = row.supplyDetails.find(d => d.name === m.item!.name);
      if (existing) { existing.qty += qty; existing.cost += cost; existing.revenue += revenue; }
      else row.supplyDetails.push({ name: m.item.name, qty, unit: m.item.unit, unitCost, cost, revenue });
    }
    return Array.from(map.values()).sort((a, b) => (b.laborCost + b.supplyCost) - (a.laborCost + a.supplyCost));
  }, [entries, movements, jobSites, profiles]);

  const totals = useMemo(() => rows.reduce(
    (acc, r) => ({
      hours: acc.hours + r.hours,
      labor: acc.labor + r.laborCost,
      supply: acc.supply + r.supplyCost,
      revenue: acc.revenue + r.supplyRevenue,
      total: acc.total + r.laborCost + r.supplyCost,
    }),
    { hours: 0, labor: 0, supply: 0, revenue: 0, total: 0 }
  ), [rows]);

  const exportCsv = () => {
    const lines = ['Account,Hours,Labor Cost,Supply Cost,Total Cost,Supply Revenue'];
    for (const r of rows) {
      lines.push([
        `"${r.jobSite.name.replace(/"/g, '""')}"`,
        r.hours.toFixed(2),
        r.laborCost.toFixed(2),
        r.supplyCost.toFixed(2),
        (r.laborCost + r.supplyCost).toFixed(2),
        r.supplyRevenue.toFixed(2),
      ].join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `account-cost-${startDate}_${endDate}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" /> Account Cost Report</CardTitle>
          <p className="text-sm text-muted-foreground">Labor cost from employee punches × pay rate, plus supply usage at each account.</p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label>Start date</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label>End date</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <Button onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Run report'}</Button>
            <Button variant="outline" onClick={exportCsv} disabled={!rows.length}>
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-sm"><Clock className="h-4 w-4" />Hours</div><div className="text-2xl font-bold">{totals.hours.toFixed(1)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-muted-foreground text-sm">Labor cost</div><div className="text-2xl font-bold">{fmtMoney(totals.labor)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-sm"><Package className="h-4 w-4" />Supply cost</div><div className="text-2xl font-bold">{fmtMoney(totals.supply)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-muted-foreground text-sm">Total cost</div><div className="text-2xl font-bold">{fmtMoney(totals.total)}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Account</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead className="text-right">Labor</TableHead>
                <TableHead className="text-right">Supplies</TableHead>
                <TableHead className="text-right">Total cost</TableHead>
                <TableHead className="text-right">Supply revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => (
                <>
                  <TableRow key={r.jobSite.id}>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setExpanded(s => ({ ...s, [r.jobSite.id]: !s[r.jobSite.id] }))}>
                        {expanded[r.jobSite.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </Button>
                    </TableCell>
                    <TableCell className="font-medium">{r.jobSite.name}</TableCell>
                    <TableCell className="text-right">{r.hours.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{fmtMoney(r.laborCost)}</TableCell>
                    <TableCell className="text-right">{fmtMoney(r.supplyCost)}</TableCell>
                    <TableCell className="text-right font-semibold">{fmtMoney(r.laborCost + r.supplyCost)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{fmtMoney(r.supplyRevenue)}</TableCell>
                  </TableRow>
                  {expanded[r.jobSite.id] && (
                    <TableRow>
                      <TableCell></TableCell>
                      <TableCell colSpan={6} className="bg-muted/30">
                        <div className="grid md:grid-cols-2 gap-4 py-2">
                          <div>
                            <div className="font-semibold text-sm mb-1">Labor</div>
                            {r.laborDetails.length ? (
                              <Table>
                                <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead className="text-right">Hrs</TableHead><TableHead className="text-right">Rate</TableHead><TableHead className="text-right">Cost</TableHead></TableRow></TableHeader>
                                <TableBody>
                                  {r.laborDetails.map((d, i) => (
                                    <TableRow key={i}><TableCell>{d.name}</TableCell><TableCell className="text-right">{d.hours.toFixed(2)}</TableCell><TableCell className="text-right">{fmtMoney(d.rate)}</TableCell><TableCell className="text-right">{fmtMoney(d.cost)}</TableCell></TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            ) : <div className="text-sm text-muted-foreground">No punches.</div>}
                          </div>
                          <div>
                            <div className="font-semibold text-sm mb-1">Supplies</div>
                            {r.supplyDetails.length ? (
                              <Table>
                                <TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Unit cost</TableHead><TableHead className="text-right">Cost</TableHead></TableRow></TableHeader>
                                <TableBody>
                                  {r.supplyDetails.map((d, i) => (
                                    <TableRow key={i}><TableCell>{d.name}</TableCell><TableCell className="text-right">{d.qty} {d.unit}</TableCell><TableCell className="text-right">{fmtMoney(d.unitCost)}</TableCell><TableCell className="text-right">{fmtMoney(d.cost)}</TableCell></TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            ) : <div className="text-sm text-muted-foreground">No supplies used.</div>}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
              {!rows.length && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{loading ? 'Loading…' : 'No activity in this period.'}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}