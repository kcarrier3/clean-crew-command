import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { FileText, Upload, Trash2, Pencil, Download, Eye, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { PdfFieldBuilder } from './PdfFieldBuilder';
import { PdfFiller } from './PdfFiller';
import type { PdfField } from './types';
import { format } from 'date-fns';

interface DocRow {
  id: string;
  title: string;
  description: string | null;
  document_type: string;
  is_required: boolean;
  auto_assign: boolean;
  active: boolean;
  display_order: number;
  source_pdf_path: string | null;
  field_schema: PdfField[];
}

interface SubmissionRow {
  id: string;
  employee_id: string;
  document_id: string;
  status: string;
  submitted_at: string | null;
  filled_pdf_path: string | null;
  field_values: any;
  employee?: { first_name: string; last_name: string; email: string | null };
  document?: { title: string };
}

export const DocumentsAdmin = () => {
  const { toast } = useToast();
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<DocRow | null>(null);
  const [editorPdfUrl, setEditorPdfUrl] = useState<string | null>(null);
  const [editorFields, setEditorFields] = useState<PdfField[]>([]);
  const [editorMeta, setEditorMeta] = useState({ title: '', description: '', is_required: true, auto_assign: true });
  const [savingTpl, setSavingTpl] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewSub, setViewSub] = useState<SubmissionRow | null>(null);
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const load = async () => {
    setLoading(true);
    const [d, s] = await Promise.all([
      supabase.from('onboarding_documents').select('*').order('display_order'),
      supabase
        .from('employee_document_submissions')
        .select('*, document:onboarding_documents(title), employee:profiles!employee_document_submissions_employee_id_fkey(first_name,last_name,email)')
        .order('submitted_at', { ascending: false, nullsFirst: false }),
    ]);
    setDocs(((d.data as any) || []).map((r: any) => ({ ...r, field_schema: r.field_schema ?? [] })));
    setSubmissions((s.data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNewTemplate = () => {
    setEditor({
      id: '', title: '', description: '', document_type: 'custom_form',
      is_required: true, auto_assign: true, active: true, display_order: docs.length,
      source_pdf_path: null, field_schema: [],
    });
    setEditorPdfUrl(null);
    setEditorFields([]);
    setEditorMeta({ title: '', description: '', is_required: true, auto_assign: true });
  };

  const openEditTemplate = async (d: DocRow) => {
    setEditor(d);
    setEditorFields(d.field_schema || []);
    setEditorMeta({
      title: d.title,
      description: d.description ?? '',
      is_required: d.is_required,
      auto_assign: d.auto_assign,
    });
    if (d.source_pdf_path) {
      const { data } = await supabase.storage.from('onboarding-files').createSignedUrl(d.source_pdf_path, 3600);
      setEditorPdfUrl(data?.signedUrl ?? null);
    } else {
      setEditorPdfUrl(null);
    }
  };

  const handleUploadPdf = async (file: File) => {
    if (!editor) return;
    if (file.type !== 'application/pdf') {
      toast({ title: 'PDF only', description: 'Please upload a PDF file.', variant: 'destructive' });
      return;
    }
    // Need a document id to scope the path. Insert a draft if new.
    let docId = editor.id;
    if (!docId) {
      const { data: ins, error } = await supabase.from('onboarding_documents').insert({
        title: editorMeta.title || file.name.replace(/\.pdf$/i, ''),
        description: editorMeta.description || null,
        document_type: 'custom_form',
        is_required: editorMeta.is_required,
        auto_assign: editorMeta.auto_assign,
        active: true,
        display_order: editor.display_order,
        field_schema: [],
      } as any).select('*').single();
      if (error || !ins) {
        toast({ title: 'Error', description: error?.message ?? 'Failed to create template', variant: 'destructive' });
        return;
      }
      docId = ins.id;
      setEditor({ ...editor, id: docId });
    }
    const path = `templates/${docId}/${file.name}`;
    const { error: upErr } = await supabase.storage.from('onboarding-files').upload(path, file, { upsert: true, contentType: 'application/pdf' });
    if (upErr) {
      toast({ title: 'Upload failed', description: upErr.message, variant: 'destructive' });
      return;
    }
    await supabase.from('onboarding_documents').update({ source_pdf_path: path } as any).eq('id', docId);
    const { data: signed } = await supabase.storage.from('onboarding-files').createSignedUrl(path, 3600);
    setEditorPdfUrl(signed?.signedUrl ?? null);
    setEditor((e) => e ? { ...e, source_pdf_path: path } : e);
    toast({ title: 'PDF uploaded', description: 'Now place fields on the document.' });
  };

  const saveTemplate = async () => {
    if (!editor) return;
    if (!editorMeta.title.trim()) {
      toast({ title: 'Title required', variant: 'destructive' });
      return;
    }
    setSavingTpl(true);
    const payload: any = {
      title: editorMeta.title.trim(),
      description: editorMeta.description.trim() || null,
      is_required: editorMeta.is_required,
      auto_assign: editorMeta.auto_assign,
      field_schema: editorFields,
    };
    let error;
    if (editor.id) {
      ({ error } = await supabase.from('onboarding_documents').update(payload).eq('id', editor.id));
    } else {
      ({ error } = await supabase.from('onboarding_documents').insert({
        ...payload,
        document_type: 'custom_form',
        active: true,
        display_order: editor.display_order,
      }));
    }
    setSavingTpl(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Template saved' });
    setEditor(null);
    setEditorPdfUrl(null);
    load();
  };

  const deleteTemplate = async (id: string) => {
    const { error } = await supabase.from('onboarding_documents').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Deleted' });
    setDeletingId(null);
    load();
  };

  const toggleActive = async (d: DocRow, active: boolean) => {
    await supabase.from('onboarding_documents').update({ active } as any).eq('id', d.id);
    load();
  };

  const toggleAuto = async (d: DocRow, auto_assign: boolean) => {
    await supabase.from('onboarding_documents').update({ auto_assign } as any).eq('id', d.id);
    load();
  };

  const openSubmission = async (s: SubmissionRow) => {
    setViewSub(s);
    if (s.filled_pdf_path) {
      const { data } = await supabase.storage.from('onboarding-files').createSignedUrl(s.filled_pdf_path, 3600);
      setViewUrl(data?.signedUrl ?? null);
    } else {
      setViewUrl(null);
    }
  };

  const filteredSubs = useMemo(() => {
    return submissions.filter(s => {
      if (filterStatus !== 'all' && s.status !== filterStatus) return false;
      if (filterEmployee.trim()) {
        const name = `${s.employee?.first_name ?? ''} ${s.employee?.last_name ?? ''}`.toLowerCase();
        if (!name.includes(filterEmployee.toLowerCase())) return false;
      }
      return true;
    });
  }, [submissions, filterStatus, filterEmployee]);

  const statusIcon = (s: string) => {
    if (s === 'completed') return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    if (s === 'rejected')  return <XCircle className="h-4 w-4 text-red-600" />;
    return <Clock className="h-4 w-4 text-yellow-600" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" /> Documents
          </h2>
          <p className="text-sm text-muted-foreground">Upload PDFs, place fillable fields, and review submissions.</p>
        </div>
        <Button onClick={openNewTemplate}>
          <Upload className="h-4 w-4 mr-2" /> New Template
        </Button>
      </div>

      <Tabs defaultValue="templates">
        <TabsList>
          <TabsTrigger value="templates">Templates ({docs.length})</TabsTrigger>
          <TabsTrigger value="submissions">Submissions ({submissions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-4 space-y-2">
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!loading && docs.length === 0 && (
            <Card><CardContent className="p-6 text-sm text-muted-foreground text-center">No templates yet. Click "New Template" to upload your first PDF.</CardContent></Card>
          )}
          {docs.map(d => (
            <Card key={d.id}>
              <CardContent className="p-4 flex items-center gap-3 flex-wrap">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{d.title}</span>
                    {d.is_required && <Badge variant="outline" className="text-[10px]">Required</Badge>}
                    {!d.active && <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
                    {!d.source_pdf_path && d.document_type === 'custom_form' && <Badge variant="outline" className="text-[10px] border-yellow-500 text-yellow-700">No PDF</Badge>}
                    <Badge variant="outline" className="text-[10px]">{d.document_type}</Badge>
                  </div>
                  {d.description && <p className="text-xs text-muted-foreground truncate">{d.description}</p>}
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {(d.field_schema?.length ?? 0)} field{(d.field_schema?.length ?? 0) === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-muted-foreground">Auto-assign</span>
                    <Switch checked={d.auto_assign} onCheckedChange={(v) => toggleAuto(d, v)} />
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-muted-foreground">Active</span>
                    <Switch checked={d.active} onCheckedChange={(v) => toggleActive(d, v)} />
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openEditTemplate(d)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => setDeletingId(d.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="submissions" className="mt-4 space-y-3">
          <div className="flex gap-2 flex-wrap">
            <Input placeholder="Filter by employee name" value={filterEmployee} onChange={(e) => setFilterEmployee(e.target.value)} className="max-w-xs" />
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {filteredSubs.length === 0 && (
            <Card><CardContent className="p-6 text-sm text-muted-foreground text-center">No submissions match your filters.</CardContent></Card>
          )}
          {filteredSubs.map(s => (
            <Card key={s.id} className="cursor-pointer hover:bg-muted/30" onClick={() => openSubmission(s)}>
              <CardContent className="p-4 flex items-center gap-3">
                {statusIcon(s.status)}
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{s.employee?.first_name} {s.employee?.last_name}</div>
                  <div className="text-xs text-muted-foreground truncate">{s.document?.title}</div>
                </div>
                <div className="text-xs text-muted-foreground text-right">
                  <div>{s.status}</div>
                  {s.submitted_at && <div>{format(new Date(s.submitted_at), 'MMM d, yyyy')}</div>}
                </div>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* Template editor */}
      <Dialog open={!!editor} onOpenChange={(o) => !o && setEditor(null)}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editor?.id ? 'Edit Template' : 'New Template'}</DialogTitle>
          </DialogHeader>
          {editor && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Title</Label>
                  <Input value={editorMeta.title} onChange={(e) => setEditorMeta({ ...editorMeta, title: e.target.value })} />
                </div>
                <div className="flex items-center gap-4 pt-6">
                  <label className="flex items-center gap-2 text-sm"><Switch checked={editorMeta.is_required} onCheckedChange={(v) => setEditorMeta({ ...editorMeta, is_required: v })} /> Required</label>
                  <label className="flex items-center gap-2 text-sm"><Switch checked={editorMeta.auto_assign} onCheckedChange={(v) => setEditorMeta({ ...editorMeta, auto_assign: v })} /> Auto-assign to new hires</label>
                </div>
              </div>
              <div>
                <Label>Description (optional)</Label>
                <Textarea rows={2} value={editorMeta.description} onChange={(e) => setEditorMeta({ ...editorMeta, description: e.target.value })} />
              </div>

              <div className="border rounded-md p-3 bg-muted/30">
                <Label className="block mb-2">Source PDF</Label>
                {editorPdfUrl ? (
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4" />
                    <a href={editorPdfUrl} target="_blank" rel="noreferrer" className="underline">View current PDF</a>
                    <label className="ml-auto">
                      <Button size="sm" variant="outline" asChild>
                        <span><Upload className="h-3 w-3 mr-1" /> Replace</span>
                      </Button>
                      <input type="file" accept="application/pdf" hidden onChange={(e) => e.target.files?.[0] && handleUploadPdf(e.target.files[0])} />
                    </label>
                  </div>
                ) : (
                  <label className="block">
                    <Button variant="outline" asChild>
                      <span><Upload className="h-4 w-4 mr-2" /> Upload PDF</span>
                    </Button>
                    <input type="file" accept="application/pdf" hidden onChange={(e) => e.target.files?.[0] && handleUploadPdf(e.target.files[0])} />
                  </label>
                )}
              </div>

              {editorPdfUrl && (
                <PdfFieldBuilder
                  fileUrl={editorPdfUrl}
                  initialFields={editorFields}
                  onChange={setEditorFields}
                />
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditor(null)}>Cancel</Button>
            <Button onClick={saveTemplate} disabled={savingTpl}>{savingTpl ? 'Saving…' : 'Save Template'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submission viewer */}
      <Dialog open={!!viewSub} onOpenChange={(o) => { if (!o) { setViewSub(null); setViewUrl(null); } }}>
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewSub?.document?.title} — {viewSub?.employee?.first_name} {viewSub?.employee?.last_name}</DialogTitle>
          </DialogHeader>
          {viewUrl ? (
            <div className="space-y-2">
              <a href={viewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center text-sm underline">
                <Download className="h-4 w-4 mr-1" /> Download filled PDF
              </a>
              <iframe src={viewUrl} title="Filled document" className="w-full h-[70vh] border rounded" />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No filled PDF available yet{viewSub?.field_values ? '. Form data is stored.' : '.'}
            </p>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this template?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the template and all of its submissions. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingId && deleteTemplate(deletingId)} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DocumentsAdmin;