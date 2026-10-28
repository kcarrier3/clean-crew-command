import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Package, Plus, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { fetchBillingItems, saveBillingItem, type BillingItem, type BillingItemKind } from './billingApi';
import { money } from '@/lib/billing/types';

const KINDS: BillingItemKind[] = ['service', 'product', 'credit', 'adjustment'];
const empty = {
  name: '', category: '', unit: 'each', default_unit_price: 0,
  sku: '', taxable: true, item_kind: 'service' as BillingItemKind, active: true,
};

export const BillingItemsCard = () => {
  const { toast } = useToast();
  const [items, setItems] = useState<BillingItem[]>([]);
  const [draft, setDraft] = useState({ ...empty });
  const [editing, setEditing] = useState<BillingItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [q, setQ] = useState('');

  const load = () => fetchBillingItems(true).then(setItems)
    .catch(e => toast({ title: 'Could not load items', description: e.message, variant: 'destructive' }));
  useEffect(() => { load(); }, []);

  const save = async (item: Partial<BillingItem> & { name: string }) => {
    if (!item.name.trim()) return toast({ title: 'Give the item a name', variant: 'destructive' });
    setSaving(true);
    try {
      await saveBillingItem(item);
      toast({ title: item.id ? 'Item updated' : 'Item added' });
      setDraft({ ...empty }); setEditing(null); load();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Could not save item';
      toast({ title: 'Could not save item', description: message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter(i => (showInactive || i.active) && (
      !needle
      || i.name.toLowerCase().includes(needle)
      || (i.sku ?? '').toLowerCase().includes(needle)
      || (i.category ?? '').toLowerCase().includes(needle)
    ));
  }, [items, showInactive, q]);

  const fields = (v: {
    name: string; category?: string | null; unit: string; default_unit_price: number;
    sku?: string | null; taxable?: boolean; item_kind?: string;
  }, set: (p: Partial<BillingItem>) => void) => (
    <div className="grid gap-2 sm:grid-cols-2">
      <Input placeholder="Item name" value={v.name} onChange={e => set({ name: e.target.value })} />
      <Input placeholder="SKU" value={v.sku ?? ''} onChange={e => set({ sku: e.target.value })} />
      <Input placeholder="Category" value={v.category ?? ''} onChange={e => set({ category: e.target.value })} />
      <Input placeholder="Unit" value={v.unit} onChange={e => set({ unit: e.target.value })} />
      <Input type="number" step="0.01" aria-label="Default price" value={v.default_unit_price}
             onChange={e => set({ default_unit_price: parseFloat(e.target.value) || 0 })} />
      <select aria-label="Item kind" value={v.item_kind || 'service'}
              onChange={e => set({ item_kind: e.target.value as BillingItemKind })}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm">
        {KINDS.map(k => <option key={k} value={k}>{k}</option>)}
      </select>
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={v.taxable !== false} onCheckedChange={on => set({ taxable: on })} /> Taxable
      </label>
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4" /> Billable items</CardTitle>
        <p className="text-xs text-muted-foreground">
          Invoice lines are picked from active service and product items. Turn an item off to hide it from new invoices. QuickBooks ids stay read-only.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {fields(draft, p => setDraft(d => ({ ...d, ...p })))}
        <Button size="sm" onClick={() => save(draft)} disabled={saving}><Plus className="h-4 w-4 mr-1" /> Add item</Button>

        <div className="flex flex-wrap items-center gap-3">
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, SKU, or category" className="max-w-xs" />
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={showInactive} onCheckedChange={setShowInactive} /> Show inactive
          </label>
          <span className="text-xs text-muted-foreground">{visible.length} shown</span>
        </div>

        <div className="divide-y rounded-md border max-h-[480px] overflow-y-auto">
          {!visible.length && <p className="p-3 text-sm text-muted-foreground">No billable items match.</p>}
          {visible.map(i => editing?.id === i.id ? (
            <div key={i.id} className="p-2 space-y-2">
              {fields(editing, p => setEditing(e => e && ({ ...e, ...p })))}
              {(i.qb_item_id || i.qb_item_type || i.qb_income_account) && (
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>From QuickBooks</p>
                  {i.qb_item_id && <p>Item id: {i.qb_item_id}</p>}
                  {i.qb_item_type && <p>Type: {i.qb_item_type}</p>}
                  {i.qb_income_account && <p>Income account: {i.qb_income_account}</p>}
                </div>
              )}
              <div className="flex gap-2">
                <Button size="sm" onClick={() => save(editing)} disabled={saving}><Save className="h-4 w-4 mr-1" /> Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div key={i.id} className="flex flex-wrap items-center gap-2 p-2 text-sm">
              <button className="min-w-0 flex-1 text-left" onClick={() => setEditing(i)}>
                <span className={i.active ? 'font-medium' : 'font-medium text-muted-foreground line-through'}>{i.name}</span>
                <span className="text-xs text-muted-foreground">
                  {i.sku ? ` · ${i.sku}` : ''}{i.category ? ` · ${i.category}` : ''} · {i.item_kind} · per {i.unit}
                </span>
              </button>
              {i.taxable === false && <Badge variant="outline" className="text-[10px]">Non-taxable</Badge>}
              <span className="tabular-nums">{money(i.default_unit_price)}</span>
              <Switch checked={i.active} aria-label={`${i.name} active`}
                      onCheckedChange={v => save({ ...i, active: v })} />
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground"><Label className="text-xs font-normal">Deactivate an item instead of deleting it so old invoices keep their history.</Label></p>
      </CardContent>
    </Card>
  );
};
