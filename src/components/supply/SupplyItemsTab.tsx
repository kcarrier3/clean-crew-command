import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, History } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type Item = {
  id: string;
  sku: string | null;
  name: string;
  description: string | null;
  kind: 'resale' | 'cleaning';
  unit: string;
  unit_cost: number | null;
  sale_price: number | null;
  reorder_point: number | null;
  active: boolean;
  category_id: string | null;
  markup_percent: number | null;
};

type Category = { id: string; name: string; kind: string };

const emptyItem = {
  sku: '', name: '', description: '', kind: 'resale' as const,
  unit: 'ea', unit_cost: '', markup_percent: '0', reorder_point: '0', category_id: '',
};

type HistoryRow = {
  id: string;
  previous_unit_cost: number | null;
  new_unit_cost: number | null;
  previous_markup_percent: number | null;
  new_markup_percent: number | null;
  previous_sale_price: number | null;
  new_sale_price: number | null;
  changed_by: string | null;
  note: string | null;
  created_at: string;
};

const money = (v: number | null | undefined) =>
  v == null ? '—' : `$${Number(v).toFixed(2)}`;
const pct = (v: number | null | undefined) =>
  v == null ? '—' : `${Number(v).toFixed(2)}%`;
const computeSale = (cost: string | number, markup: string | number) => {
  const c = Number(cost); const m = Number(markup);
  if (!isFinite(c) || !isFinite(m)) return 0;
  return c * (1 + m / 100);
};

