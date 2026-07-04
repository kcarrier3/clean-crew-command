import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Mail, Phone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface CompanyContact {
  id: string;
  name: string;
  title: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  display_order: number;
}

const blank = { name: '', title: '', phone: '', email: '', notes: '', display_order: 0 };

export default function CompanyContactsAdmin() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<CompanyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CompanyContact | null>(null);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('company_contacts')
      .select('*')
      .order('display_order', { ascending: true })
      .order('name', { ascending: true });
    if (error) toast({ title: 'Failed to load', description: error.message, variant: 'destructive' });
    else setItems(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name,
        title: editing.title || '',
        phone: editing.phone || '',
        email: editing.email || '',
        notes: editing.notes || '',
        display_order: editing.display_order,
      });
    } else {
      setForm(blank);
    }
  }, [editing, open]);

  const save = async () => {
    if (!form.name.trim()) { toast({ title: 'Name required', variant: 'destructive' }); return; }
    setSaving(true);
    const payload: any = {
      name: form.name.trim(),
      title: form.title || null,
      phone: form.phone || null,
      email: form.email || null,
      notes: form.notes || null,
      display_order: Number(form.display_order) || 0,
    };
    let error;
    if (editing) {
      ({ error } = await (supabase as any).from('company_contacts').update(payload).eq('id', editing.id));
    } else {
      payload.created_by = user?.id;
      ({ error } = await (supabase as any).from('company_contacts').insert(payload));
    }
    setSaving(false);
    if (error) { toast({ title: 'Save failed', description: error.message, variant: 'destructive' }); return; }
    toast({ title: editing ? 'Contact updated' : 'Contact added' });
    setOpen(false); setEditing(null); load();
  };

  const remove = async (c: CompanyContact) => {
    if (!confirm(`Remove ${c.name} from directory?`)) return;
    const { error } = await (supabase as any).from('company_contacts').delete().eq('id', c.id);
    if (error) { toast({ title: 'Delete failed', description: error.message, variant: 'destructive' }); return; }
    load();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle>Contacts Directory</CardTitle>
            <CardDescription>
              Manage the points-of-contact shown to employees in the mobile app.
            </CardDescription>
          </div>
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Add Contact
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No contacts yet. Add your first contact to publish it to the app.</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {items.map(c => (
              <div key={c.id} className="border rounded-md p-3 flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{c.name}</p>
                  {c.title && <p className="text-xs text-muted-foreground">{c.title}</p>}
                  <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                    {c.phone && <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</div>}
                    {c.email && <div className="flex items-center gap-1 break-all"><Mail className="h-3 w-3 shrink-0" />{c.email}</div>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(c); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(c)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Edit Contact' : 'Add Contact'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Title / Role</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Janitorial Manager" /></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <div><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            <div><Label>Display Order</Label><Input type="number" value={form.display_order} onChange={e => setForm({ ...form, display_order: Number(e.target.value) })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}