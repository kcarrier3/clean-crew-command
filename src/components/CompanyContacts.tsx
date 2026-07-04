import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Mail, Phone, Trash2, User } from 'lucide-react';
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

export default function CompanyContacts() {
  const { user, isManager } = useAuth();
  const { toast } = useToast();
  const canEdit = isManager();
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
    if (error) {
      toast({ title: 'Failed to load contacts', description: error.message, variant: 'destructive' });
    } else {
      setItems(data || []);
    }
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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">Contacts</h2>
          <p className="text-sm text-muted-foreground">Quick access directory of your managers and points of contact.</p>
        </div>
        {canEdit && (
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Add Contact
          </Button>
        )}
      </div>

      {loading ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Loading…</CardContent></Card>
      ) : items.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          No contacts yet.{canEdit && ' Add your first contact to get started.'}
        </CardContent></Card>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {items.map(c => (
            <Card key={c.id}>
              <CardContent className="p-4 flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground shrink-0" />
                    <p className="font-medium truncate">{c.name}</p>
                  </div>
                  {c.title && <p className="text-xs text-muted-foreground mt-0.5 ml-6">{c.title}</p>}
                  <div className="mt-2 ml-6 space-y-1">
                    {c.phone && (
                      <a href={`tel:${c.phone}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
                        <Phone className="h-3.5 w-3.5" />{c.phone}
                      </a>
                    )}
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="flex items-center gap-2 text-sm text-primary hover:underline break-all">
                        <Mail className="h-3.5 w-3.5 shrink-0" />{c.email}
                      </a>
                    )}
                    {c.notes && <p className="text-xs text-muted-foreground mt-1">{c.notes}</p>}
                  </div>
                </div>
                {canEdit && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(c); setOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(c)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {canEdit && (
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
      )}
    </div>
  );
}