export default function SupplyItemsTab({ canManage }: { canManage: boolean }) {
  const { toast } = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [form, setForm] = useState<any>(emptyItem);
  const [loading, setLoading] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyItem, setHistoryItem] = useState<Item | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [userNames, setUserNames] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const [{ data: its }, { data: cats }] = await Promise.all([
      supabase.from('supply_items').select('*').order('name'),
      supabase.from('supply_categories').select('*').order('name'),
    ]);
    setItems((its as Item[]) || []);
    setCategories((cats as Category[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(emptyItem); setOpen(true); };
  const openEdit = (it: Item) => {
    setEditing(it);
    setForm({
      sku: it.sku || '', name: it.name, description: it.description || '',
      kind: it.kind, unit: it.unit,
      unit_cost: it.unit_cost?.toString() || '',
      markup_percent: (it.markup_percent ?? 0).toString(),
      reorder_point: it.reorder_point?.toString() || '0',
      category_id: it.category_id || '',
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name) { toast({ title: 'Name required', variant: 'destructive' }); return; }
    const cost = form.unit_cost ? Number(form.unit_cost) : null;
    const markup = form.markup_percent ? Number(form.markup_percent) : 0;
    const sale = cost != null ? Number((cost * (1 + markup / 100)).toFixed(2)) : null;
    const payload = {
      sku: form.sku || null,
      name: form.name,
      description: form.description || null,
      kind: form.kind,
      unit: form.unit || 'ea',
      unit_cost: cost,
      markup_percent: markup,
      sale_price: sale,
      reorder_point: form.reorder_point ? Number(form.reorder_point) : 0,
      category_id: form.category_id || null,
    };
    const { error } = editing
      ? await supabase.from('supply_items').update(payload).eq('id', editing.id)
      : await supabase.from('supply_items').insert(payload);
    if (error) { toast({ title: 'Save failed', description: error.message, variant: 'destructive' }); return; }
    toast({ title: editing ? 'Item updated' : 'Item created' });
    setOpen(false);
    load();
  };

  const openHistory = async (it: Item) => {
    setHistoryItem(it);
    setHistoryOpen(true);
    setHistoryLoading(true);
    const { data, error } = await supabase
      .from('supply_item_cost_history')
      .select('*')
      .eq('item_id', it.id)
      .order('created_at', { ascending: false });
    if (error) toast({ title: 'Failed to load history', description: error.message, variant: 'destructive' });
    const rows = (data as HistoryRow[]) || [];
    setHistory(rows);
    const ids = Array.from(new Set(rows.map(r => r.changed_by).filter(Boolean))) as string[];
    if (ids.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', ids);
      const map: Record<string, string> = {};
      (profs || []).forEach((p: any) => {
        map[p.id] = `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown';
      });
      setUserNames(map);
    } else {
      setUserNames({});
    }
    setHistoryLoading(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Items</CardTitle>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />New item</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{editing ? 'Edit item' : 'New item'}</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>SKU</Label><Input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} /></div>
                <div><Label>Unit</Label><Input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} /></div>
                <div>
                  <Label>Type</Label>
                  <Select value={form.kind} onValueChange={v => setForm({ ...form, kind: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="resale">Resale (tracked value)</SelectItem>
                      <SelectItem value="cleaning">Cleaning supply</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={form.category_id || 'none'} onValueChange={v => setForm({ ...form, category_id: v === 'none' ? '' : v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Unit cost</Label><Input type="number" step="0.01" value={form.unit_cost} onChange={e => setForm({ ...form, unit_cost: e.target.value })} /></div>
                <div>
                  <Label>Markup %</Label>
                  <Input type="number" step="0.01" value={form.markup_percent} onChange={e => setForm({ ...form, markup_percent: e.target.value })} />
                </div>
                <div className="col-span-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                  Calculated sale price:{' '}
                  <span className="font-semibold">
                    {form.unit_cost ? `$${computeSale(form.unit_cost, form.markup_percent || 0).toFixed(2)}` : '—'}
                  </span>
                  <span className="text-muted-foreground"> (cost × (1 + markup%))</span>
                </div>
                <div><Label>Reorder point</Label><Input type="number" step="0.01" value={form.reorder_point} onChange={e => setForm({ ...form, reorder_point: e.target.value })} /></div>
                <div className="col-span-2"><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={save}>{editing ? 'Save' : 'Create'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {loading ? <div className="text-sm text-muted-foreground">Loading…</div> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Markup</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Reorder</TableHead>
                {canManage && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(it => (
                <TableRow key={it.id}>
                  <TableCell className="font-medium">{it.name}</TableCell>
                  <TableCell className="text-muted-foreground">{it.sku || '—'}</TableCell>
                  <TableCell><Badge variant={it.kind === 'resale' ? 'default' : 'secondary'}>{it.kind}</Badge></TableCell>
                  <TableCell>{it.unit}</TableCell>
                  <TableCell className="text-right">{it.unit_cost != null ? `$${Number(it.unit_cost).toFixed(2)}` : '—'}</TableCell>
                  <TableCell className="text-right">{pct(it.markup_percent)}</TableCell>
                  <TableCell className="text-right">{it.sale_price != null ? `$${Number(it.sale_price).toFixed(2)}` : '—'}</TableCell>
                  <TableCell className="text-right">{it.reorder_point ?? 0}</TableCell>
                  {canManage && (
                    <TableCell className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="icon" title="Cost history" onClick={() => openHistory(it)}><History className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" title="Edit" onClick={() => openEdit(it)}><Pencil className="h-4 w-4" /></Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {!items.length && (
                <TableRow><TableCell colSpan={canManage ? 9 : 8} className="text-center text-muted-foreground py-8">No items yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Cost history — {historyItem?.name}</DialogTitle>
          </DialogHeader>
          {historyLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : history.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">No changes recorded yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Markup</TableHead>
                  <TableHead>Sale price</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map(h => (
                  <TableRow key={h.id}>
                    <TableCell className="whitespace-nowrap text-xs">{new Date(h.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-xs">{money(h.previous_unit_cost)} → <span className="font-medium">{money(h.new_unit_cost)}</span></TableCell>
                    <TableCell className="text-xs">{pct(h.previous_markup_percent)} → <span className="font-medium">{pct(h.new_markup_percent)}</span></TableCell>
                    <TableCell className="text-xs">{money(h.previous_sale_price)} → <span className="font-medium">{money(h.new_sale_price)}</span></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{h.note || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}