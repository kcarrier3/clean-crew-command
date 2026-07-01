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
import { Plus, Pencil, Archive } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

type Asset = {
  id: string;
  name: string;
  asset_tag: string | null;
  category: string | null;
  serial_number: string | null;
  condition: string;
  quantity: number;
  purchase_date: string | null;
  purchase_cost: number | null;
  location_kind: string;
  job_site_id: string | null;
  notes: string | null;
  active: boolean;
};

type JobSite = { id: string; name: string };

const emptyForm = {
  name: '', asset_tag: '', category: '', serial_number: '',
  condition: 'good', quantity: '1', purchase_date: '', purchase_cost: '',
  location_kind: 'warehouse', job_site_id: '', notes: '',
};

export default function FixedAssetsTab({ canManage }: { canManage: boolean }) {
  const { toast } = useToast();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [jobSites, setJobSites] = useState<JobSite[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [filterSite, setFilterSite] = useState<string>('all');
  const [showInactive, setShowInactive] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = supabase.from('fixed_assets' as any).select('*').order('name');
    if (!showInactive) q = q.eq('active', true);
    const [{ data: a }, { data: js }] = await Promise.all([
      q,
      supabase.from('job_sites').select('id, name').eq('active', true).order('name'),
    ]);
    setAssets((a as any as Asset[]) || []);
    setJobSites((js as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [showInactive]);

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (a: Asset) => {
    setEditing(a);
    setForm({
      name: a.name, asset_tag: a.asset_tag || '', category: a.category || '',
      serial_number: a.serial_number || '', condition: a.condition,
      quantity: a.quantity.toString(),
      purchase_date: a.purchase_date || '',
      purchase_cost: a.purchase_cost?.toString() || '',
      location_kind: a.location_kind,
      job_site_id: a.job_site_id || '',
      notes: a.notes || '',
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name) { toast({ title: 'Name required', variant: 'destructive' }); return; }
    const payload: any = {
      name: form.name,
      asset_tag: form.asset_tag || null,
      category: form.category || null,
      serial_number: form.serial_number || null,
      condition: form.condition || 'good',
      quantity: Number(form.quantity) || 1,
      purchase_date: form.purchase_date || null,
      purchase_cost: form.purchase_cost ? Number(form.purchase_cost) : null,
      location_kind: form.location_kind,
      job_site_id: form.location_kind === 'account' ? (form.job_site_id || null) : null,
      notes: form.notes || null,
    };
    const { error } = editing
      ? await supabase.from('fixed_assets' as any).update(payload).eq('id', editing.id)
      : await supabase.from('fixed_assets' as any).insert(payload);
    if (error) { toast({ title: 'Save failed', description: error.message, variant: 'destructive' }); return; }
    toast({ title: editing ? 'Asset updated' : 'Asset added' });
    setOpen(false);
    load();
  };

  const retire = async (a: Asset) => {
    const { error } = await supabase.from('fixed_assets' as any)
      .update({ active: false, retired_at: new Date().toISOString() })
      .eq('id', a.id);
    if (error) { toast({ title: 'Failed', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Asset retired' });
    load();
  };

  const filtered = assets.filter(a =>
    filterSite === 'all' ? true :
    filterSite === 'warehouse' ? a.location_kind === 'warehouse' :
    filterSite === 'unassigned' ? !a.job_site_id && a.location_kind === 'account' :
    a.job_site_id === filterSite
  );

  const siteName = (id: string | null) => id ? jobSites.find(j => j.id === id)?.name || '—' : '—';
  const condBadge = (c: string) => {
    const variant = c === 'good' || c === 'new' ? 'default' : c === 'fair' ? 'secondary' : 'destructive';
    return <Badge variant={variant as any}>{c}</Badge>;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
        <div>
          <CardTitle>Fixed Assets</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Equipment placed at accounts — vacuums, carts, trash cans, etc.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filterSite} onValueChange={setFilterSite}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              <SelectItem value="warehouse">Warehouse</SelectItem>
              <SelectItem value="unassigned">Unassigned (account)</SelectItem>
              {jobSites.map(j => <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => setShowInactive(v => !v)}>
            {showInactive ? 'Hide retired' : 'Show retired'}
          </Button>
          {canManage && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Add asset</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>{editing ? 'Edit asset' : 'Add fixed asset'}</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2"><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Commercial Vacuum" /></div>
                  <div><Label>Asset tag</Label><Input value={form.asset_tag} onChange={e => setForm({ ...form, asset_tag: e.target.value })} /></div>
                  <div><Label>Category</Label><Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="Vacuum, Cart..." /></div>
                  <div><Label>Serial #</Label><Input value={form.serial_number} onChange={e => setForm({ ...form, serial_number: e.target.value })} /></div>
                  <div><Label>Quantity</Label><Input type="number" step="1" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} /></div>
                  <div>
                    <Label>Condition</Label>
                    <Select value={form.condition} onValueChange={v => setForm({ ...form, condition: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="good">Good</SelectItem>
                        <SelectItem value="fair">Fair</SelectItem>
                        <SelectItem value="poor">Poor</SelectItem>
                        <SelectItem value="broken">Broken</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Location type</Label>
                    <Select value={form.location_kind} onValueChange={v => setForm({ ...form, location_kind: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="warehouse">Warehouse</SelectItem>
                        <SelectItem value="account">At account</SelectItem>
                        <SelectItem value="truck">On truck</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.location_kind === 'account' && (
                    <div className="col-span-2">
                      <Label>Account</Label>
                      <Select value={form.job_site_id || 'none'} onValueChange={v => setForm({ ...form, job_site_id: v === 'none' ? '' : v })}>
                        <SelectTrigger><SelectValue placeholder="Choose account" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— None —</SelectItem>
                          {jobSites.map(j => <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div><Label>Purchase date</Label><Input type="date" value={form.purchase_date} onChange={e => setForm({ ...form, purchase_date: e.target.value })} /></div>
                  <div><Label>Purchase cost</Label><Input type="number" step="0.01" value={form.purchase_cost} onChange={e => setForm({ ...form, purchase_cost: e.target.value })} /></div>
                  <div className="col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={save}>{editing ? 'Save' : 'Add'}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <div className="text-sm text-muted-foreground">Loading…</div> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Tag</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Account</TableHead>
                {canManage && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(a => (
                <TableRow key={a.id} className={!a.active ? 'opacity-60' : ''}>
                  <TableCell className="font-medium">{a.name}{!a.active && <span className="ml-2 text-xs text-muted-foreground">(retired)</span>}</TableCell>
                  <TableCell className="text-muted-foreground">{a.asset_tag || '—'}</TableCell>
                  <TableCell>{a.category || '—'}</TableCell>
                  <TableCell className="text-right">{a.quantity}</TableCell>
                  <TableCell>{condBadge(a.condition)}</TableCell>
                  <TableCell className="capitalize">{a.location_kind}</TableCell>
                  <TableCell>{siteName(a.job_site_id)}</TableCell>
                  {canManage && (
                    <TableCell className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(a)}><Pencil className="h-4 w-4" /></Button>
                      {a.active && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon"><Archive className="h-4 w-4" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Retire this asset?</AlertDialogTitle>
                              <AlertDialogDescription>It will be hidden from the active list but kept for records.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => retire(a)}>Retire</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {!filtered.length && (
                <TableRow><TableCell colSpan={canManage ? 8 : 7} className="text-center text-muted-foreground py-8">No assets yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}