import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Percent, Plus, Trash2, Search, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { fetchTaxRates, describeRate, type TaxRateRow } from '@/lib/billing/taxRates';

const db = supabase as any;

const blank = { state: 'OH', county: '', city: '', zip: '', rate: '', label: '' };

/** Manager-editable sales tax rate table used to auto-calculate tax from the customer's city. */
export const TaxRatesCard = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<TaxRateRow[]>([]);
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState({ ...blank });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try { setRows(await fetchTaxRates()); }
    catch (e: any) { toast({ title: 'Could not load tax rates', description: e.message, variant: 'destructive' }); }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(r => describeRate(r).toLowerCase().includes(s)
      || (r.zip ?? '').includes(s) || (r.city ?? '').toLowerCase().includes(s));
  }, [rows, q]);

  const add = async () => {
    if (!draft.state.trim()) { toast({ title: 'State is required', variant: 'destructive' }); return; }
    setBusy(true);
    try {
      const { error } = await db.from('tax_rates').insert({
        state: draft.state.trim().toUpperCase(),
        county: draft.county.trim() || null,
        city: draft.city.trim() || null,
        zip: draft.zip.trim() || null,
        rate: Number(draft.rate) || 0,
        label: draft.label.trim() || null,
      });
      if (error) throw error;
      setDraft({ ...blank });
      await load();
      toast({ title: 'Tax rate added' });
    } catch (e: any) {
      toast({ title: 'Could not add rate', description: e.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const patch = async (id: string, p: Record<string, any>) => {
    setRows(rs => rs.map(r => (r.id === id ? { ...r, ...p } as TaxRateRow : r)));
    const { error } = await db.from('tax_rates').update(p).eq('id', id);
    if (error) toast({ title: 'Could not save', description: error.message, variant: 'destructive' });
  };

  const remove = async (id: string) => {
    const { error } = await db.from('tax_rates').delete().eq('id', id);
    if (error) { toast({ title: 'Could not delete', description: error.message, variant: 'destructive' }); return; }
    setRows(rs => rs.filter(r => r.id !== id));
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
          Invoices and customer proposals pick the rate automatically from the ship-to (service) city on the
          account. The most specific match wins: ZIP, then city, then state, then the default row.
        </p>

        <div className="grid gap-2 sm:grid-cols-6 items-end rounded-md border p-3">
          <div className="space-y-1">
            <Label className="text-xs">State</Label>
            <Input value={draft.state} onChange={e => setDraft(d => ({ ...d, state: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">County</Label>
            <Input value={draft.county} onChange={e => setDraft(d => ({ ...d, county: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">City</Label>
            <Input value={draft.city} onChange={e => setDraft(d => ({ ...d, city: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">ZIP</Label>
            <Input value={draft.zip} onChange={e => setDraft(d => ({ ...d, zip: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Rate %</Label>
            <Input type="number" step="0.001" value={draft.rate} onChange={e => setDraft(d => ({ ...d, rate: e.target.value }))} />
          </div>
          <Button onClick={add} disabled={busy}><Plus className="h-4 w-4 mr-1" /> Add</Button>
        </div>

        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search city, county or ZIP" value={q} onChange={e => setQ(e.target.value)} />
        </div>

        <div className="rounded-md border divide-y max-h-[420px] overflow-y-auto">
          {filtered.map(r => (
            <div key={r.id} className="flex items-center gap-2 p-2 text-sm">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{describeRate(r)}</div>
                <div className="text-xs text-muted-foreground">
                  {[r.zip && `ZIP ${r.zip}`, r.is_default && 'Default fallback'].filter(Boolean).join(' · ') || '\u00A0'}
                </div>
              </div>
              {r.is_default && <Badge variant="outline" className="text-xs">Default</Badge>}
              <Input
                className="w-24 h-8 text-right tabular-nums"
                type="number" step="0.001" defaultValue={r.rate}
                onBlur={e => {
                  const v = Number(e.target.value) || 0;
                  if (v !== r.rate) patch(r.id, { rate: v });
                }}
              />
              <span className="text-xs text-muted-foreground">%</span>
              <Switch checked={r.active} onCheckedChange={v => patch(r.id, { active: v })} />
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => remove(r.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          {!filtered.length && <div className="p-4 text-sm text-muted-foreground">No rates found.</div>}
        </div>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Save className="h-3 w-3" /> Rate edits save when you click away from the field.
        </p>
      </CardContent>
    </Card>
  );
};

export default TaxRatesCard;
