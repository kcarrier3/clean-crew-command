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
import { Plus, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

type Req = {
  id: string;
  status: string;
  quantity: number;
  notes: string | null;
  requested_at: string;
  fulfilled_at: string | null;
  item: { name: string; unit: string } | null;
  job_site: { name: string } | null;
  requested_by_profile: { first_name: string | null; last_name: string | null } | null;
};

export default function SupplyRequestsTab({ canManage }: { canManage: boolean }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<Req[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [jobSites, setJobSites] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ item_id: '', quantity: '1', job_site_id: '', notes: '' });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: rs }, { data: its }, { data: js }] = await Promise.all([
      supabase.from('supply_requests')
        .select('id, status, quantity, notes, requested_at, fulfilled_at, item:supply_items(name, unit), job_site:job_sites(name), requested_by_profile:profiles!supply_requests_requested_by_fkey(first_name, last_name)')
        .order('requested_at', { ascending: false }).limit(200),
      supabase.from('supply_items').select('id, name, unit').eq('active', true).order('name'),
      supabase.from('job_sites').select('id, name').eq('active', true).order('name'),
    ]);
    setRows((rs as any) || []);
    setItems(its || []);
    setJobSites(js || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!form.item_id || !Number(form.quantity)) { toast({ title: 'Item + quantity required', variant: 'destructive' }); return; }
    const { data: userRes } = await supabase.auth.getUser();
    const { error } = await supabase.from('supply_requests').insert({
      item_id: form.item_id,
      quantity: Number(form.quantity),
      job_site_id: form.job_site_id || null,
      notes: form.notes || null,
      requested_by: userRes.user?.id,
      status: 'approved',
    });
    if (error) { toast({ title: 'Failed', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Request logged' });
    setOpen(false);
    setForm({ item_id: '', quantity: '1', job_site_id: '', notes: '' });
    load();
  };

  const fulfill = async (id: string) => {
    const { data: userRes } = await supabase.auth.getUser();
    const { error } = await supabase.from('supply_requests').update({
      status: 'fulfilled', fulfilled_at: new Date().toISOString(), fulfilled_by: userRes.user?.id,
    }).eq('id', id);
    if (error) { toast({ title: 'Failed', description: error.message, variant: 'destructive' }); return; }
    load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Supply requests</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Request supplies</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Request supplies</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div>
                <Label>Item</Label>
                <Select value={form.item_id} onValueChange={v => setForm({ ...form, item_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Choose item" /></SelectTrigger>
                  <SelectContent>{items.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Quantity</Label><Input type="number" step="0.01" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} /></div>
              <div>
                <Label>For account (optional)</Label>
                <Select value={form.job_site_id || 'none'} onValueChange={v => setForm({ ...form, job_site_id: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {jobSites.map(j => <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={submit}>Submit</Button>
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
                <TableHead>Requested by</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Status</TableHead>
                {canManage && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(r.requested_at), 'MMM d, h:mm a')}</TableCell>
                  <TableCell>{[r.requested_by_profile?.first_name, r.requested_by_profile?.last_name].filter(Boolean).join(' ') || '—'}</TableCell>
                  <TableCell>{r.item?.name}</TableCell>
                  <TableCell className="text-right">{Number(r.quantity)} {r.item?.unit}</TableCell>
                  <TableCell>{r.job_site?.name || '—'}</TableCell>
                  <TableCell><Badge variant={r.status === 'fulfilled' ? 'default' : 'secondary'}>{r.status}</Badge></TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      {r.status !== 'fulfilled' && (
                        <Button size="sm" variant="outline" onClick={() => fulfill(r.id)}><Check className="h-4 w-4 mr-1" />Mark fulfilled</Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {!rows.length && (
                <TableRow><TableCell colSpan={canManage ? 7 : 6} className="text-center text-muted-foreground py-8">No requests yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}