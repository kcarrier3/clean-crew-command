import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Building2, Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from './fetchAllRows';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { CrmCompany, CrmContact } from './types';
import { RelatedNotesFiles } from './RelatedNotesFiles';

const blank = { first_name: '', last_name: '', email: '', phone: '', title: '', company_id: '', notes: '', is_primary: false };

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: CrmContact | null;
  /** Preselect (and lock) the account, e.g. when adding from an account page. */
  defaultCompanyId?: string | null;
  lockCompany?: boolean;
  companies?: CrmCompany[];
  onSaved?: () => void;
}

export function AccountCombobox({ companies, value, onChange, disabled }: {
  companies: CrmCompany[]; value: string; onChange: (id: string) => void; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = companies.find(c => c.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" disabled={disabled}
                aria-expanded={open} className="w-full justify-between font-normal">
          <span className="flex items-center gap-2 truncate">
            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
            {selected ? selected.name : <span className="text-muted-foreground">Search accounts…</span>}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[280px]" align="start">
        <Command>
          <CommandInput placeholder="Type an account name…" />
          <CommandList>
            <CommandEmpty>No accounts match.</CommandEmpty>
            <CommandGroup>
              <CommandItem value="No account" onSelect={() => { onChange(''); setOpen(false); }}>
                <Check className={cn('mr-2 h-4 w-4', !value ? 'opacity-100' : 'opacity-0')} />
                <span className="text-muted-foreground">No account</span>
              </CommandItem>
              {companies.map(c => (
                <CommandItem key={c.id} value={c.name} onSelect={() => { onChange(c.id); setOpen(false); }}>
                  <Check className={cn('mr-2 h-4 w-4', value === c.id ? 'opacity-100' : 'opacity-0')} />
                  <span className="truncate">{c.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function ContactFormDialog({ open, onOpenChange, editing, defaultCompanyId, lockCompany, companies: companiesProp, onSaved }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [companies, setCompanies] = useState<CrmCompany[]>(companiesProp || []);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (companiesProp) setCompanies(companiesProp); }, [companiesProp]);

  useEffect(() => {
    if (companiesProp || !open) return;
    fetchAllRows('crm_companies', '*', { column: 'name' })
      .then((c: any) => setCompanies(c || []))
      .catch(() => setCompanies([]));
  }, [open, companiesProp]);

  useEffect(() => {
    if (!open) return;
    if (editing) setForm({
      first_name: editing.first_name, last_name: editing.last_name || '',
      email: editing.email || '', phone: editing.phone || '', title: editing.title || '',
      company_id: editing.company_id || '', notes: editing.notes || '', is_primary: editing.is_primary,
    });
    else setForm({ ...blank, company_id: defaultCompanyId || '' });
  }, [editing, open, defaultCompanyId]);

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
    else {
      payload.created_by = user?.id; payload.owner_id = user?.id;
      ({ error } = await (supabase as any).from('crm_contacts').insert(payload));
    }
    setSaving(false);
    if (error) { toast({ title: 'Save failed', description: error.message, variant: 'destructive' }); return; }
    toast({ title: editing ? 'Contact updated' : 'Contact created' });
    onOpenChange(false);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? 'Edit Contact' : 'New Contact'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>First Name *</Label><Input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} /></div>
            <div><Label>Last Name</Label><Input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} /></div>
          </div>
          <div><Label>Title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
          <div>
            <Label>Account</Label>
            <AccountCombobox
              companies={companies}
              value={form.company_id}
              disabled={lockCompany}
              onChange={v => setForm({ ...form, company_id: v })}
            />
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
        {editing && (
          <div className="border-t pt-3 mt-1 max-h-[45vh] overflow-y-auto">
            <RelatedNotesFiles parentType="contact" parentId={editing.id} />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
