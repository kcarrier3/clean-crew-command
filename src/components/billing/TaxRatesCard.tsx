import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Percent, Plus, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { describeRate, fetchTaxRates, isCountyWideRate, type TaxRateRow } from '@/lib/billing/taxRates';
const today = () => new Date().toISOString().slice(0, 10);
const dayBefore = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

const blank = { state: 'OH', county: '', city: '', zip: '', rate: '', label: '', effective_from: today(), ust_code: '', source_url: '' };

/** County sales-tax table. Rate changes are new rows so invoices keep the rate they were filed with. */
export const TaxRatesCard = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<TaxRateRow[]>([]);
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState({ ...blank });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try { setRows(await fetchTaxRates()); }
    catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Could not load tax rates';
      toast({ title: 'Could not load tax rates', description: message, variant: 'destructive' });
    }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = !s ? rows : rows.filter(r => describeRate(r).toLowerCase().includes(s)
      || (r.zip ?? '').includes(s) || (r.city ?? '').toLowerCase().includes(s)
      || (r.ust_code ?? '').toLowerCase().includes(s)
      || (r.transit_area ?? '').toLowerCase().includes(s));
    return [...list].sort((a, b) =>
      a.state.localeCompare(b.state)
      || (a.county ?? '').localeCompare(b.county ?? '')
      || (b.effective_from ?? '').localeCompare(a.effective_from ?? '')
    );
  }, [rows, q]);

  const add = async () => {
    if (!draft.state.trim()) { toast({ title: 'State is required', variant: 'destructive' }); return; }
    if (!draft.effective_from) { toast({ title: 'Effective date is required', variant: 'destructive' }); return; }
    setBusy(true);
    try {
      const state = draft.state.trim().toUpperCase();
      const county = draft.county.trim() || null;
      const city = draft.city.trim() || null;
      const zip = draft.zip.trim() || null;
      const prior = rows.find(r =>
        r.active && !r.effective_to && r.state === state
        && (r.county ?? null) === county && (r.city ?? null) === city && (r.zip ?? null) === zip && !r.transit_area
      );
      if (prior && draft.effective_from > (prior.effective_from ?? '0001-01-01')) {
        const { error: closeErr } = await supabase.from('tax_rates').update({ effective_to: dayBefore(draft.effective_from) }).eq('id', prior.id);
        if (closeErr) throw closeErr;
      }
      const { error } = await supabase.from('tax_rates').insert({
        state, county, city, zip,
        rate: Number(draft.rate) || 0,
        label: draft.label.trim() || null,
        effective_from: draft.effective_from,
        ust_code: draft.ust_code.trim() || null,
        source_url: draft.source_url.trim() || null,
      });
      if (error) throw error;
      setDraft({ ...blank, effective_from: today() });
      await load();
      toast({ title: prior ? 'New rate added and the previous open rate was closed' : 'Tax rate added' });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Could not add rate';
      toast({ title: 'Could not add rate', description: message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const deactivate = async (id: string, active: boolean) => {
    setRows(rs => rs.map(r => (r.id === id ? { ...r, active } : r)));
    const { error } = await supabase.from('tax_rates').update({ active }).eq('id', id);
    if (error) toast({ title: 'Could not update', description: error.message, variant: 'destructive' });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Percent className="h-4 w-4" /> Sales tax rates
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Invoices use the Ohio county-wide rate in effect on the invoice date. City and transit rows are kept for reference.
          To change a rate, add a new row with an effective date — the previous open row for that place is closed the day before.
          Deactivate a rate instead of deleting it, because invoices store the rate they used.
        </p>

        <div className="grid gap-2 sm:grid-cols-4 items-end rounded-md border p-3">
          <div className="space-y-1"><Label className="text-xs">State</Label>
            <Input value={draft.state} onChange={e => setDraft(d => ({ ...d, state: e.target.value }))} /></div>
          <div className="space-y-1"><Label className="text-xs">County</Label>
            <Input value={draft.county} onChange={e => setDraft(d => ({ ...d, county: e.target.value }))} /></div>
          <div className="space-y-1"><Label className="text-xs">City</Label>
            <Input value={draft.city} onChange={e => setDraft(d => ({ ...d, city: e.target.value }))} /></div>
          <div className="space-y-1"><Label className="text-xs">ZIP</Label>
            <Input value={draft.zip} onChange={e => setDraft(d => ({ ...d, zip: e.target.value }))} /></div>
          <div className="space-y-1"><Label className="text-xs">Rate %</Label>
            <Input type="number" step="0.001" value={draft.rate} onChange={e => setDraft(d => ({ ...d, rate: e.target.value }))} /></div>
          <div className="space-y-1"><Label className="text-xs">Effective from</Label>
            <Input type="date" value={draft.effective_from} onChange={e => setDraft(d => ({ ...d, effective_from: e.target.value }))} /></div>
          <div className="space-y-1"><Label className="text-xs">UST code</Label>
            <Input value={draft.ust_code} onChange={e => setDraft(d => ({ ...d, ust_code: e.target.value }))} /></div>
          <Button onClick={add} disabled={busy}><Plus className="h-4 w-4 mr-1" /> Add</Button>
          <div className="space-y-1 sm:col-span-2"><Label className="text-xs">Source URL</Label>
            <Input value={draft.source_url} onChange={e => setDraft(d => ({ ...d, source_url: e.target.value }))} /></div>
        </div>

        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search county, city, ZIP, or UST code" value={q} onChange={e => setQ(e.target.value)} />
        </div>

        <div className="rounded-md border divide-y max-h-[480px] overflow-y-auto">
          {filtered.map(r => (
            <div key={r.id} className="flex items-center gap-2 p-2 text-sm">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{describeRate(r)} · {Number(r.rate).toFixed(3)}%</div>
                <div className="text-xs text-muted-foreground truncate">
                  {r.effective_from || '—'}{r.effective_to ? ` – ${r.effective_to}` : ' – open'}
                  {r.ust_code ? ` · UST ${r.ust_code}` : ''}
                  {r.transit_area ? ` · ${r.transit_area}` : ''}
                  {r.source_url ? ' · source on file' : ''}
                </div>
              </div>
              {r.is_default && <Badge variant="outline" className="text-xs">Default</Badge>}
              {!isCountyWideRate(r) && !r.is_default && <Badge variant="outline" className="text-xs">City / legacy</Badge>}
              <Switch checked={r.active} aria-label={`Active ${describeRate(r)}`} onCheckedChange={v => deactivate(r.id, v)} />
            </div>
          ))}
          {!filtered.length && <div className="p-4 text-sm text-muted-foreground">No rates found.</div>}
        </div>
      </CardContent>
    </Card>
  );
};

export default TaxRatesCard;
