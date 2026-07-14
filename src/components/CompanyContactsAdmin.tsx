import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Mail, Phone, Users } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { DIRECTORY_CATEGORIES, categoryLabel } from '@/lib/directoryCategories';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CompanyContact {
  id: string;
  name: string;
  title: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  display_order: number;
  category: string | null;
}

const blank = { name: '', title: '', phone: '', email: '', notes: '', display_order: 0, category: '' };

const MANAGER_TITLES = ['Owner', 'Administrator', 'Janitorial Manager', 'Project Crew Lead'];

interface EmployeeOption {
  id: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
}

export default function CompanyContactsAdmin() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<CompanyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CompanyContact | null>(null);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignContact, setAssignContact] = useState<CompanyContact | null>(null);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignSearch, setAssignSearch] = useState('');

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
        category: editing.category || '',
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
      category: form.category || null,
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

  const openAssign = async (c: CompanyContact) => {
    setAssignContact(c);
    setAssignOpen(true);
    setAssignSearch('');

    const [{ data: emps }, { data: existing }] = await Promise.all([
      (supabase as any)
        .from('profiles')
        .select('id, first_name, last_name, job_title')
        .eq('active', true)
        .order('last_name'),
      (supabase as any)
        .from('company_contact_assignments')
        .select('employee_id')
        .eq('contact_id', c.id),
    ]);

    setEmployees((emps || []).filter((e: EmployeeOption) => !MANAGER_TITLES.includes(e.job_title || '')));
    setAssignedIds(new Set((existing || []).map((r: any) => r.employee_id)));
  };

  const toggleAssigned = (empId: string) => {
    setAssignedIds(prev => {
      const next = new Set(prev);
      if (next.has(empId)) next.delete(empId); else next.add(empId);
      return next;
    });
  };

  const saveAssignments = async () => {
    if (!assignContact) return;
    setAssignSaving(true);
    // Simple approach: replace all assignments for this contact
    const { error: delErr } = await (supabase as any)
      .from('company_contact_assignments')
      .delete()
      .eq('contact_id', assignContact.id);
    if (delErr) {
      setAssignSaving(false);
      toast({ title: 'Failed to save', description: delErr.message, variant: 'destructive' });
      return;
    }
    if (assignedIds.size > 0) {
      const rows = Array.from(assignedIds).map(empId => ({
        contact_id: assignContact.id,
        employee_id: empId,
        created_by: user?.id,
      }));
      const { error: insErr } = await (supabase as any)
        .from('company_contact_assignments')
        .insert(rows);
      if (insErr) {
        setAssignSaving(false);
        toast({ title: 'Failed to save', description: insErr.message, variant: 'destructive' });
        return;
      }
    }
    setAssignSaving(false);
    setAssignOpen(false);
    setAssignContact(null);
    toast({ title: 'Assignments updated' });
  };

  const filteredEmployees = employees.filter(e => {
    const q = assignSearch.trim().toLowerCase();
    if (!q) return true;
    return `${e.first_name} ${e.last_name} ${e.job_title || ''}`.toLowerCase().includes(q);
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle>Contacts Directory</CardTitle>
            <CardDescription>
              Manage the points-of-contact shown to employees. Managers and admins always see every contact.
              For non-manager staff, assign the specific contacts each person should see.
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
                  <Button size="sm" variant="ghost" title="Assign to employees" onClick={() => openAssign(c)}><Users className="h-4 w-4" /></Button>
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

      <Dialog open={assignOpen} onOpenChange={(o) => { setAssignOpen(o); if (!o) setAssignContact(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign "{assignContact?.name}" to employees</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Managers and admins always see every contact. Select which non-manager employees should see this one.
            </p>
            <Input
              placeholder="Search employees…"
              value={assignSearch}
              onChange={(e) => setAssignSearch(e.target.value)}
            />
            <div className="flex justify-between text-xs">
              <button
                className="text-primary hover:underline"
                onClick={() => setAssignedIds(new Set(filteredEmployees.map(e => e.id)))}
                type="button"
              >Select all</button>
              <button
                className="text-muted-foreground hover:underline"
                onClick={() => setAssignedIds(new Set())}
                type="button"
              >Clear</button>
            </div>
            <ScrollArea className="h-72 border rounded-md">
              <div className="p-2 space-y-1">
                {filteredEmployees.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">No employees found.</p>
                )}
                {filteredEmployees.map(e => (
                  <label
                    key={e.id}
                    className="flex items-center gap-2 p-2 rounded hover:bg-accent cursor-pointer"
                  >
                    <Checkbox
                      checked={assignedIds.has(e.id)}
                      onCheckedChange={() => toggleAssigned(e.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{e.first_name} {e.last_name}</p>
                      {e.job_title && <p className="text-xs text-muted-foreground truncate">{e.job_title}</p>}
                    </div>
                  </label>
                ))}
              </div>
            </ScrollArea>
            <p className="text-xs text-muted-foreground">{assignedIds.size} selected</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)} disabled={assignSaving}>Cancel</Button>
            <Button onClick={saveAssignments} disabled={assignSaving}>{assignSaving ? 'Saving…' : 'Save assignments'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}