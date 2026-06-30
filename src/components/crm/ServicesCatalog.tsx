import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { CrmService } from './types';

export function ServicesCatalog() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [services, setServices] = useState<CrmService[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CrmService | null>(null);
  const [form, setForm] = useState({ name: '', description: '', category: '', unit: 'each', default_unit_price: 0, active: true });

  const load = async () => {
    const { data } = await (supabase as any).from('crm_services').select('*').order('name');
    setServices(data || []);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', description: '', category: '', unit: 'each', default_unit_price: 0, active: true });
    setOpen(true);
  };
  const openEdit = (s: CrmService) => {
    setEditing(s);
    setForm({
      name: s.name, description: s.description || '', category: s.category || '',
      unit: s.unit, default_unit_price: Number(s.default_unit_price), active: s.active,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast({ title: 'Name required', variant: 'destructive' }); return; }
    const payload: any = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      category: form.category.trim() || null,
      unit: form.unit.trim() || 'each',
      default_unit_price: form.default_unit_price,
      active: form.active,
    };
    if (editing) {
      const { error } = await (supabase as any).from('crm_services').update(payload).eq('id', editing.id);
      if (error) { toast({ title: 'Save failed', description: error.message, variant: 'destructive' }); return; }
    } else {
      payload.created_by = user?.id;
      const { error } = await (supabase as any).from('crm_services').insert(payload);
      if (error) { toast({ title: 'Save failed', description: error.message, variant: 'destructive' }); return; }
    }
    toast({ title: 'Service saved' });
    setOpen(false);
    load();
  };

  const filtered = services.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.category || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search services…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> New Service</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(s => (
          <Card key={s.id} className={!s.active ? 'opacity-60' : ''}>
            <CardContent className="p-4 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold">{s.name}</p>
                  {s.category && <Badge variant="outline" className="text-xs mt-1">{s.category}</Badge>}
                </div>
                <Button size="sm" variant="ghost" onClick={() => openEdit(s)}><Pencil className="h-3 w-3" /></Button>
              </div>
              {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
              <p className="text-sm font-medium">${Number(s.default_unit_price).toFixed(2)} <span className="text-xs text-muted-foreground">/ {s.unit}</span></p>
              {!s.active && <Badge variant="secondary">Inactive</Badge>}
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-full text-center py-8">
            No services yet. Add one to speed up quote creation.
          </p>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Service' : 'New Service'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Category</Label><Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="Janitorial, Construction…" /></div>
            <div><Label>Description</Label><Textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Unit</Label><Input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="hour, each, sq ft" /></div>
              <div><Label>Default Price</Label><Input type="number" step="0.01" value={form.default_unit_price} onChange={e => setForm({ ...form, default_unit_price: parseFloat(e.target.value) || 0 })} /></div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={v => setForm({ ...form, active: v })} />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}