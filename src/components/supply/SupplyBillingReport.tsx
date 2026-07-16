import { Fragment, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Receipt, Download } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addWeeks } from 'date-fns';

type JobSite = { id: string; name: string };
type Profile = { id: string; first_name: string | null; last_name: string | null };
type Movement = {
  id: string;
  job_site_id: string | null;
  quantity: number;
  unit_price: number | null;
  total_value: number | null;
  created_at: string;
  created_by: string | null;
  movement_type: string;
  item: { id: string; name: string; unit: string; sale_price: number | null; is_resale: boolean | null; kind: string | null } | null;
};

type DetailRow = {
  date: string;
  itemName: string;
  qty: number;
  unit: string;
  unitPrice: number;
  total: number;
  droppedBy: string;
};

type CustomerGroup = {
  jobSite: JobSite;
  totalQty: number;
  totalAmount: number;
  details: DetailRow[];
};

const fmtMoney = (n: number) => `$${n.toFixed(2)}`;

// Pay period: Sunday-Saturday (weekStartsOn: 0)
const payPeriodStart = (d: Date) => startOfWeek(d, { weekStartsOn: 0 });
const payPeriodEnd = (d: Date) => endOfWeek(d, { weekStartsOn: 0 });

export default function SupplyBillingReport() {
  const today = new Date();
  const [startDate, setStartDate] = useState(format(payPeriodStart(today), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(payPeriodEnd(today), 'yyyy-MM-dd'));
  const [jobSites, setJobSites] = useState<JobSite[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const shiftWeek = (delta: number) => {
    const base = new Date(startDate + 'T12:00:00');
    const nextStart = payPeriodStart(addWeeks(base, delta));
    setStartDate(format(nextStart, 'yyyy-MM-dd'));
    setEndDate(format(payPeriodEnd(nextStart), 'yyyy-MM-dd'));
  };

  const load = async () => {
    setLoading(true);
    const startIso = new Date(startDate + 'T00:00:00').toISOString();
    const endIso = new Date(endDate + 'T23:59:59').toISOString();
    const [{ data: js }, { data: mv }, { data: pr }] = await Promise.all([
      supabase.from('job_sites').select('id, name').eq('active', true).order('name'),
      supabase.from('supply_movements')
        .select('id, job_site_id, quantity, unit_price, total_value, created_at, created_by, movement_type, item:supply_items(id, name, unit, sale_price, is_resale, kind)')
        .not('job_site_id', 'is', null)
        .gte('created_at', startIso).lte('created_at', endIso)
        .order('created_at', { ascending: true }),
      supabase.from('profiles').select('id, first_name, last_name'),
    ]);
    setJobSites((js as any) || []);
    setMovements((mv as any) || []);
    setProfiles((pr as any) || []);
    setExpanded({});
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [startDate, endDate]);

  const nameOf = (uid: string | null) => {
    if (!uid) return '—';
    const p = profiles.find(x => x.id === uid);
    if (!p) return '—';
    return [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || '—';
  };

  const groups: CustomerGroup[] = useMemo(() => {
    const map = new Map<string, CustomerGroup>();
    for (const m of movements) {
      if (!m.job_site_id || !m.item) continue;
      // Only include resale/billable drop-offs to the customer
      const isBillable = (m.item.is_resale === true || m.item.kind === 'resale') && m.movement_type === 'sell';
      if (!isBillable) continue;
      const js = jobSites.find(j => j.id === m.job_site_id);
      if (!js) continue;
      const qty = Number(m.quantity);
      const unitPrice = m.unit_price != null
        ? Number(m.unit_price)
        : Number(m.item.sale_price ?? 0);
      const total = m.total_value != null ? Number(m.total_value) : unitPrice * qty;
      let g = map.get(js.id);
      if (!g) { g = { jobSite: js, totalQty: 0, totalAmount: 0, details: [] }; map.set(js.id, g); }
      g.totalQty += qty;
      g.totalAmount += total;
      g.details.push({
        date: m.created_at,
        itemName: m.item.name,
        qty,
        unit: m.item.unit,
        unitPrice,
        total,
        droppedBy: nameOf(m.created_by),
      });
    }
    return Array.from(map.values()).sort((a, b) => a.jobSite.name.localeCompare(b.jobSite.name));
  }, [movements, jobSites, profiles]);

  const grandTotal = useMemo(() => groups.reduce((s, g) => s + g.totalAmount, 0), [groups]);

  const exportCsv = () => {
    const lines = ['Customer,Date,Item,Quantity,Unit,Unit Price,Total,Dropped Off By'];
    for (const g of groups) {
      for (const d of g.details) {
        lines.push([
          `"${g.jobSite.name.replace(/"/g, '""')}"`,
          format(new Date(d.date), 'yyyy-MM-dd'),
          `"${d.itemName.replace(/"/g, '""')}"`,
          String(d.qty),
          d.unit,
          d.unitPrice.toFixed(2),
          d.total.toFixed(2),
          `"${d.droppedBy.replace(/"/g, '""')}"`,
        ].join(','));
      }
      lines.push([`"${g.jobSite.name.replace(/"/g, '""')} TOTAL"`, '', '', String(g.totalQty), '', '', g.totalAmount.toFixed(2), ''].join(','));
    }
    lines.push(['GRAND TOTAL', '', '', '', '', '', grandTotal.toFixed(2), ''].join(','));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `supply-billing_${startDate}_${endDate}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" /> Supply Billing Report</CardTitle>
          <p className="text-sm text-muted-foreground">
            Resale supplies dropped off to customers, grouped for easy billing. Defaults to the current pay period (Sunday–Saturday).
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <Button variant="outline" onClick={() => shiftWeek(-1)}>◀ Previous week</Button>
            <div><Label>Start date</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
            <div><Label>End date</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
            <Button variant="outline" onClick={() => shiftWeek(1)}>Next week ▶</Button>
            <Button variant="outline" onClick={() => {
              const s = payPeriodStart(new Date());
              setStartDate(format(s, 'yyyy-MM-dd'));
              setEndDate(format(payPeriodEnd(s), 'yyyy-MM-dd'));
            }}>This week</Button>
            <Button onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</Button>
            <Button variant="outline" onClick={exportCsv} disabled={!groups.length}>
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4"><div className="text-muted-foreground text-sm">Customers billed</div><div className="text-2xl font-bold">{groups.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-muted-foreground text-sm">Line items</div><div className="text-2xl font-bold">{groups.reduce((s, g) => s + g.details.length, 0)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-muted-foreground text-sm">Grand total</div><div className="text-2xl font-bold">{fmtMoney(grandTotal)}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Line items</TableHead>
                <TableHead className="text-right">Total qty</TableHead>
                <TableHead className="text-right">Total to bill</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map(g => (
                <Fragment key={g.jobSite.id}>
                  <TableRow>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setExpanded(s => ({ ...s, [g.jobSite.id]: !s[g.jobSite.id] }))}>
                        {expanded[g.jobSite.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </Button>
                    </TableCell>
                    <TableCell className="font-medium">{g.jobSite.name}</TableCell>
                    <TableCell className="text-right">{g.details.length}</TableCell>
                    <TableCell className="text-right">{g.totalQty}</TableCell>
                    <TableCell className="text-right font-semibold">{fmtMoney(g.totalAmount)}</TableCell>
                  </TableRow>
                  {expanded[g.jobSite.id] && (
                    <TableRow>
                      <TableCell></TableCell>
                      <TableCell colSpan={4} className="bg-muted/30">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Item</TableHead>
                              <TableHead className="text-right">Qty</TableHead>
                              <TableHead className="text-right">Unit price</TableHead>
                              <TableHead className="text-right">Total</TableHead>
                              <TableHead>Dropped off by</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {g.details.map((d, i) => (
                              <TableRow key={i}>
                                <TableCell>{format(new Date(d.date), 'MMM d, yyyy')}</TableCell>
                                <TableCell>{d.itemName}</TableCell>
                                <TableCell className="text-right">{d.qty} {d.unit}</TableCell>
                                <TableCell className="text-right">{fmtMoney(d.unitPrice)}</TableCell>
                                <TableCell className="text-right">{fmtMoney(d.total)}</TableCell>
                                <TableCell>{d.droppedBy}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
              {!groups.length && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">{loading ? 'Loading…' : 'No billable resale drop-offs in this period.'}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}