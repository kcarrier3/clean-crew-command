import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Upload, FileText, Trash2, Download, Briefcase, Check, ChevronDown, ChevronRight, ChevronsUpDown, Building2, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { LEAD_SOURCES, LEAD_STATUS_LABELS, type CrmLead, type CrmStage, type CrmCompany, type CrmContact } from './types';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: CrmLead | null;
  onSaved?: () => void;
}

export function LeadDialog({ open, onOpenChange, lead, onSaved }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('details');
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState('');
  const [newNoteCategory, setNewNoteCategory] = useState<string>('general');
  const [files, setFiles] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [stages, setStages] = useState<CrmStage[]>([]);
  const [companies, setCompanies] = useState<CrmCompany[]>([]);
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [owner, setOwner] = useState<{ full_name: string | null } | null>(null);
  const [addlOpen, setAddlOpen] = useState(true);
  const [sysOpen, setSysOpen] = useState(true);
  const [form, setForm] = useState({
    company_id: '',
    company_name: '',
    primary_contact_id: '',
    contact_name: '',
    email: '',
    phone: '',
    source: '',
    status: 'new' as CrmLead['status'],
    close_date: '',
    amount: '',
    probability: '',
    type: '',
    follow_up: false,
    description: '',
    next_step: '',
    stage_id: '' as string,
  });

  useEffect(() => {
    if (lead) {
      setForm({
        company_id: lead.company_id || '',
        company_name: lead.company_name || '',
        primary_contact_id: lead.primary_contact_id || '',
        contact_name: lead.contact_name || '',
        email: lead.email || '',
        phone: lead.phone || '',
        source: lead.source || '',
        status: lead.status,
        close_date: lead.close_date || '',
        amount: lead.amount != null ? String(lead.amount) : '',
        probability: lead.probability != null ? String(lead.probability) : '',
        type: lead.type || '',
        follow_up: !!lead.follow_up,
        description: lead.description || '',
        next_step: lead.next_step || '',
        stage_id: lead.stage_id || '',
      });
    } else {
      setForm({
        company_id: '', company_name: '', primary_contact_id: '', contact_name: '', email: '', phone: '', source: '', status: 'new',
        close_date: '', amount: '', probability: '', type: '', follow_up: false, description: '', next_step: '', stage_id: '',
      });
    }
  }, [lead, open]);

  useEffect(() => {
    if (open) { loadStages(); loadCompanies(); loadContacts(); }
    if (open && lead?.id) {
      loadNotes();
      loadFiles();
      loadOwner();
    } else {
      setNotes([]);
      setFiles([]);
      setOwner(null);
      setTab('details');
    }
  }, [open, lead?.id]);

  const loadStages = async () => {
    const { data } = await (supabase as any)
      .from('crm_pipeline_stages').select('*').eq('active', true).order('sort_order');
    setStages(data || []);
  };

  const loadCompanies = async () => {
    const { data } = await (supabase as any)
      .from('crm_companies').select('*').order('name');
    setCompanies(data || []);
  };

  const loadContacts = async () => {
    const { data } = await (supabase as any)
      .from('crm_contacts').select('*').order('last_name', { nullsFirst: false });
    setContacts(data || []);
  };

  const loadOwner = async () => {
    const ownerId = lead?.assigned_to || lead?.created_by;
    if (!ownerId) { setOwner(null); return; }
    const { data } = await (supabase as any)
      .from('profiles').select('full_name').eq('id', ownerId).maybeSingle();
    setOwner(data);
  };

  const loadNotes = async () => {
    if (!lead?.id) return;
    const { data } = await (supabase as any)
      .from('crm_lead_notes').select('*').eq('lead_id', lead.id).order('created_at', { ascending: false });
    setNotes(data || []);
  };

  const loadFiles = async () => {
    if (!lead?.id) return;
    const { data } = await (supabase as any)
      .from('crm_lead_files').select('*').eq('lead_id', lead.id).order('created_at', { ascending: false });
    setFiles(data || []);
  };

  const addNote = async () => {
    if (!lead?.id || !newNote.trim()) return;
    const { error } = await (supabase as any).from('crm_lead_notes').insert({
      lead_id: lead.id, content: newNote.trim(), category: newNoteCategory, created_by: user?.id,
    });
    if (error) { toast({ title: 'Failed to add note', description: error.message, variant: 'destructive' }); return; }
    setNewNote('');
    setNewNoteCategory('general');
    loadNotes();
  };

  const deleteNote = async (id: string) => {
    if (!confirm('Delete this note?')) return;
    const { error } = await (supabase as any).from('crm_lead_notes').delete().eq('id', id);
    if (error) { toast({ title: 'Failed to delete', description: error.message, variant: 'destructive' }); return; }
    loadNotes();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !lead?.id) return;
    if (file.size > 25 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 25MB', variant: 'destructive' });
      return;
    }
    setUploading(true);
    const path = `crm-leads/${lead.id}/${crypto.randomUUID()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from('crm-files').upload(path, file);
    if (upErr) {
      setUploading(false);
      toast({ title: 'Upload failed', description: upErr.message, variant: 'destructive' });
      return;
    }
    const { error } = await (supabase as any).from('crm_lead_files').insert({
      lead_id: lead.id, file_path: path, file_name: file.name, file_size: file.size,
      content_type: file.type, uploaded_by: user?.id,
    });
    setUploading(false);
    e.target.value = '';
    if (error) { toast({ title: 'Failed to record file', description: error.message, variant: 'destructive' }); return; }
    loadFiles();
  };

  const downloadFile = async (f: any) => {
    const { data, error } = await supabase.storage.from('crm-files').createSignedUrl(f.file_path, 300);
    if (error || !data) { toast({ title: 'Failed to open file', variant: 'destructive' }); return; }
    window.open(data.signedUrl, '_blank');
  };

  const deleteFile = async (f: any) => {
    if (!confirm('Delete this file?')) return;
    await supabase.storage.from('crm-files').remove([f.file_path]);
    const { error } = await (supabase as any).from('crm_lead_files').delete().eq('id', f.id);
    if (error) { toast({ title: 'Failed to delete', description: error.message, variant: 'destructive' }); return; }
    loadFiles();
  };

  const save = async () => {
    if (!form.company_id) {
      toast({
        title: 'Account required',
        description: 'Every opportunity must be linked to an existing account. Create the account first on the Accounts tab.',
        variant: 'destructive',
      });
      return;
    }
    const linkedCompany = companies.find(c => c.id === form.company_id);
    setSaving(true);
    const payload: any = {
      ...form,
      company_id: form.company_id,
      company_name: (linkedCompany?.name || form.company_name || '').trim(),
      primary_contact_id: form.primary_contact_id || null,
      contact_name: form.contact_name || null,
      email: form.email || null,
      phone: form.phone || null,
      source: form.source || null,
      close_date: form.close_date || null,
      amount: form.amount === '' ? null : Number(form.amount),
      probability: form.probability === '' ? null : Number(form.probability),
      type: form.type || null,
      description: form.description || null,
      next_step: form.next_step || null,
      stage_id: form.stage_id || null,
    };
    let error;
    if (lead) {
      ({ error } = await (supabase as any).from('crm_leads').update(payload).eq('id', lead.id));
    } else {
      payload.created_by = user?.id;
      ({ error } = await (supabase as any).from('crm_leads').insert(payload));
    }
    setSaving(false);
    if (error) {
      toast({ title: 'Failed to save opportunity', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: lead ? 'Opportunity updated' : 'Opportunity created' });
    onOpenChange(false);
    onSaved?.();
  };

  const currentStageIdx = form.stage_id
    ? stages.findIndex(s => s.id === form.stage_id)
    : -1;
  const currentStage = currentStageIdx >= 0 ? stages[currentStageIdx] : null;

  const persistStage = async (stageId: string) => {
    setForm(f => ({ ...f, stage_id: stageId }));
    if (lead?.id) {
      const { error } = await (supabase as any)
        .from('crm_leads').update({ stage_id: stageId }).eq('id', lead.id);
      if (error) {
        toast({ title: 'Failed to update stage', description: error.message, variant: 'destructive' });
        return;
      }
      onSaved?.();
    }
  };

  const markStageComplete = async () => {
    if (!stages.length) return;
    const nextIdx = currentStageIdx < 0 ? 0 : Math.min(currentStageIdx + 1, stages.length - 1);
    const next = stages[nextIdx];
    if (!next) return;
    await persistStage(next.id);
    toast({ title: `Stage: ${next.name}` });
  };

  const amountDisplay = form.amount ? `$${Number(form.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
  const closeDateDisplay = form.close_date
    ? new Date(form.close_date + 'T00:00:00').toLocaleDateString()
    : '—';
  const selectedCompany = companies.find(c => c.id === form.company_id) || null;
  const accountDisplay = selectedCompany?.name || form.company_name || '—';
  const contactsForAccount = form.company_id
    ? contacts.filter(c => c.company_id === form.company_id)
    : [];
  const selectedContact = contacts.find(c => c.id === form.primary_contact_id) || null;
  const contactDisplay = selectedContact
    ? `${selectedContact.first_name} ${selectedContact.last_name || ''}`.trim()
    : '—';
  const ownerName = owner?.full_name || (lead ? 'Unassigned' : 'You');
  const title = accountDisplay !== '—' ? accountDisplay : (lead ? 'Opportunity' : 'New Opportunity');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto p-0 gap-0 bg-slate-100 dark:bg-slate-900">
        {/* Salesforce-style header strip */}
        <div className="px-6 pt-5 pb-3 bg-slate-200/60 dark:bg-slate-800/60 border-b">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded bg-orange-500 text-white shrink-0">
              <Briefcase className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Opportunity</div>
              <DialogTitle className="text-lg font-bold truncate">{title}</DialogTitle>
            </div>
          </div>
        </div>

        {/* Highlights strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-6 py-4 bg-background border-b">
          <HighlightField label="Account Name" value={accountDisplay} link />
          <HighlightField label="Close Date" value={closeDateDisplay} />
          <HighlightField label="Amount" value={amountDisplay} strong />
          <HighlightField label="Opportunity Owner" value={ownerName} link />
        </div>

        {/* Pipeline path */}
        {stages.length > 0 && (
          <div className="px-6 py-4 bg-background border-b">
            <div className="flex items-stretch gap-3">
              <div className="flex-1 min-w-0">
                <StagePath
                  stages={stages}
                  currentIdx={currentStageIdx}
                  onSelect={persistStage}
                />
              </div>
              <Button
                onClick={markStageComplete}
                disabled={currentStageIdx >= stages.length - 1}
                className="shrink-0 h-9 bg-primary hover:bg-primary/90"
              >
                <Check className="h-4 w-4 mr-1" />
                Mark Stage as Complete
              </Button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-background px-6 pt-4">
        {lead?.id ? (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="bg-transparent p-0 h-auto border-b w-full justify-start rounded-none gap-6">
              <SfTab value="details">Details</SfTab>
              <SfTab value="notes">Notes ({notes.length})</SfTab>
              <SfTab value="files">Files ({files.length})</SfTab>
            </TabsList>
            <TabsContent value="details" className="space-y-6 pt-6 pb-6">
              {renderDetails()}
            </TabsContent>
            <TabsContent value="notes" className="space-y-3 pt-6 pb-6">
              <div className="space-y-2 border rounded p-3 bg-muted/30">
                <p className="text-xs text-muted-foreground">
                  Log customer notes here — billing questions, requests, concerns, or general updates.
                </p>
                <Textarea rows={3} placeholder="What did the customer say?" value={newNote} onChange={e => setNewNote(e.target.value)} />
                <div className="flex items-center gap-2">
                  <Select value={newNoteCategory} onValueChange={setNewNoteCategory}>
                    <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {NOTE_CATEGORIES.map(c => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={addNote} disabled={!newNote.trim()}>Add Note</Button>
                </div>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {notes.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No notes yet</p>}
                {notes.map(n => (
                  <div key={n.id} className="border rounded p-3 group">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0 space-y-1">
                        <NoteCategoryBadge category={n.category} />
                        <p className="text-sm whitespace-pre-wrap">{n.content}</p>
                      </div>
                      <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => deleteNote(n.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">{new Date(n.created_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="files" className="space-y-3 pt-6 pb-6">
              <label className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center gap-2 cursor-pointer hover:bg-muted/50">
                <Upload className="h-6 w-6 text-muted-foreground" />
                <span className="text-sm">{uploading ? 'Uploading...' : 'Click to upload a file (max 25MB)'}</span>
                <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
              </label>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {files.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No files yet</p>}
                {files.map(f => (
                  <div key={f.id} className="border rounded p-3 flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{f.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {f.file_size ? `${(f.file_size / 1024).toFixed(1)} KB` : ''} · {new Date(f.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => downloadFile(f)}><Download className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteFile(f)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-6 pt-4 pb-6">{renderDetails()}</div>
        )}
        </div>
        <DialogFooter className="px-6 py-4 bg-background border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Close</Button>
          {(tab === 'details' || !lead?.id) && (
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  function renderDetails() {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          <FieldRow label="Opportunity Owner">
            <div className="text-sm py-2">{ownerName}</div>
          </FieldRow>
          <FieldRow label="Close Date">
            <Input type="date" value={form.close_date} onChange={e => setForm({ ...form, close_date: e.target.value })} />
          </FieldRow>
          <FieldRow label="Opportunity Name">
            <Input value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} placeholder="Opportunity name" />
          </FieldRow>
          <FieldRow label="Stage">
            <Select value={form.stage_id || undefined} onValueChange={v => setForm({ ...form, stage_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select stage" /></SelectTrigger>
              <SelectContent>
                {stages.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldRow>
          <FieldRow label="Account Name" required>
            <AccountPicker
              companies={companies}
              value={form.company_id}
              onChange={(id) => {
                const c = companies.find(x => x.id === id);
                setForm(f => ({
                  ...f,
                  company_id: id,
                  company_name: c?.name || '',
                  // Clear contact if it doesn't belong to the new account
                  primary_contact_id: contacts.find(ct => ct.id === f.primary_contact_id && ct.company_id === id) ? f.primary_contact_id : '',
                }));
              }}
            />
            {companies.length === 0 && (
              <p className="text-xs text-destructive mt-1">
                No accounts yet. Create an account on the Accounts tab first.
              </p>
            )}
          </FieldRow>
          <FieldRow label="Primary Contact">
            <ContactPicker
              contacts={contactsForAccount}
              value={form.primary_contact_id}
              onChange={(id) => setForm({ ...form, primary_contact_id: id })}
              disabled={!form.company_id}
            />
            {form.company_id && contactsForAccount.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                This account has no contacts yet — add one on the Contacts tab.
              </p>
            )}
          </FieldRow>
          <FieldRow label="Probability (%)">
            <Input type="number" min={0} max={100} value={form.probability} onChange={e => setForm({ ...form, probability: e.target.value })} />
          </FieldRow>
          <FieldRow label="Type">
            <Input value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} placeholder="e.g. New Business" />
          </FieldRow>
          <FieldRow label="Amount">
            <Input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
          </FieldRow>
          <FieldRow label="Follow Up?">
            <div className="flex items-center h-10">
              <Checkbox checked={form.follow_up} onCheckedChange={(v) => setForm({ ...form, follow_up: !!v })} />
            </div>
          </FieldRow>
          <FieldRow label="Status">
            <Select value={form.status} onValueChange={v => setForm({ ...form, status: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(LEAD_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldRow>
        </div>

        <SfSection title="Additional Information" open={addlOpen} onToggle={() => setAddlOpen(o => !o)}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            <FieldRow label="Lead Source">
              <Select value={form.source || undefined} onValueChange={v => setForm({ ...form, source: v })}>
                <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                <SelectContent>
                  {LEAD_SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </FieldRow>
            <FieldRow label="Description">
              <Textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </FieldRow>
            <FieldRow label="Next Step">
              <Input value={form.next_step} onChange={e => setForm({ ...form, next_step: e.target.value })} />
            </FieldRow>
            <FieldRow label="Contact Info">
              <div className="space-y-2">
                <Input placeholder="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                <Input placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
            </FieldRow>
          </div>
        </SfSection>

        <SfSection title="System Information" open={sysOpen} onToggle={() => setSysOpen(o => !o)}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            <FieldRow label="Created">
              <div className="text-sm py-2">
                {lead?.created_at ? new Date(lead.created_at).toLocaleString() : 'Not yet saved'}
              </div>
            </FieldRow>
            <FieldRow label="Last Modified">
              <div className="text-sm py-2">
                {lead?.updated_at ? new Date(lead.updated_at).toLocaleString() : 'Not yet saved'}
              </div>
            </FieldRow>
          </div>
        </SfSection>

      </div>
    );
  }
}

function HighlightField({ label, value, link, strong }: { label: string; value: string; link?: boolean; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn('truncate', strong ? 'text-base font-semibold' : 'text-sm', link && 'text-primary')}>
        {value}
      </div>
    </div>
  );
}

function FieldRow({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="border-b pb-2">
      <div className="text-xs text-muted-foreground mb-1">
        {label}{required && <span className="text-destructive"> *</span>}
      </div>
      {children}
    </div>
  );
}

function SfTab({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <TabsTrigger
      value={value}
      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 pb-3 font-semibold text-sm"
    >
      {children}
    </TabsTrigger>
  );
}

function SfSection({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 bg-muted/60 rounded text-sm font-medium hover:bg-muted"
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        {title}
      </button>
      {open && <div className="pt-4">{children}</div>}
    </div>
  );
}

function AccountPicker({ companies, value, onChange }: { companies: CrmCompany[]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = companies.find(c => c.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
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
            <CommandEmpty>No accounts match. Create one on the Accounts tab.</CommandEmpty>
            <CommandGroup>
              {companies.map(c => (
                <CommandItem
                  key={c.id}
                  value={c.name}
                  onSelect={() => { onChange(c.id); setOpen(false); }}
                >
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

function ContactPicker({ contacts, value, onChange, disabled }: { contacts: CrmContact[]; value: string; onChange: (id: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const selected = contacts.find(c => c.id === value);
  const label = selected ? `${selected.first_name} ${selected.last_name || ''}`.trim() : '';
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className="flex items-center gap-2 truncate">
            <User className="h-4 w-4 text-muted-foreground shrink-0" />
            {label || <span className="text-muted-foreground">{disabled ? 'Select an account first' : 'Search contacts…'}</span>}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[280px]" align="start">
        <Command>
          <CommandInput placeholder="Type a contact name…" />
          <CommandList>
            <CommandEmpty>No contacts for this account.</CommandEmpty>
            <CommandGroup>
              {value && (
                <CommandItem value="__clear__" onSelect={() => { onChange(''); setOpen(false); }}>
                  <Check className="mr-2 h-4 w-4 opacity-0" />
                  <span className="text-muted-foreground">Clear selection</span>
                </CommandItem>
              )}
              {contacts.map(c => {
                const name = `${c.first_name} ${c.last_name || ''}`.trim();
                return (
                  <CommandItem
                    key={c.id}
                    value={name || c.email || c.id}
                    onSelect={() => { onChange(c.id); setOpen(false); }}
                  >
                    <Check className={cn('mr-2 h-4 w-4', value === c.id ? 'opacity-100' : 'opacity-0')} />
                    <span className="truncate">{name}{c.title ? ` — ${c.title}` : ''}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function StagePath({ stages, currentIdx, onSelect }: { stages: CrmStage[]; currentIdx: number; onSelect: (id: string) => void }) {
  return (
    <div className="flex w-full overflow-x-auto">
      {stages.map((s, i) => {
        const isCurrent = i === currentIdx;
        const isDone = currentIdx >= 0 && i < currentIdx;
        const isWonStep = s.is_won;
        const bg = isCurrent
          ? 'bg-primary text-primary-foreground'
          : isDone
          ? 'bg-emerald-600 text-white'
          : isWonStep && currentIdx === stages.length - 1
          ? 'bg-emerald-600 text-white'
          : 'bg-muted text-muted-foreground';
        return (
          <button
            type="button"
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={cn(
              'relative flex-1 min-w-[110px] h-9 flex items-center justify-center text-xs font-medium transition',
              bg,
              i === 0 && 'rounded-l-md',
              i === stages.length - 1 && 'rounded-r-md',
              'clip-chevron'
            )}
            style={{
              clipPath:
                i === stages.length - 1
                  ? 'polygon(0 0, 100% 0, 100% 100%, 0 100%, 12px 50%)'
                  : i === 0
                  ? 'polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)'
                  : 'polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%, 12px 50%)',
              marginLeft: i === 0 ? 0 : -8,
            }}
            title={s.name}
          >
            <span className="flex items-center gap-1 truncate px-3">
              {isDone && <Check className="h-3 w-3" />}
              <span className="truncate">{s.name}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}