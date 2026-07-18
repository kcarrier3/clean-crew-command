import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format, subMonths, startOfMonth } from 'date-fns';
import type { CrmDeal, CrmStage, CrmLead, CrmInvoice } from './types';

const COLORS = ['#4d7c0f', '#65a30d', '#84cc16', '#a3e635', '#bef264', '#ca8a04', '#dc2626'];

export function CRMReports() {
  const [deals, setDeals] = useState<CrmDeal[]>([]);
  const [stages, setStages] = useState<CrmStage[]>([]);
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [invoices, setInvoices] = useState<CrmInvoice[]>([]);

  useEffect(() => {
    (async () => {
      const [d, s, l, i] = await Promise.all([
        (supabase as any).from('crm_deals').select('*'),
        (supabase as any).from('crm_pipeline_stages').select('*').order('sort_order'),
        (supabase as any).from('crm_leads').select('*'),
        (supabase as any).from('crm_invoices').select('*'),
      ]);
      setDeals(d.data || []); setStages(s.data || []); setLeads(l.data || []); setInvoices(i.data || []);
    })();
  }, []);

  const pipelineByStage = useMemo(() =>
    stages.map(st => ({
      name: st.name,
      value: deals.filter(d => d.stage_id === st.id).reduce((sum, d) => sum + (Number(d.value) || 0), 0),
      count: deals.filter(d => d.stage_id === st.id).length,
    })), [stages, deals]);

  const wonLost = useMemo(() => {
    const won = deals.filter(d => stages.find(s => s.id === d.stage_id)?.is_won).length;
    const lost = deals.filter(d => stages.find(s => s.id === d.stage_id)?.is_lost).length;
    const open = deals.length - won - lost;
    return [
      { name: 'Open', value: open },
      { name: 'Won', value: won },
      { name: 'Lost', value: lost },
    ];
  }, [deals, stages]);

  const leadsBySource = useMemo(() => {
    const m: Record<string, number> = {};
    leads.forEach(l => { const k = l.source || 'Unknown'; m[k] = (m[k] || 0) + 1; });
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [leads]);

  const revenueTrend = useMemo(() => {
    const months: { name: string; revenue: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = startOfMonth(subMonths(new Date(), i));
      const monthEnd = startOfMonth(subMonths(new Date(), i - 1));
      const total = invoices
        .filter(inv => inv.status === 'paid' && inv.paid_at && new Date(inv.paid_at) >= monthStart && new Date(inv.paid_at) < monthEnd)
        .reduce((s, inv) => s + Number(inv.total), 0);
      months.push({ name: format(monthStart, 'MMM'), revenue: total });
    }
    return months;
  }, [invoices]);

  const totals = useMemo(() => {
    const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.total), 0);
    const outstanding = invoices.filter(i => i.status === 'sent' || i.status === 'overdue').reduce((s, i) => s + Number(i.total), 0);
    const wonValue = deals.filter(d => stages.find(s => s.id === d.stage_id)?.is_won).reduce((s, d) => s + (Number(d.value) || 0), 0);
    const conversion = leads.length > 0
      ? Math.round((leads.filter(l => l.status === 'converted').length / leads.length) * 100)
      : 0;
    return { totalRevenue, outstanding, wonValue, conversion };
  }, [invoices, deals, stages, leads]);

  // Opportunity forecast by close month (weighted by probability)
  const forecastByMonth = useMemo(() => {
    const map = new Map<string, { name: string; pipeline: number; forecast: number }>();
    for (let i = 0; i < 6; i++) {
      const m = startOfMonth(subMonths(new Date(), -i));
      map.set(format(m, 'yyyy-MM'), { name: format(m, 'MMM'), pipeline: 0, forecast: 0 });
    }
    (leads as any[]).forEach(l => {
      if (!l.close_date || l.status === 'unqualified') return;
      const key = format(new Date(l.close_date), 'yyyy-MM');
      const row = map.get(key);
      if (!row) return;
      const amt = Number(l.amount || 0);
      const exp = l.expected_revenue != null ? Number(l.expected_revenue) : amt * (Number(l.probability || 0) / 100);
      row.pipeline += amt;
      row.forecast += exp;
    });
    return Array.from(map.values());
  }, [leads]);

  const oppsByServiceLine = useMemo(() => {
    const m: Record<string, number> = {};
    (leads as any[]).forEach(l => {
      const k = l.service_line || l.type || 'Uncategorized';
      m[k] = (m[k] || 0) + Number(l.amount || 0);
    });
    return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [leads]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Revenue (paid)</p>
          <p className="text-xl font-bold mt-1">${totals.totalRevenue.toLocaleString()}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Outstanding</p>
          <p className="text-xl font-bold mt-1">${totals.outstanding.toLocaleString()}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Won Deals Value</p>
          <p className="text-xl font-bold mt-1">${totals.wonValue.toLocaleString()}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Lead Conversion</p>
          <p className="text-xl font-bold mt-1">{totals.conversion}%</p>
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Pipeline Value by Stage</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={pipelineByStage}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v: any) => `$${Number(v).toLocaleString()}`} />
                <Bar dataKey="value" fill="#4d7c0f" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Deal Outcomes</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={wonLost} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {wonLost.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Leads by Source</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={leadsBySource} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" fontSize={11} />
                <YAxis dataKey="name" type="category" fontSize={11} width={90} />
                <Tooltip />
                <Bar dataKey="value" fill="#65a30d" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Revenue – Last 6 Months</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={revenueTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v: any) => `$${Number(v).toLocaleString()}`} />
                <Line type="monotone" dataKey="revenue" stroke="#4d7c0f" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Opportunity Forecast by Close Month (weighted)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={forecastByMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v: any) => `$${Number(v).toLocaleString()}`} />
                <Legend />
                <Bar dataKey="pipeline" fill="#a3e635" name="Pipeline $" />
                <Bar dataKey="forecast" fill="#4d7c0f" name="Weighted Forecast $" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Opportunity Value by Service Line</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={oppsByServiceLine} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" fontSize={11} />
                <YAxis dataKey="name" type="category" fontSize={11} width={110} />
                <Tooltip formatter={(v: any) => `$${Number(v).toLocaleString()}`} />
                <Bar dataKey="value" fill="#65a30d" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}