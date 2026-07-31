import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { FileText, Paperclip, Download, Plus } from 'lucide-react';
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
}
interface FileRow {
  id: string; file_name: string; file_path: string; file_size: number | null;
  content_type: string | null; sf_source_object: string | null; created_at: string;
}

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
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const column = COLUMN[parentType];

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: n }, { data: f }] = await Promise.all([
      (supabase as any).from('crm_lead_notes')
        .select('id, title, content, content_html, sf_source_object, sf_created_date, created_at')
        .eq(column, parentId).order('created_at', { ascending: false }),
      (supabase as any).from('crm_lead_files')
        .select('id, file_name, file_path, file_size, content_type, sf_source_object, created_at')
        .eq(column, parentId).order('created_at', { ascending: false }),
    ]);
    setNotes(n || []); setFiles(f || []); setLoading(false);
  }, [column, parentId]);

  useEffect(() => { if (parentId) load(); }, [parentId, load]);

  const addNote = async () => {
    if (!draft.trim()) return;
    setBusy(true);
    const { error } = await (supabase as any).from('crm_lead_notes').insert({
      [column]: parentId, parent_type: parentType, content: draft.trim(), created_by: user?.id,
    });
    setBusy(false);
    if (error) { toast({ title: 'Could not save note', description: error.message, variant: 'destructive' }); return; }
    setDraft(''); load();
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

  if (loading) return <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Textarea rows={2} placeholder="Add a note…" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <div className="flex gap-2">
          <Button size="sm" onClick={addNote} disabled={busy || !draft.trim()}>
            <Plus className="h-4 w-4 mr-1.5" /> Add note
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => fileInput.current?.click()}>
            <Paperclip className="h-4 w-4 mr-1.5" /> Upload file
          </Button>
          <Input
            ref={fileInput}
            type="file"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }}
          />
        </div>
      </div>

      <div>
        <p className="text-sm font-medium mb-2 flex items-center gap-1.5">
          <FileText className="h-4 w-4" /> Notes ({notes.length})
        </p>
        {notes.length === 0 ? (
          <Card><CardContent className="py-6 text-center text-muted-foreground text-sm">No notes yet.</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {notes.map((n) => (
              <Card key={n.id}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {n.title && <p className="font-medium text-sm">{n.title}</p>}
                    {n.sf_source_object && <Badge variant="outline" className="text-xs">{n.sf_source_object}</Badge>}
                    <span className="text-xs text-muted-foreground ml-auto">
                      {new Date(n.sf_created_date || n.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {n.content_html ? (
                    <div
                      className="prose prose-sm max-w-none text-sm mt-1 [&_a]:text-primary"
                      dangerouslySetInnerHTML={{ __html: sanitizeNoteHtml(n.content_html) }}
                    />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap mt-1">{n.content}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-sm font-medium mb-2 flex items-center gap-1.5">
          <Paperclip className="h-4 w-4" /> Files ({files.length})
        </p>
        {files.length === 0 ? (
          <Card><CardContent className="py-6 text-center text-muted-foreground text-sm">No files yet.</CardContent></Card>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {files.map((f) => (
              <Card key={f.id}>
                <CardContent className="p-3 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{f.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {f.file_size ? `${(f.file_size / 1024).toFixed(0)} KB` : '—'}
                      {f.sf_source_object ? ` • ${f.sf_source_object}` : ''}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => download(f)}><Download className="h-4 w-4" /></Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}