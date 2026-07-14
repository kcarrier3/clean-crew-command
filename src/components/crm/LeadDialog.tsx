import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Upload, FileText, Trash2, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { LEAD_SOURCES, LEAD_STATUS_LABELS, type CrmLead } from './types';

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
  const [files, setFiles] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    company_name: '',
    contact_name: '',
    email: '',
    phone: '',
    source: '',
    status: 'new' as CrmLead['status'],
    notes: '',
  });

  useEffect(() => {
    if (lead) {
      setForm({
        company_name: lead.company_name || '',
        contact_name: lead.contact_name || '',
        email: lead.email || '',
        phone: lead.phone || '',
        source: lead.source || '',
        status: lead.status,
        notes: lead.notes || '',
      });
    } else {
      setForm({ company_name: '', contact_name: '', email: '', phone: '', source: '', status: 'new', notes: '' });
    }
  }, [lead, open]);

  useEffect(() => {
    if (open && lead?.id) {
      loadNotes();
      loadFiles();
    } else {
      setNotes([]);
      setFiles([]);
      setTab('details');
    }
  }, [open, lead?.id]);

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
      lead_id: lead.id, content: newNote.trim(), created_by: user?.id,
    });
    if (error) { toast({ title: 'Failed to add note', description: error.message, variant: 'destructive' }); return; }
    setNewNote('');
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
    if (!form.company_name.trim()) {
      toast({ title: 'Company name required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload: any = {
      ...form,
      company_name: form.company_name.trim(),
      contact_name: form.contact_name || null,
      email: form.email || null,
      phone: form.phone || null,
      source: form.source || null,
      notes: form.notes || null,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{lead ? 'Edit Opportunity' : 'New Opportunity'}</DialogTitle>
        </DialogHeader>
        {lead?.id ? (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="notes">Notes ({notes.length})</TabsTrigger>
              <TabsTrigger value="files">Files ({files.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="details" className="space-y-3 pt-4">
              {renderDetails()}
            </TabsContent>
            <TabsContent value="notes" className="space-y-3 pt-4">
              <div className="space-y-2">
                <Textarea rows={3} placeholder="Add a note..." value={newNote} onChange={e => setNewNote(e.target.value)} />
                <Button size="sm" onClick={addNote} disabled={!newNote.trim()}>Add Note</Button>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {notes.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No notes yet</p>}
                {notes.map(n => (
                  <div key={n.id} className="border rounded p-3 group">
                    <div className="flex justify-between items-start gap-2">
                      <p className="text-sm whitespace-pre-wrap flex-1">{n.content}</p>
                      <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => deleteNote(n.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">{new Date(n.created_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="files" className="space-y-3 pt-4">
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
          <div className="space-y-3">{renderDetails()}</div>
        )}
        <DialogFooter>
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
      <>
          <div>
            <Label>Company *</Label>
            <Input value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Contact Name</Label>
              <Input value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Source</Label>
              <Select value={form.source} onValueChange={v => setForm({ ...form, source: v })}>
                <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                <SelectContent>
                  {LEAD_SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(LEAD_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
      </>
    );
  }
}