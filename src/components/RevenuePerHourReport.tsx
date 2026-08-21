import { Fragment, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Clock, Download, TrendingUp } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';

type JobSite = { id: string; name: string; is_office?: boolean | null };
type TimeEntry = {
  id: string;
  employee_id: string;
  job_site_id: string | null;
  clock_in: string;
  clock_out: string | null;
  break_minutes: number | null;
};
type Profile = { id: string; first_name: string; last_name: string; hourly_rate: number | null };
type Dept = { id: string; name: string; color: string | null };
type Invoice = { id: string; job_site_id: string | null; status: string; invoice_date: string; total: number };

const UNASSIGNED = 'unassigned';

type SiteDetail = { name: string; hours: number; revenue: number };
type StaffDetail = { name: string; hours: number; laborCost: number; revenue: number };
type Row = {
  id: string;
  name: string;
  color: string | null;
  hours: number;
  revenue: number;
  laborCost: number;
  sites: Map<string, SiteDetail>;
  staff: Map<string, StaffDetail>;
};

const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function RevenuePerHourReport() {
  const today = new Date();
  const [startDate, setStartDate] = useState(format(startOfMonth(today), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(today), 'yyyy-MM-dd'));
  const [jobSites, setJobSites] = useState<JobSite[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [members, setMembers] = useState<{ department_id: string; employee_id: string }[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    const startIso = new Date(startDate + 'T00:00:00').toISOString();
    const endIso = new Date(endDate + 'T23:59:59').toISOString();

    const [{ data: js }, { data: te }, { data: pr }, { data: dp }, { data: de }, { data: inv }] = await Promise.all([
      supabase.from('job_sites').select('id, name, is_office').order('name'),
      supabase.from('time_entries')
        .select('id, employee_id, job_site_id, clock_in, clock_out, break_minutes')
        .gte('clock_in', startIso).lte('clock_in', endIso)
        .not('clock_out', 'is', null),
      supabase.from('profiles').select('id, first_name, last_name, hourly_rate'),
      supabase.from('departments').select('id, name, color').eq('active', true).order('name'),
      supabase.from('department_employees').select('department_id, employee_id'),
      supabase.from('billing_invoices')
        .select('id, job_site_id, status, invoice_date, total')
        .gte('invoice_date', startDate).lte('invoice_date', endDate),
    ]);

    setJobSites((js as any) || []);
    setEntries((te as any) || []);
    setProfiles((pr as any) || []);
    setDepartments((dp as any) || []);
    setMembers((de as any) || []);
    setInvoices(((inv as any) || []).filter((i: Invoice) => i.status !== 'void' && i.status !== 'draft'));
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const { rows, unattributedRevenue } = useMemo(() => {
    const siteMap = new Map(jobSites.map(j => [j.id, j]));
    const pMap = new Map(profiles.map(p => [p.id, p]));
    const deptOf = new Map<string, string>();
    members.forEach(m => { if (!deptOf.has(m.employee_id)) deptOf.set(m.employee_id, m.department_id); });

    // Billed revenue per job site (only invoices tied to an account)
    const revBySite = new Map<string, number>();
    let unattributed = 0;
    invoices.forEach(i => {
      const amt = Number(i.total || 0);
      if (!i.job_site_id) { unattributed += amt; return; }
      revBySite.set(i.job_site_id, (revBySite.get(i.job_site_id) || 0) + amt);
    });

    // Field hours per (site, dept) and per (site, dept, employee)
    type Bucket = { hours: number; laborCost: number; staff: Map<string, { hours: number; laborCost: number }> };
    const bySite = new Map<string, Map<string, Bucket>>();
    const siteHours = new Map<string, number>();

    entries.forEach(e => {
      if (!e.job_site_id || !e.clock_out) return;
      const site = siteMap.get(e.job_site_id);
      if (!site || site.is_office) return; // office time is overhead, not field work
      const hrs = Math.max(0, (new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime()) / 3600000 - (e.break_minutes || 0) / 60);
      if (!hrs) return;
      const p = pMap.get(e.employee_id);
      const laborCost = hrs * Number(p?.hourly_rate ?? 0);
      const deptId = deptOf.get(e.employee_id) || UNASSIGNED;

      let deptBuckets = bySite.get(e.job_site_id);
      if (!deptBuckets) { deptBuckets = new Map(); bySite.set(e.job_site_id, deptBuckets); }
      let b = deptBuckets.get(deptId);
      if (!b) { b = { hours: 0, laborCost: 0, staff: new Map() }; deptBuckets.set(deptId, b); }
      b.hours += hrs;
      b.laborCost += laborCost;
      const key = p ? `${p.first_name} ${p.last_name}` : 'Unknown';
      const s = b.staff.get(key) || { hours: 0, laborCost: 0 };
      s.hours += hrs; s.laborCost += laborCost;
      b.staff.set(key, s);
      siteHours.set(e.job_site_id, (siteHours.get(e.job_site_id) || 0) + hrs);
    });

    const rowMap = new Map<string, Row>();
    const getRow = (id: string): Row => {
      let r = rowMap.get(id);
      if (!r) {
        const d = departments.find(x => x.id === id);
        r = {
          id,
          name: d?.name ?? 'Unassigned',
          color: d?.color ?? null,
          hours: 0, revenue: 0, laborCost: 0,
          sites: new Map(), staff: new Map(),
        };
        rowMap.set(id, r);
      }
      return r;
    };

    bySite.forEach((deptBuckets, siteId) => {
      const totalHours = siteHours.get(siteId) || 0;
      const siteRevenue = revBySite.get(siteId) || 0;
      const siteName = siteMap.get(siteId)?.name ?? 'Unknown account';
      deptBuckets.forEach((b, deptId) => {
        const share = totalHours > 0 ? b.hours / totalHours : 0;
        const revenue = siteRevenue * share;
        const row = getRow(deptId);
        row.hours += b.hours;
        row.laborCost += b.laborCost;
        row.revenue += revenue;
        row.sites.set(siteId, { name: siteName, hours: b.hours, revenue });
        b.staff.forEach((s, name) => {
          const cur = row.staff.get(name) || { name, hours: 0, laborCost: 0, revenue: 0 };
          cur.hours += s.hours;
          cur.laborCost += s.laborCost;
          cur.revenue += b.hours > 0 ? revenue * (s.hours / b.hours) : 0;
          row.staff.set(name, cur);
        });
      });
    });

    // Revenue at accounts with billed invoices but no field hours in range
    revBySite.forEach((amt, siteId) => { if (!bySite.has(siteId)) unattributed += amt; });

    const list = Array.from(rowMap.values()).sort((a, b) => b.revenue - a.revenue);
    return { rows: list, unattributedRevenue: unattributed };
  }, [entries, jobSites, profiles, departments, members, invoices]);

  const totals = useMemo(() => rows.reduce(
    (a, r) => ({ hours: a.hours + r.hours, revenue: a.revenue + r.revenue, laborCost: a.laborCost + r.laborCost }),
    { hours: 0, revenue: 0, laborCost: 0 }
  ), [rows]);

  const rph = (revenue: number, hours: number) => (hours > 0 ? revenue / hours : 0);

  const exportCsv = () => {
    const lines = ['Department,Field Hours,Billed Revenue,Revenue per Hour,Labor Cost,Labor Cost per Hour,Gross Margin %'];
    for (const r of rows) {
      const margin = r.revenue > 0 ? ((r.revenue - r.laborCost) / r.revenue) * 100 : 0;
      lines.push([
        `"${r.name.replace(/"/g, '""')}"`,
        r.hours.toFixed(2),
        r.revenue.toFixed(2),
        rph(r.revenue, r.hours).toFixed(2),
        r.laborCost.toFixed(2),
        rph(r.laborCost, r.hours).toFixed(2),
        margin.toFixed(1),
      ].join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `revenue-per-hour-${startDate}_${endDate}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Revenue per Hour by Department</CardTitle>
          <p className="text-sm text-muted-foreground">
            Billed invoices in the date range are attributed to each account, then split across departments by the field hours
            their staff punched at that account. Office/overhead punches are excluded.
          </p>
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
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-sm"><Clock className="h-4 w-4" />Field hours</div><div className="text-2xl font-bold">{totals.hours.toFixed(1)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-muted-foreground text-sm">Billed revenue</div><div className="text-2xl font-bold">{money(totals.revenue)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-muted-foreground text-sm">Revenue / hour</div><div className="text-2xl font-bold">{money(rph(totals.revenue, totals.hours))}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-muted-foreground text-sm">Labor cost / hour</div><div className="text-2xl font-bold">{money(rph(totals.laborCost, totals.hours))}</div></CardContent></Card>
      </div>

      {unattributedRevenue > 0 && (
        <Card className="border-amber-300 bg-amber-50/50">
          <CardContent className="p-4 text-sm text-amber-900">
            <span className="font-semibold">{money(unattributedRevenue)}</span> of billed revenue could not be attributed —
            those invoices have no linked account, or no field hours were punched at that account in this range.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="text-right">Field hours</TableHead>
                <TableHead className="text-right">Billed revenue</TableHead>
                <TableHead className="text-right">Revenue / hr</TableHead>
                <TableHead className="text-right">Labor cost / hr</TableHead>
                <TableHead className="text-right">Gross margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => {
                const margin = r.revenue > 0 ? ((r.revenue - r.laborCost) / r.revenue) * 100 : 0;
                const open = !!expanded[r.id];
                return (
                  <Fragment key={r.id}>
                    <TableRow>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setExpanded(s => ({ ...s, [r.id]: !s[r.id] }))}>
                          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium">
                        <span className="inline-flex items-center gap-2">
                          {r.color && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: r.color }} />}
                          {r.name}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{r.hours.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{money(r.revenue)}</TableCell>
                      <TableCell className="text-right font-semibold">{money(rph(r.revenue, r.hours))}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{money(rph(r.laborCost, r.hours))}</TableCell>
                      <TableCell className="text-right">{r.revenue > 0 ? `${margin.toFixed(1)}%` : '—'}</TableCell>
                    </TableRow>
                    {open && (
                      <TableRow>
                        <TableCell></TableCell>
                        <TableCell colSpan={6} className="bg-muted/30">
                          <div className="grid gap-6 md:grid-cols-2 py-2">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">By account</p>
                              <div className="space-y-1">
                                {Array.from(r.sites.values()).sort((a, b) => b.revenue - a.revenue).map(s => (
                                  <div key={s.name} className="flex justify-between text-sm gap-4">
                                    <span className="truncate">{s.name}</span>
                                    <span className="tabular-nums whitespace-nowrap">
                                      {s.hours.toFixed(1)} hrs · {money(s.revenue)} · <strong>{money(rph(s.revenue, s.hours))}/hr</strong>
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">By staff member</p>
                              <div className="space-y-1">
                                {Array.from(r.staff.values()).sort((a, b) => b.revenue - a.revenue).map(s => (
                                  <div key={s.name} className="flex justify-between text-sm gap-4">
                                    <span className="truncate">{s.name}</span>
                                    <span className="tabular-nums whitespace-nowrap">
                                      {s.hours.toFixed(1)} hrs · <strong>{money(rph(s.revenue, s.hours))}/hr</strong>
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
              {!rows.length && (
                <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                  No field hours found in this range.
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
