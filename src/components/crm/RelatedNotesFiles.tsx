import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FileText, StickyNote, RefreshCw, MoreHorizontal, Pencil, Copy, Trash2, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { sanitizeNoteHtml } from './salesforce/sfUtils';

export type RelatedParentType = 'account' | 'contact' | 'opportunity' | 'task';

const COLUMN: Record<RelatedParentType, string> = {
  account: 'company_id',
  contact: 'contact_id',
  opportunity: 'lead_id',
  task: 'task_id',
};

interface NoteRow {
  id: string; title: string | null; content: string; content_html: string | null;
  sf_source_object: string | null; sf_created_date: string | null; created_at: string;
  updated_at: string | null; created_by: string | null; updated_by: string | null;
}
interface FileRow {
  id: string; file_name: string; file_path: string; file_size: number | null;
  content_type: string | null; sf_source_object: string | null; created_at: string;
  uploaded_by: string | null;
}

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleString(undefined, { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';

const extOf = (name: string) => (name.split('.').pop() || '').toLowerCase().slice(0, 4);

/**
 * Salesforce-style "Notes & Files" related list for any CRM parent record.
 * Used on Accounts, Contacts and Tasks so imported records are discoverable
 * from their true parent.
 */
export function RelatedNotesFiles({ parentType, parentId }: { parentType: RelatedParentType; parentId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [editor, setEditor] = useState<{ id?: string; title: string; content: string } | null>(null);
  const [preview, setPreview] = useState<NoteRow | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const column = COLUMN[parentType];

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: n }, { data: f }] = await Promise.all([
      (supabase as any).from('crm_lead_notes')
        .select('id, title, content, content_html, sf_source_object, sf_created_date, created_at, updated_at, created_by, updated_by')
        .eq(column, parentId).order('created_at', { ascending: false }),
      (supabase as any).from('crm_lead_files')
        .select('id, file_name, file_path, file_size, content_type, sf_source_object, created_at, uploaded_by')
        .eq(column, parentId).order('created_at', { ascending: false }),
    ]);
    setNotes(n || []); setFiles(f || []); setLoading(false);
  }, [column, parentId]);

  useEffect(() => { if (parentId) load(); }, [parentId, load]);

  // Resolve display names for referenced user IDs.
  useEffect(() => {
    const ids = new Set<string>();
    notes.forEach(n => { if (n.created_by) ids.add(n.created_by); if (n.updated_by) ids.add(n.updated_by); });
    files.forEach(f => { if (f.uploaded_by) ids.add(f.uploaded_by); });
    const missing = Array.from(ids).filter(id => !(id in userNames));
    if (!missing.length) return;
    (async () => {
      const { data } = await (supabase as any).from('profiles').select('id, first_name, last_name').in('id', missing);
      setUserNames(prev => {
        const next = { ...prev };
        (data || []).forEach((p: any) => { next[p.id] = `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown'; });
        missing.forEach(id => { if (!(id in next)) next[id] = 'Unknown'; });
        return next;
      });
    })();
  }, [notes, files]); // eslint-disable-line react-hooks/exhaustive-deps

  const nameFor = (id?: string | null) => (id ? userNames[id] || '…' : '—');

  const saveNote = async () => {
    if (!editor) return;
    const content = editor.content.trim();
    if (!content && !editor.title.trim()) return;
    setBusy(true);
    const { error } = editor.id
      ? await (supabase as any).from('crm_lead_notes')
          .update({ title: editor.title.trim() || null, content, updated_by: user?.id }).eq('id', editor.id)
      : await (supabase as any).from('crm_lead_notes')
          .insert({ [column]: parentId, parent_type: parentType, title: editor.title.trim() || null, content, created_by: user?.id });
    setBusy(false);
    if (error) { toast({ title: 'Could not save note', description: error.message, variant: 'destructive' }); return; }
    setEditor(null); load();
  };

  const deleteNote = async (id: string) => {
    if (!confirm('Delete this note?')) return;
    const { error } = await (supabase as any).from('crm_lead_notes').delete().eq('id', id);
    if (error) { toast({ title: 'Could not delete note', description: error.message, variant: 'destructive' }); return; }
    load();
  };

  const deleteFile = async (f: FileRow) => {
    if (!confirm('Delete this file?')) return;
    await supabase.storage.from('crm-files').remove([f.file_path]);
    const { error } = await (supabase as any).from('crm_lead_files').delete().eq('id', f.id);
    if (error) { toast({ title: 'Could not delete file', description: error.message, variant: 'destructive' }); return; }
    load();
  };

  const upload = async (file: File) => {
    setBusy(true);
    const path = `${parentType}/${parentId}/${crypto.randomUUID()}-${file.name.replace(/[\\/]+/g, '-')}`;
    const { error: upErr } = await supabase.storage.from('crm-files')
      .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
    if (upErr) { setBusy(false); toast({ title: 'Upload failed', description: upErr.message, variant: 'destructive' }); return; }
    const { error } = await (supabase as any).from('crm_lead_files').insert({
      [column]: parentId, parent_type: parentType, file_path: path, file_name: file.name,
      file_size: file.size, content_type: file.type || null, uploaded_by: user?.id,
    });
    setBusy(false);
    if (error) { toast({ title: 'Could not record file', description: error.message, variant: 'destructive' }); return; }
    load();
  };

  const download = async (f: FileRow) => {
    const { data, error } = await supabase.storage.from('crm-files').createSignedUrl(f.file_path, 60);
    if (error || !data?.signedUrl) { toast({ title: 'Download failed', description: error?.message, variant: 'destructive' }); return; }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  // Renames only the display name; the stored object path is left untouched.
  const renameFile = async (f: FileRow) => {
    const next = window.prompt('File name', f.file_name)?.trim();
    if (!next || next === f.file_name) return;
    const { error } = await (supabase as any).from('crm_lead_files').update({ file_name: next }).eq('id', f.id);
    if (error) { toast({ title: 'Could not rename file', description: error.message, variant: 'destructive' }); return; }
    load();
  };

  const _unusedDownload = async (f: FileRow) => {
    const { data, error } = await supabase.storage.from('crm-files').createSignedUrl(f.file_path, 60);
    if (error || !data?.signedUrl) { toast({ title: 'Download failed', description: error?.message, variant: 'destructive' }); return; }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  if (loading) return <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>;

  return (
    <div className="space-y-6">
      {/* NOTES */}
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b bg-muted/30">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-8 w-8 rounded flex items-center justify-center bg-pink-600 text-primary-foreground shrink-0">
              <StickyNote className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold">Notes ({notes.length})</div>
              <div className="text-xs text-muted-foreground truncate">
                {notes.length} item{notes.length === 1 ? '' : 's'} • Sorted by Last Modified
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button size="icon" variant="outline" className="h-8 w-8" onClick={load} title="Refresh">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="outline" className="h-8" onClick={() => setEditor({ title: '', content: '' })}>New</Button>
          </div>
        </div>
        {notes.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">No notes yet</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-10 text-xs" />
                  <TableHead className="text-xs">Title</TableHead>
                  <TableHead className="text-xs">Text Preview</TableHead>
                  <TableHead className="text-xs w-40">Created By</TableHead>
                  <TableHead className="text-xs w-44">Last Modified</TableHead>
                  <TableHead className="text-xs w-40">Last Modified By</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {notes.map((n, i) => (
                  <TableRow key={n.id}>
                    <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                    <TableCell>
                      <button
                        className="text-primary hover:underline text-sm font-medium text-left"
                        onClick={() => setPreview(n)}
                      >
                        {n.title || (n.content || '').split('\n')[0].slice(0, 60) || 'Untitled Note'}
                      </button>
                      {n.sf_source_object && (
                        <div className="mt-1"><Badge variant="outline" className="text-xs">{n.sf_source_object}</Badge></div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-md">
                      <span className="line-clamp-1">{(n.content || '').replace(/\s+/g, ' ').trim()}</span>
                    </TableCell>
                    <TableCell className="text-sm text-primary">{nameFor(n.created_by)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{fmtDate(n.sf_created_date || n.updated_at || n.created_at)}</TableCell>
                    <TableCell className="text-sm text-primary">{nameFor(n.updated_by || n.created_by)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setEditor({ id: n.id, title: n.title || '', content: n.content || '' })}>
                            <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => navigator.clipboard?.writeText(n.content || '')}>
                            <Copy className="h-3.5 w-3.5 mr-2" /> Copy text
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onSelect={() => deleteNote(n.id)}>
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* FILES */}
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b bg-muted/30">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-8 w-8 rounded flex items-center justify-center bg-sky-600 text-primary-foreground shrink-0">
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold">Files ({files.length})</div>
              <div className="text-xs text-muted-foreground truncate">Attachments on this record</div>
            </div>
          </div>
          <Button size="sm" variant="outline" className="h-8" disabled={busy} onClick={() => fileInput.current?.click()}>
            {busy ? 'Uploading…' : 'Add Files'}
          </Button>
          <Input
            ref={fileInput}
            type="file"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }}
          />
        </div>
        {files.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">No files yet</div>
        ) : (
          <div className="divide-y">
            {files.map((f) => (
              <div key={f.id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-accent/40 transition-colors">
                <div className="h-9 w-7 rounded-sm border bg-muted flex items-center justify-center shrink-0">
                  <span className="text-[9px] font-semibold uppercase text-muted-foreground">{extOf(f.file_name) || 'file'}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <button
                    className="text-sm text-primary hover:underline text-left break-words w-full"
                    title={f.file_name}
                    onClick={() => download(f)}
                  >
                    {f.file_name}
                  </button>
                  <p className="text-xs text-muted-foreground">
                    {new Date(f.created_at).toLocaleDateString()} • {f.file_size ? `${Math.round(f.file_size / 1024)}KB` : '—'} • {nameFor(f.uploaded_by)}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => download(f)}><Download className="h-3.5 w-3.5 mr-2" /> Download</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => renameFile(f)}><Pencil className="h-3.5 w-3.5 mr-2" /> Rename</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onSelect={() => deleteFile(f)}>
                      <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* NOTE EDITOR */}
      <Dialog open={!!editor} onOpenChange={(o) => { if (!o) setEditor(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editor?.id ? 'Edit Note' : 'New Note'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Title"
              value={editor?.title || ''}
              onChange={(e) => setEditor(prev => prev && { ...prev, title: e.target.value })}
            />
            <Textarea
              rows={10}
              placeholder="Write a note…"
              value={editor?.content || ''}
              onChange={(e) => setEditor(prev => prev && { ...prev, content: e.target.value })}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditor(null)}>Cancel</Button>
            <Button onClick={saveNote} disabled={busy}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* NOTE PREVIEW */}
      <Dialog open={!!preview} onOpenChange={(o) => { if (!o) setPreview(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{preview?.title || 'Untitled Note'}</DialogTitle></DialogHeader>
          {preview?.content_html ? (
            <div
              className="prose prose-sm max-w-none text-sm [&_a]:text-primary"
              dangerouslySetInnerHTML={{ __html: sanitizeNoteHtml(preview.content_html) }}
            />
          ) : (
            <p className="text-sm whitespace-pre-wrap">{preview?.content}</p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { if (preview) { setEditor({ id: preview.id, title: preview.title || '', content: preview.content || '' }); setPreview(null); } }}
            >
              <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}