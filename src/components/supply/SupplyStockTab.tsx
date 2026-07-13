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
import { Pencil } from 'lucide-react';
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

export default function SupplyStockTab() {
  const { isManager } = useAuth();
  const canManage = isManager();
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [locFilter, setLocFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [editRow, setEditRow] = useState<Row | null>(null);
  const [newQty, setNewQty] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: stock }, { data: locs }] = await Promise.all([
      supabase
        .from('supply_stock')
        .select('item_id, location_id, quantity, item:supply_items(name, sku, unit, reorder_point, kind), location:supply_locations(name, kind)')
        .order('quantity', { ascending: false }),
      supabase.from('supply_locations').select('id, name, kind').eq('active', true).order('name'),
    ]);
    setRows((stock as any) || []);
    setLocations((locs as Location[]) || []);
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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Stock on hand</CardTitle>
        <div className="w-56">
          <Select value={locFilter} onValueChange={setLocFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name} ({l.kind})</SelectItem>)}
            </SelectContent>
          </Select>
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
    </Card>
  );
}