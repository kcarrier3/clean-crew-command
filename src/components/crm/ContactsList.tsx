import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Pencil, Mail, Phone, Trash2, Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { CrmCompany, CrmContact } from './types';

const blank = { first_name: '', last_name: '', email: '', phone: '', title: '', company_id: '', notes: '', is_primary: false };

export function ContactsList({ onChanged }: { onChanged?: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<CrmContact[]>([]);
  const [companies, setCompanies] = useState<CrmCompany[]>([]);
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CrmContact | null>(null);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [{ data: c }, { data: co }] = await Promise.all([
      (supabase as any).from('crm_contacts').select('*').order('last_name', { nullsFirst: false }),
      (supabase as any).from('crm_companies').select('*').order('name'),
    ]);
    setItems(c || []); setCompanies(co || []);
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (editing) setForm({
      first_name: editing.first_name, last_name: editing.last_name || '',
      email: editing.email || '', phone: editing.phone || '', title: editing.title || '',
      company_id: editing.company_id || '', notes: editing.notes || '', is_primary: editing.is_primary,
    });
    else setForm(blank);
  }, [editing, open]);

  const save = async () => {
    if (!form.first_name.trim()) { toast({ title: 'First name required', variant: 'destructive' }); return; }
    setSaving(true);
    const payload: any = {
      first_name: form.first_name.trim(),
      last_name: form.last_name || null,
      email: form.email || null,
      phone: form.phone || null,
      title: form.title || null,
      company_id: form.company_id || null,
      notes: form.notes || null,
      is_primary: form.is_primary,
    };
    let error;
    if (editing) ({ error } = await (supabase as any).from('crm_contacts').update(payload).eq('id', editing.id));
    else { payload.created_by = user?.id; payload.owner_id = user?.id; ({ error } = await (supabase as any).from('crm_contacts').insert(payload)); }
    setSaving(false);
    if (error) { toast({ title: 'Save failed', description: error.message, variant: 'destructive' }); return; }
    toast({ title: editing ? 'Contact updated' : 'Contact created' });
    setOpen(false); setEditing(null); load(); onChanged?.();
  };

  const remove = async (c: CrmContact) => {
    if (!confirm(`Delete ${c.first_name}?`)) return;
    const { error } = await (supabase as any).from('crm_contacts').delete().eq('id', c.id);
    if (error) { toast({ title: 'Delete failed', description: error.message, variant: 'destructive' }); return; }
    load(); onChanged?.();
  };

  const companyName = (id: string | null) => companies.find(c => c.id === id)?.name;

  const filtered = items.filter(c => {
    if (!filter) return true;
    const f = filter.toLowerCase();
    return `${c.first_name} ${c.last_name || ''}`.toLowerCase().includes(f)
      || c.email?.toLowerCase().includes(f)
      || companyName(c.company_id)?.toLowerCase().includes(f);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <Input placeholder="Search contacts…" value={filter} onChange={e => setFilter(e.target.value)} className="max-w-xs" />
        <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4 mr-2" /> New Contact</Button>
      </div>
      {filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">No contacts yet.</CardContent></Card>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {filtered.map(c => (
            <Card key={c.id}>
              <CardContent className="p-4 flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium">{c.first_name} {c.last_name}</p>
                    {c.is_primary && <Badge variant="secondary" className="text-xs"><Star className="h-3 w-3 mr-1" />Primary</Badge>}
                  </div>
                  {c.title && <p className="text-xs text-muted-foreground">{c.title}{c.company_id && ` • ${companyName(c.company_id)}`}</p>}
                  {!c.title && c.company_id && <p className="text-xs text-muted-foreground">{companyName(c.company_id)}</p>}
                  <div className="flex gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                    {c.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>}
                    {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(c); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(c)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Edit Contact' : 'New Contact'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>First Name *</Label><Input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} /></div>
              <div><Label>Last Name</Label><Input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} /></div>
            </div>
            <div><Label>Title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div>
              <Label>Company</Label>
              <Select value={form.company_id || 'none'} onValueChange={v => setForm({ ...form, company_id: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.is_primary} onCheckedChange={v => setForm({ ...form, is_primary: !!v })} />
              Primary contact
            </label>
            <div><Label>Notes</Label><Textarea rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}