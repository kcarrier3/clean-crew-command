import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type Loc = { id: string; name: string; kind: 'warehouse' | 'truck' | 'account'; active: boolean; job_site_id: string | null };

export default function SupplyLocationsTab() {
  const { toast } = useToast();
  const [locs, setLocs] = useState<Loc[]>([]);
  const [jobSites, setJobSites] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ name: '', kind: 'truck', job_site_id: '' });

  const load = async () => {
    const [{ data: ls }, { data: js }] = await Promise.all([
      supabase.from('supply_locations').select('*').order('kind').order('name'),
      supabase.from('job_sites').select('id, name').eq('active', true).order('name'),
    ]);
    setLocs((ls as any) || []);
    setJobSites(js || []);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name) { toast({ title: 'Name required', variant: 'destructive' }); return; }
    const { error } = await supabase.from('supply_locations').insert({
      name: form.name, kind: form.kind,
      job_site_id: form.kind === 'account' ? form.job_site_id || null : null,
    });
    if (error) { toast({ title: 'Failed', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Location added' });
    setOpen(false); setForm({ name: '', kind: 'truck', job_site_id: '' });
    load();
  };

  const toggle = async (l: Loc) => {
    await supabase.from('supply_locations').update({ active: !l.active }).eq('id', l.id);
    load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Locations</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New location</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New location</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div>
                <Label>Kind</Label>
                <Select value={form.kind} onValueChange={v => setForm({ ...form, kind: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warehouse">Warehouse</SelectItem>
                    <SelectItem value="truck">Truck</SelectItem>
                    <SelectItem value="account">Account / Customer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.kind === 'account' && (
                <div>
                  <Label>Linked account</Label>
                  <Select value={form.job_site_id || 'none'} onValueChange={v => setForm({ ...form, job_site_id: v === 'none' ? '' : v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {jobSites.map(j => <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {locs.map(l => (
              <TableRow key={l.id}>
                <TableCell className="font-medium">{l.name}</TableCell>
                <TableCell><Badge variant="secondary">{l.kind}</Badge></TableCell>
                <TableCell>{l.active ? <Badge>Active</Badge> : <Badge variant="outline">Inactive</Badge>}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => toggle(l)}>{l.active ? 'Deactivate' : 'Activate'}</Button>
                </TableCell>
              </TableRow>
            ))}
            {!locs.length && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No locations yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}