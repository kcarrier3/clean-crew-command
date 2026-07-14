import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Globe, Phone, MapPin, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { CrmCompany } from './types';
import { CompanyDetailDialog } from './CompanyDetailDialog';

interface Props { onChanged?: () => void; }

const blank = { name: '', industry: '', website: '', phone: '', address: '', city: '', state: '', zip: '', notes: '' };

export function CompaniesList({ onChanged }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<CrmCompany[]>([]);
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CrmCompany | null>(null);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailCompany, setDetailCompany] = useState<CrmCompany | null>(null);

  const load = async () => {
    const { data, error } = await (supabase as any).from('crm_companies').select('*').order('name');
    if (error) toast({ title: 'Failed to load companies', description: error.message, variant: 'destructive' });
    setItems(data || []);
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name, industry: editing.industry || '', website: editing.website || '',
        phone: editing.phone || '', address: editing.address || '', city: editing.city || '',
        state: editing.state || '', zip: editing.zip || '', notes: editing.notes || '',
      });
    } else setForm(blank);
  }, [editing, open]);

  const save = async () => {
    if (!form.name.trim()) { toast({ title: 'Name required', variant: 'destructive' }); return; }
    setSaving(true);
    const payload: any = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, k === 'name' ? v.trim() : (v || null)])
    );
    let error;
    if (editing) ({ error } = await (supabase as any).from('crm_companies').update(payload).eq('id', editing.id));
    else { payload.created_by = user?.id; payload.owner_id = user?.id; ({ error } = await (supabase as any).from('crm_companies').insert(payload)); }
    setSaving(false);
    if (error) { toast({ title: 'Save failed', description: error.message, variant: 'destructive' }); return; }
    toast({ title: editing ? 'Company updated' : 'Company created' });
    setOpen(false); setEditing(null); load(); onChanged?.();
  };

  const remove = async (c: CrmCompany) => {
    if (!confirm(`Delete ${c.name}?`)) return;
    const { error } = await (supabase as any).from('crm_companies').delete().eq('id', c.id);
    if (error) { toast({ title: 'Delete failed', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Company deleted' });
    load(); onChanged?.();
  };

  const filtered = items.filter(c =>
    !filter || c.name.toLowerCase().includes(filter.toLowerCase()) || c.industry?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <Input placeholder="Search companies…" value={filter} onChange={e => setFilter(e.target.value)} className="max-w-xs" />
        <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4 mr-2" /> New Company</Button>
      </div>
      {filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">No companies yet.</CardContent></Card>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {filtered.map(c => (
            <Card
              key={c.id}
              className="cursor-pointer hover:shadow-md transition"
              onClick={() => { setDetailCompany(c); setDetailOpen(true); }}
            >
              <CardContent className="p-4 flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{c.name}</p>
                  {c.industry && <p className="text-xs text-muted-foreground">{c.industry}</p>}
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
                    {c.website && <span className="flex items-center gap-1"><Globe className="h-3 w-3" />{c.website}</span>}
                    {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                    {(c.city || c.state) && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{[c.city, c.state].filter(Boolean).join(', ')}</span>}
                  </div>
                </div>
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
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
          <DialogHeader><DialogTitle>{editing ? 'Edit Company' : 'New Company'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Industry</Label><Input value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} /></div>
              <div><Label>Website</Label><Input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} /></div>
            </div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>Address</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>City</Label><Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></div>
              <div><Label>State</Label><Input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} /></div>
              <div><Label>Zip</Label><Input value={form.zip} onChange={e => setForm({ ...form, zip: e.target.value })} /></div>
            </div>
            <div><Label>Notes</Label><Textarea rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CompanyDetailDialog
        company={detailCompany}
        open={detailOpen}
        onOpenChange={(o) => { setDetailOpen(o); if (!o) setDetailCompany(null); }}
        onChanged={() => { load(); onChanged?.(); }}
      />
    </div>
  );
}