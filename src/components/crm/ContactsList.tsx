import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Pencil, Mail, Phone, Trash2, Star, ArrowRightLeft, Camera } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from './fetchAllRows';
import { moveContactsToAccount } from './mergeUtils';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { CrmCompany, CrmContact } from './types';
import { BusinessCardScanDialog } from './BusinessCardScanDialog';
import { ContactFormDialog } from './ContactFormDialog';

export function ContactsList({ onChanged }: { onChanged?: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState<CrmContact[]>([]);
  const [companies, setCompanies] = useState<CrmCompany[]>([]);
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CrmContact | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [moveTo, setMoveTo] = useState('');
  const [moving, setMoving] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  const load = async () => {
    const [{ data: c }, co] = await Promise.all([
      (supabase as any).from('crm_contacts').select('*').order('last_name', { nullsFirst: false }),
      fetchAllRows('crm_companies', '*', { column: 'name' }).catch(() => []),
    ]);
    setItems(c || []); setCompanies(co || []);
  };
  useEffect(() => { load(); }, []);

  const remove = async (c: CrmContact) => {
    if (!confirm(`Delete ${c.first_name}?`)) return;
    const { error } = await (supabase as any).from('crm_contacts').delete().eq('id', c.id);
    if (error) { toast({ title: 'Delete failed', description: error.message, variant: 'destructive' }); return; }
    load(); onChanged?.();
  };

  const companyName = (id: string | null) => companies.find(c => c.id === id)?.name;

  const moveSelected = async () => {
    if (!selected.length || !moveTo) return;
    setMoving(true);
    try {
      await moveContactsToAccount(selected, moveTo === 'none' ? null : moveTo);
      toast({ title: `Moved ${selected.length} contact(s)` });
      setSelected([]); setMoveTo('');
      load(); onChanged?.();
    } catch (e: any) {
      toast({ title: 'Move failed', description: e.message, variant: 'destructive' });
    } finally { setMoving(false); }
  };

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
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setScanOpen(true)}><Camera className="h-4 w-4 mr-2" /> Scan Card</Button>
          <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4 mr-2" /> New Contact</Button>
        </div>
      </div>
      <BusinessCardScanDialog open={scanOpen} onOpenChange={setScanOpen} onSaved={() => { load(); onChanged?.(); }} />
      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/40 px-3 py-2">
          <span className="text-sm text-muted-foreground">{selected.length} selected</span>
          <Select value={moveTo} onValueChange={setMoveTo}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Move to account…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No account</SelectItem>
              {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" disabled={!moveTo || moving} onClick={moveSelected}>
            <ArrowRightLeft className="h-4 w-4 mr-2" />{moving ? 'Moving…' : 'Move'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected([])}>Clear</Button>
        </div>
      )}
      {filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">No contacts yet.</CardContent></Card>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {filtered.map(c => (
            <Card key={c.id}>
              <CardContent className="p-4 flex items-start justify-between gap-2">
                <div className="pt-0.5">
                  <Checkbox
                    checked={selected.includes(c.id)}
                    onCheckedChange={v => setSelected(s => (v ? [...s, c.id] : s.filter(x => x !== c.id)))}
                  />
                </div>
                <div
                  className="min-w-0 flex-1 cursor-pointer"
                  onClick={() => navigate(`/crm/contacts/${c.id}`)}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium hover:underline">{c.first_name} {c.last_name}</p>
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

      <ContactFormDialog
        open={open}
        onOpenChange={v => { setOpen(v); if (!v) setEditing(null); }}
        editing={editing}
        companies={companies}
        onSaved={() => { load(); onChanged?.(); }}
      />
    </div>
  );
}