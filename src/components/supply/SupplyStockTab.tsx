import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

type Row = {
  item_id: string;
  location_id: string;
  quantity: number;
  item: { name: string; sku: string | null; unit: string; reorder_point: number | null; kind: string } | null;
  location: { name: string; kind: string } | null;
};

type Location = { id: string; name: string; kind: string };

export default function SupplyStockTab() {
  const [rows, setRows] = useState<Row[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [locFilter, setLocFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

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
                  </TableRow>
                );
              })}
              {!filtered.length && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No stock recorded.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}