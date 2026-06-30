import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, Calendar, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS, type CrmTask, type CrmTaskPriority, type CrmTaskStatus } from './types';

const PRIORITY_COLORS: Record<CrmTaskPriority, string> = {
  low: 'bg-gray-100 text-gray-700',
  normal: 'bg-blue-100 text-blue-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800',
};

const blank = {
  title: '', description: '', due_at: '',
  priority: 'normal' as CrmTaskPriority,
  status: 'open' as CrmTaskStatus,
};

export function TasksList({ onChanged }: { onChanged?: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<CrmTask[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CrmTask | null>(null);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const load = async () => {
    const { data } = await (supabase as any).from('crm_tasks').select('*').order('due_at', { ascending: true, nullsFirst: false });
    setItems(data || []);
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (editing) setForm({
      title: editing.title, description: editing.description || '',
      due_at: editing.due_at ? editing.due_at.slice(0, 16) : '',
      priority: editing.priority, status: editing.status,
    });
    else setForm(blank);
  }, [editing, open]);

  const save = async () => {
    if (!form.title.trim()) { toast({ title: 'Title required', variant: 'destructive' }); return; }
    setSaving(true);
    const payload: any = {
      title: form.title.trim(),
      description: form.description || null,
      due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
      priority: form.priority,
      status: form.status,
      completed_at: form.status === 'done' ? (editing?.completed_at || new Date().toISOString()) : null,
    };
    let error;
    if (editing) ({ error } = await (supabase as any).from('crm_tasks').update(payload).eq('id', editing.id));
    else { payload.created_by = user?.id; payload.assigned_to = user?.id; ({ error } = await (supabase as any).from('crm_tasks').insert(payload)); }
    setSaving(false);
    if (error) { toast({ title: 'Save failed', description: error.message, variant: 'destructive' }); return; }
    toast({ title: editing ? 'Task updated' : 'Task created' });
    setOpen(false); setEditing(null); load(); onChanged?.();
  };

  const toggleDone = async (t: CrmTask) => {
    const done = t.status !== 'done';
    const { error } = await (supabase as any).from('crm_tasks').update({
      status: done ? 'done' : 'open',
      completed_at: done ? new Date().toISOString() : null,
    }).eq('id', t.id);
    if (error) { toast({ title: 'Update failed', description: error.message, variant: 'destructive' }); return; }
    load(); onChanged?.();
  };

  const remove = async (t: CrmTask) => {
    if (!confirm(`Delete "${t.title}"?`)) return;
    await (supabase as any).from('crm_tasks').delete().eq('id', t.id);
    load(); onChanged?.();
  };

  const visible = items.filter(t => showDone || t.status !== 'done');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={showDone} onCheckedChange={v => setShowDone(!!v)} />
          Show completed
        </label>
        <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4 mr-2" /> New Task</Button>
      </div>
      {visible.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">No tasks. Create one to track your follow-ups.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {visible.map(t => {
            const overdue = t.due_at && t.status !== 'done' && new Date(t.due_at) < new Date();
            return (
              <Card key={t.id} className={t.status === 'done' ? 'opacity-60' : ''}>
                <CardContent className="p-4 flex items-start gap-3">
                  <Checkbox checked={t.status === 'done'} onCheckedChange={() => toggleDone(t)} className="mt-1" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`font-medium ${t.status === 'done' ? 'line-through' : ''}`}>{t.title}</p>
                      <Badge className={PRIORITY_COLORS[t.priority] + ' text-xs'}>{TASK_PRIORITY_LABELS[t.priority]}</Badge>
                      {t.status !== 'open' && t.status !== 'done' && <Badge variant="outline" className="text-xs">{TASK_STATUS_LABELS[t.status]}</Badge>}
                    </div>
                    {t.description && <p className="text-sm text-muted-foreground mt-1">{t.description}</p>}
                    {t.due_at && (
                      <p className={`text-xs mt-1 flex items-center gap-1 ${overdue ? 'text-red-600' : 'text-muted-foreground'}`}>
                        {overdue ? <AlertCircle className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
                        {new Date(t.due_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(t); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(t)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Edit Task' : 'New Task'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div><Label>Due</Label><Input type="datetime-local" value={form.due_at} onChange={e => setForm({ ...form, due_at: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v as CrmTaskPriority })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TASK_PRIORITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v as CrmTaskStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TASK_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
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