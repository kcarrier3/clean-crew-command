import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Pencil, PackagePlus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

type Row = {
  item_id: string;
  location_id: string;
  quantity: number;
  item: { name: string; sku: string | null; unit: string; reorder_point: number | null; kind: string } | null;
  location: { name: string; kind: string } | null;
};

type Location = { id: string; name: string; kind: string };
type Item = { id: string; name: string; unit: string; unit_cost: number | null };

export default function SupplyStockTab() {
  const { isManager, profile } = useAuth();
  const managerTitles = ['Owner', 'Administrator', 'Office Manager', 'Operations Manager', 'Janitorial Manager', 'Project Crew Lead', 'Supply Management', 'Supply'];
  const canManage = isManager() || (profile?.job_title ? managerTitles.includes(profile.job_title) : false);
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [locFilter, setLocFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [editRow, setEditRow] = useState<Row | null>(null);
  const [newQty, setNewQty] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receiveForm, setReceiveForm] = useState<any>({
    item_id: '', to_location_id: '', quantity: '1', unit_price: '', reference: '', notes: '',
  });

  const load = async () => {
    setLoading(true);
    const [{ data: stock }, { data: locs }, { data: its }] = await Promise.all([
      supabase
        .from('supply_stock')
        .select('item_id, location_id, quantity, item:supply_items(name, sku, unit, reorder_point, kind), location:supply_locations(name, kind)')
        .order('quantity', { ascending: false }),
      supabase.from('supply_locations').select('id, name, kind').eq('active', true).order('name'),
      supabase.from('supply_items').select('id, name, unit, unit_cost').eq('active', true).order('name'),
    ]);
    setRows((stock as any) || []);
    setLocations((locs as Location[]) || []);
    setItems((its as any) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = rows.filter(r => locFilter === 'all' || r.location_id === locFilter);

  const openEdit = (r: Row) => {
    setEditRow(r);
    setNewQty(String(r.quantity));
    setNotes('');
  };

  const saveQty = async () => {
    if (!editRow) return;
    const target = Number(newQty);
    if (isNaN(target) || target < 0) {
      toast({ title: 'Enter a valid quantity', variant: 'destructive' }); return;
    }
    const delta = target - Number(editRow.quantity);
    if (delta === 0) { setEditRow(null); return; }
    setSaving(true);
    const { data: userRes } = await supabase.auth.getUser();
    const payload: any = {
      item_id: editRow.item_id,
      movement_type: 'adjust',
      quantity: Math.abs(delta),
      notes: notes || `Manual stock set to ${target}`,
      created_by: userRes.user?.id,
    };
    if (delta > 0) payload.to_location_id = editRow.location_id;
    else payload.from_location_id = editRow.location_id;
    const { error } = await supabase.from('supply_movements').insert(payload);
    setSaving(false);
    if (error) { toast({ title: 'Failed', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Stock updated' });
    setEditRow(null);
    load();
  };

  const openReceive = () => {
    const warehouse = locations.find(l => l.kind === 'warehouse');
    setReceiveForm({
      item_id: '',
      to_location_id: warehouse?.id || '',
      quantity: '1',
      unit_price: '',
      reference: '',
      notes: '',
    });
    setReceiveOpen(true);
  };

  const submitReceive = async () => {
    if (!receiveForm.item_id) { toast({ title: 'Choose an item', variant: 'destructive' }); return; }
    if (!receiveForm.to_location_id) { toast({ title: 'Choose a destination', variant: 'destructive' }); return; }
    const qty = Number(receiveForm.quantity);
    if (isNaN(qty) || qty <= 0) { toast({ title: 'Enter a positive quantity', variant: 'destructive' }); return; }
    setSaving(true);
    const { data: userRes } = await supabase.auth.getUser();
    const unitPrice = receiveForm.unit_price ? Number(receiveForm.unit_price) : null;
    const payload: any = {
      item_id: receiveForm.item_id,
      movement_type: 'receive',
      quantity: qty,
      to_location_id: receiveForm.to_location_id,
      unit_price: unitPrice,
      total_value: unitPrice != null ? unitPrice * qty : null,
      reference: receiveForm.reference || null,
      notes: receiveForm.notes || null,
      created_by: userRes.user?.id,
    };
    const { error } = await supabase.from('supply_movements').insert(payload);
    setSaving(false);
    if (error) { toast({ title: 'Failed', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Inventory received' });
    setReceiveOpen(false);
    load();
  };

  const selectedItem = items.find(i => i.id === receiveForm.item_id);
  const warehouses = locations.filter(l => l.kind === 'warehouse');

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Stock on hand</CardTitle>
        <div className="flex items-center gap-2 flex-wrap">
          {canManage && (
            <Button onClick={openReceive}>
              <PackagePlus className="h-4 w-4 mr-2" />Receive Inventory
            </Button>
          )}
          <div className="w-56">
            <Select value={locFilter} onValueChange={setLocFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All locations</SelectItem>
                {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name} ({l.kind})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <div className="text-sm text-muted-foreground">Loading…</div> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Status</TableHead>
                {canManage && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(r => {
                const low = r.item?.reorder_point != null && r.quantity <= Number(r.item.reorder_point);
                return (
                  <TableRow key={`${r.item_id}-${r.location_id}`}>
                    <TableCell className="font-medium">{r.item?.name} {r.item?.sku && <span className="text-muted-foreground text-xs ml-2">{r.item.sku}</span>}</TableCell>
                    <TableCell>{r.location?.name} <span className="text-xs text-muted-foreground">({r.location?.kind})</span></TableCell>
                    <TableCell className="text-right">{Number(r.quantity)} {r.item?.unit}</TableCell>
                    <TableCell>{r.quantity <= 0 ? <Badge variant="destructive">Out</Badge> : low ? <Badge variant="secondary">Low</Badge> : <Badge>OK</Badge>}</TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
                          <Pencil className="h-4 w-4 mr-1" />Set qty
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              {!filtered.length && (
                <TableRow><TableCell colSpan={canManage ? 5 : 4} className="text-center text-muted-foreground py-8">No stock recorded.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Set stock on hand</DialogTitle>
          </DialogHeader>
          {editRow && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                {editRow.item?.name} @ {editRow.location?.name} — current: {Number(editRow.quantity)} {editRow.item?.unit}
              </div>
              <div>
                <Label>New quantity</Label>
                <Input type="number" step="0.01" value={newQty} onChange={e => setNewQty(e.target.value)} />
              </div>
              <div>
                <Label>Notes (optional)</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Reason for adjustment" />
              </div>
              <p className="text-xs text-muted-foreground">
                An adjustment movement will be recorded for the audit trail.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)}>Cancel</Button>
            <Button onClick={saveQty} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Receive Inventory</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Item</Label>
              <Select
                value={receiveForm.item_id}
                onValueChange={v => {
                  const it = items.find(i => i.id === v);
                  setReceiveForm({
                    ...receiveForm,
                    item_id: v,
                    unit_price: receiveForm.unit_price || (it?.unit_cost != null ? String(it.unit_cost) : ''),
                  });
                }}
              >
                <SelectTrigger><SelectValue placeholder="Choose item" /></SelectTrigger>
                <SelectContent>
                  {items.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantity {selectedItem && <span className="text-xs text-muted-foreground">({selectedItem.unit})</span>}</Label>
              <Input
                type="number"
                step="0.01"
                value={receiveForm.quantity}
                onChange={e => setReceiveForm({ ...receiveForm, quantity: e.target.value })}
              />
            </div>
            <div>
              <Label>Unit cost</Label>
              <Input
                type="number"
                step="0.01"
                value={receiveForm.unit_price}
                onChange={e => setReceiveForm({ ...receiveForm, unit_price: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Label>Receive into</Label>
              <Select
                value={receiveForm.to_location_id}
                onValueChange={v => setReceiveForm({ ...receiveForm, to_location_id: v })}
              >
                <SelectTrigger><SelectValue placeholder="Choose warehouse" /></SelectTrigger>
                <SelectContent>
                  {(warehouses.length ? warehouses : locations).map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.name} ({l.kind})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Reference / PO #</Label>
              <Input
                value={receiveForm.reference}
                onChange={e => setReceiveForm({ ...receiveForm, reference: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={receiveForm.notes}
                onChange={e => setReceiveForm({ ...receiveForm, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiveOpen(false)}>Cancel</Button>
            <Button onClick={submitReceive} disabled={saving}>{saving ? 'Saving…' : 'Receive'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}