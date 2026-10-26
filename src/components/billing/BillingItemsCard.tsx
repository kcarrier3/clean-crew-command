import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Package, Plus, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { fetchBillingItems, saveBillingItem, type BillingItem } from './billingApi';
import { money } from '@/lib/billing/types';

const empty = { name: '', category: '', unit: 'each', default_unit_price: 0 };

/** Saved billable items that invoice lines pick from, so billing can be reported by item. */
export const BillingItemsCard = () => {
  const { toast } = useToast();
  const [items, setItems] = useState<BillingItem[]>([]);
  const [draft, setDraft] = useState({ ...empty });
  const [editing, setEditing] = useState<BillingItem | null>(null);
  const [saving, setSaving] = useState(false);

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
    } catch (e: any) {
      toast({ title: 'Could not save item', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const row = (v: any, set: (p: any) => void) => (
    <div className="grid gap-2 sm:grid-cols-[1fr_9rem_6rem_7rem]">
      <Input placeholder="Item name (e.g. Carpet extraction)" value={v.name} onChange={e => set({ name: e.target.value })} />
      <Input placeholder="Category" value={v.category ?? ''} onChange={e => set({ category: e.target.value })} />
      <Input placeholder="Unit" value={v.unit} onChange={e => set({ unit: e.target.value })} />
      <Input type="number" step="0.01" aria-label="Default price" value={v.default_unit_price}
             onChange={e => set({ default_unit_price: parseFloat(e.target.value) || 0 })} />
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4" /> Billable items</CardTitle>
        <p className="text-xs text-muted-foreground">
          Invoice lines are picked from this list so billing can be reported by item. Turn an item off to hide it from new invoices without losing its history.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {row(draft, p => setDraft(d => ({ ...d, ...p })))}
        <Button size="sm" onClick={() => save(draft)} disabled={saving}><Plus className="h-4 w-4 mr-1" /> Add item</Button>

        <div className="divide-y rounded-md border">
          {!items.length && <p className="p-3 text-sm text-muted-foreground">No billable items yet.</p>}
          {items.map(i => editing?.id === i.id ? (
            <div key={i.id} className="p-2 space-y-2">
              {row(editing, p => setEditing(e => e && ({ ...e, ...p })))}
              <div className="flex gap-2">
                <Button size="sm" onClick={() => save(editing)} disabled={saving}><Save className="h-4 w-4 mr-1" /> Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div key={i.id} className="flex flex-wrap items-center gap-2 p-2 text-sm">
              <button className="min-w-0 flex-1 text-left" onClick={() => setEditing(i)}>
                <span className={i.active ? 'font-medium' : 'font-medium text-muted-foreground line-through'}>{i.name}</span>
                <span className="text-xs text-muted-foreground"> {i.category ? `· ${i.category} ` : ''}· per {i.unit}</span>
              </button>
              <span className="tabular-nums">{money(i.default_unit_price)}</span>
              <Switch checked={i.active} aria-label={`${i.name} active`}
                      onCheckedChange={v => save({ ...i, active: v })} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
