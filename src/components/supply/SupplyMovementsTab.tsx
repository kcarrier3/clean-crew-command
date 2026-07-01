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
import { PackagePlus, Truck, ShoppingCart, Sliders } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

type Movement = {
  id: string;
  movement_type: 'receive' | 'transfer' | 'sell' | 'adjust';
  quantity: number;
  unit_price: number | null;
  total_value: number | null;
  reference: string | null;
  notes: string | null;
  created_at: string;
  item: { name: string; unit: string } | null;
  from_location: { name: string } | null;
  to_location: { name: string } | null;
  job_site: { name: string } | null;
};

type Item = { id: string; name: string; unit: string; unit_cost: number | null; sale_price: number | null };
type Location = { id: string; name: string; kind: string };
type JobSite = { id: string; name: string };

type FormType = 'receive' | 'transfer' | 'sell' | 'adjust';

const empty = (t: FormType) => ({
  movement_type: t,
  item_id: '',
  from_location_id: '',
  to_location_id: '',
  quantity: '1',
  unit_price: '',
  job_site_id: '',
  reference: '',
  notes: '',
});

export default function SupplyMovementsTab({ canManage }: { canManage: boolean }) {
  const { toast } = useToast();
  const [movements, setMovements] = useState<Movement[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [jobSites, setJobSites] = useState<JobSite[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty('receive'));
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: mv }, { data: its }, { data: locs }, { data: js }] = await Promise.all([
      supabase.from('supply_movements')
        .select('id, movement_type, quantity, unit_price, total_value, reference, notes, created_at, item:supply_items(name, unit), from_location:supply_locations!supply_movements_from_location_id_fkey(name), to_location:supply_locations!supply_movements_to_location_id_fkey(name), job_site:job_sites(name)')
        .order('created_at', { ascending: false }).limit(200),
      supabase.from('supply_items').select('id, name, unit, unit_cost, sale_price').eq('active', true).order('name'),
      supabase.from('supply_locations').select('id, name, kind').eq('active', true).order('name'),
      supabase.from('job_sites').select('id, name').eq('active', true).order('name'),
    ]);
    setMovements((mv as any) || []);
    setItems((its as any) || []);
    setLocations((locs as any) || []);
    setJobSites((js as any) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openFor = (t: FormType) => {
    const warehouse = locations.find(l => l.kind === 'warehouse');
    setForm({
      ...empty(t),
      from_location_id: t === 'receive' ? '' : warehouse?.id || '',
      to_location_id: t === 'receive' ? warehouse?.id || '' : '',
    });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.item_id || !form.quantity || Number(form.quantity) <= 0) {
      toast({ title: 'Item and positive quantity required', variant: 'destructive' }); return;
    }
    const t: FormType = form.movement_type;
    const payload: any = {
      item_id: form.item_id,
      movement_type: t,
      quantity: Number(form.quantity),
      reference: form.reference || null,
      notes: form.notes || null,
    };
    if (t === 'receive') {
      if (!form.to_location_id) { toast({ title: 'Destination required', variant: 'destructive' }); return; }
      payload.to_location_id = form.to_location_id;
      payload.unit_price = form.unit_price ? Number(form.unit_price) : null;
      if (payload.unit_price != null) payload.total_value = payload.unit_price * payload.quantity;
    } else if (t === 'transfer') {
      if (!form.from_location_id || !form.to_location_id) { toast({ title: 'From and to required', variant: 'destructive' }); return; }
      payload.from_location_id = form.from_location_id;
      payload.to_location_id = form.to_location_id;
    } else if (t === 'sell') {
      if (!form.from_location_id) { toast({ title: 'Source required', variant: 'destructive' }); return; }
      payload.from_location_id = form.from_location_id;
      payload.job_site_id = form.job_site_id || null;
      payload.unit_price = form.unit_price ? Number(form.unit_price) : null;
      if (payload.unit_price != null) payload.total_value = payload.unit_price * payload.quantity;
    } else if (t === 'adjust') {
      // For adjust: positive quantity adds to to_location, negative to from_location
      if (form.to_location_id) payload.to_location_id = form.to_location_id;
      if (form.from_location_id) payload.from_location_id = form.from_location_id;
      if (!payload.to_location_id && !payload.from_location_id) {
        toast({ title: 'Choose a location', variant: 'destructive' }); return;
      }
    }
    const { data: userRes } = await supabase.auth.getUser();
    payload.created_by = userRes.user?.id;
    const { error } = await supabase.from('supply_movements').insert(payload);
    if (error) { toast({ title: 'Failed', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Recorded' });
    setOpen(false);
    load();
  };

  const t: FormType = form.movement_type;
  const showFrom = t === 'transfer' || t === 'sell' || t === 'adjust';
  const showTo = t === 'receive' || t === 'transfer' || t === 'adjust';
  const showPrice = t === 'receive' || t === 'sell';
  const showJobSite = t === 'sell';

  const badge = (mt: string) => {
    const map: Record<string, any> = {
      receive: 'default', transfer: 'secondary', sell: 'default', adjust: 'outline',
    };
    return <Badge variant={map[mt] || 'default'}>{mt}</Badge>;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
        <CardTitle>Movements</CardTitle>
        {canManage && (
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => openFor('receive')}><PackagePlus className="h-4 w-4 mr-2" />Receive</Button>
            <Button variant="outline" onClick={() => openFor('transfer')}><Truck className="h-4 w-4 mr-2" />Load truck</Button>
            <Button variant="outline" onClick={() => openFor('sell')}><ShoppingCart className="h-4 w-4 mr-2" />Sell</Button>
            <Button variant="outline" onClick={() => openFor('adjust')}><Sliders className="h-4 w-4 mr-2" />Adjust</Button>
          </div>
        )}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle className="capitalize">{t}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Item</Label>
                <Select value={form.item_id} onValueChange={v => setForm({ ...form, item_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Choose item" /></SelectTrigger>
                  <SelectContent>{items.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Quantity</Label><Input type="number" step="0.01" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} /></div>
              {showPrice && <div><Label>Unit price</Label><Input type="number" step="0.01" value={form.unit_price} onChange={e => setForm({ ...form, unit_price: e.target.value })} /></div>}
              {showFrom && (
                <div className="col-span-2">
                  <Label>From location</Label>
                  <Select value={form.from_location_id} onValueChange={v => setForm({ ...form, from_location_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Choose source" /></SelectTrigger>
                    <SelectContent>{locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name} ({l.kind})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              {showTo && (
                <div className="col-span-2">
                  <Label>To location</Label>
                  <Select value={form.to_location_id} onValueChange={v => setForm({ ...form, to_location_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Choose destination" /></SelectTrigger>
                    <SelectContent>{locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name} ({l.kind})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              {showJobSite && (
                <div className="col-span-2">
                  <Label>Sold to account</Label>
                  <Select value={form.job_site_id || 'none'} onValueChange={v => setForm({ ...form, job_site_id: v === 'none' ? '' : v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {jobSites.map(j => <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="col-span-2"><Label>Reference / PO #</Label><Input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} /></div>
              <div className="col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={submit}>Record</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? <div className="text-sm text-muted-foreground">Loading…</div> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>From → To</TableHead>
                <TableHead>Account</TableHead>
                <TableHead className="text-right">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.map(m => (
                <TableRow key={m.id}>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(m.created_at), 'MMM d, h:mm a')}</TableCell>
                  <TableCell>{badge(m.movement_type)}</TableCell>
                  <TableCell>{m.item?.name}</TableCell>
                  <TableCell className="text-right">{Number(m.quantity)} {m.item?.unit}</TableCell>
                  <TableCell className="text-sm">{m.from_location?.name || '—'} → {m.to_location?.name || '—'}</TableCell>
                  <TableCell className="text-sm">{m.job_site?.name || '—'}</TableCell>
                  <TableCell className="text-right">{m.total_value != null ? `$${Number(m.total_value).toFixed(2)}` : '—'}</TableCell>
                </TableRow>
              ))}
              {!movements.length && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No movements yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}