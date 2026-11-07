import { useCallback, useEffect, useState } from 'react';
import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameMonth, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SearchPicker from './SearchPicker';
import { entryDate, personName, plannerEntries, plannerOptions, type PlannerEntry } from './plannerApi';
import { validateTraining } from '@/lib/lookaheadCalendar';

const blank = (date: string) => ({ worker_id: '', manager_id: '', job_site_id: '', session_date: date, start_time: '09:00', end_time: '12:00', notes: '' });
export default function LookaheadCalendar({ training }: { training: boolean }) {
  const { isManager, canChangeShifts } = useAuth();
  const { toast } = useToast();
  const [date, setDate] = useState(new Date());
  const [view, setView] = useState('month');
  const [rows, setRows] = useState<PlannerEntry[]>([]);
  const [options, setOptions] = useState<Awaited<ReturnType<typeof plannerOptions>>>({ people: [], accounts: [], managers: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PlannerEntry | null>(null);
  const [newId, setNewId] = useState('');
  const [form, setForm] = useState(blank(format(new Date(),'yyyy-MM-dd')));
  const [saving, setSaving] = useState(false);
  const canEdit = isManager() && (!training || canChangeShifts());
  const start = view === 'month' ? startOfWeek(startOfMonth(date)) : view === 'week' ? startOfWeek(date) : date;
  const end = view === 'month' ? endOfWeek(endOfMonth(date)) : view === 'week' ? endOfWeek(date) : addDays(date,90);
  const first = format(start,'yyyy-MM-dd'); const last = format(end,'yyyy-MM-dd');
  const load = useCallback(async () => {
    if (!isManager()) return;
    setLoading(true); setError('');
    try { const [entries, choices] = await Promise.all([plannerEntries(training,first,last),plannerOptions()]); setRows(entries); setOptions(choices); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not load calendar'); }
    finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [training,first,last,isManager()]);
  useEffect(() => { void load(); }, [load]);
  const edit = (entry: PlannerEntry | null, day = format(date,'yyyy-MM-dd')) => {
    setEditing(entry);
    setNewId(crypto.randomUUID());
    setForm(entry ? { worker_id: 'worker_id' in entry ? entry.worker_id : '', manager_id: entry.manager_id ?? '', job_site_id: entry.job_site_id, session_date: entryDate(entry), start_time: 'start_time' in entry ? entry.start_time.slice(0,5) : '09:00', end_time: 'end_time' in entry ? entry.end_time.slice(0,5) : '12:00', notes: entry.notes ?? '' } : blank(day));
    setOpen(true);
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const problem = training ? validateTraining(form) : !form.job_site_id ? 'Choose an existing account' : !form.session_date ? 'Choose a start date' : null;
    if (problem) { toast({ title: problem, variant: 'destructive' }); return; }
    setSaving(true);
    const id = editing?.id ?? newId;
    const result = training
      ? await supabase.from('training_sessions').upsert({ id, ...form, notes: form.notes || null })
      : await supabase.from('new_account_calendar_entries').upsert({ id, job_site_id: form.job_site_id, start_date: form.session_date, manager_id: form.manager_id || null, notes: form.notes || null });
    setSaving(false);
    if (result.error) { toast({ title: 'Could not save', description: result.error.message, variant: 'destructive' }); return; }
    toast({ title: training ? 'Training saved as draft' : 'Account calendar updated' }); setOpen(false); void load();
  };
  const remove = async () => {
    if (!editing || !window.confirm(training ? 'Remove this training session and its linked shift?' : 'Remove this calendar entry? The account will stay unchanged.')) return;
    setSaving(true);
    const { error: failure } = await supabase.from(training ? 'training_sessions' : 'new_account_calendar_entries').delete().eq('id',editing.id);
    setSaving(false);
    if (failure) { toast({ title: 'Could not remove', description: failure.message, variant: 'destructive' }); return; }
    setOpen(false); void load();
  };
  const title = training ? 'Training Planner' : 'New Account Calendar';
  const detail = (entry: PlannerEntry) => <>
    {'worker_id' in entry && <span className="font-semibold break-words">{personName(options.people.find(p => p.id === entry.worker_id))}</span>}
    <span className="break-words">{options.accounts.find(a => a.id === entry.job_site_id)?.name ?? 'Account unavailable'}</span>
    {'start_time' in entry && <span>{entry.start_time.slice(0,5)}–{entry.end_time.slice(0,5)}</span>}
    {entry.manager_id && <span className="text-muted-foreground break-words">{personName(options.managers.find(p => p.id === entry.manager_id))}</span>}
    {'published_at' in entry && <Badge variant={entry.published_at ? 'default' : 'secondary'} className="w-fit">{entry.published_at ? 'Published' : 'Draft'}</Badge>}
  </>;
  if (!isManager()) return null;
  const days = Array.from({length: Math.round((parseISO(last).getTime()-parseISO(first).getTime())/86400000)+1},(_,i)=>addDays(parseISO(first),i));
  return <section className="space-y-5 min-w-0">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-semibold flex items-center gap-2"><CalendarDays className="h-6 w-6 text-primary shrink-0" />{title}</h2>
      {canEdit && <Button onClick={() => edit(null)}><Plus className="h-4 w-4 mr-2" />{training ? 'Add training' : 'Add account start'}</Button>}
    </div>
    <div className="flex flex-wrap gap-3 items-center justify-between">
      <div className="flex items-center gap-2"><Button variant="outline" size="icon" aria-label="Previous period" onClick={() => setDate(view==='month'?addMonths(date,-1):addDays(date,-7))}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="font-medium min-w-[130px] text-center">{format(date,view==='month'?'MMMM yyyy':'MMM d, yyyy')}</span>
        <Button variant="outline" size="icon" aria-label="Next period" onClick={() => setDate(view==='month'?addMonths(date,1):addDays(date,7))}><ChevronRight className="h-4 w-4" /></Button><Button variant="ghost" onClick={() => setDate(new Date())}>Today</Button></div>
      <Tabs value={view} onValueChange={setView}><TabsList><TabsTrigger value="month">Month</TabsTrigger><TabsTrigger value="week">Week</TabsTrigger><TabsTrigger value="upcoming">Upcoming</TabsTrigger></TabsList></Tabs>
    </div>
    {error ? <div role="alert" className="text-destructive">{error}<Button variant="outline" className="ml-3" onClick={() => void load()}>Retry</Button></div> : loading ? <p className="text-muted-foreground py-12">Loading calendar…</p> : <>
      {view !== 'upcoming' && <div className="hidden md:block border border-border rounded-md overflow-hidden">
        <div className="grid grid-cols-7 bg-muted">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day=><div key={day} className="p-2 text-center text-xs font-semibold">{day}</div>)}</div>
        <div className="grid grid-cols-7">{days.map(day=>{ const iso=format(day,'yyyy-MM-dd'); return <div key={iso} className={`min-h-[140px] border-t border-r border-border p-1.5 min-w-0 ${view==='month'&&!isSameMonth(day,date)?'bg-muted/40':''}`}>
          <Button variant="ghost" size="sm" className="h-7 px-2" aria-label={`Add on ${iso}`} disabled={!canEdit} onClick={()=>edit(null,iso)}>{format(day,'d')}</Button>
          <div className="space-y-1">{rows.filter(row=>entryDate(row)===iso).map(row=><Button key={row.id} variant="secondary" className="h-auto w-full p-2 text-xs flex flex-col items-start gap-1 whitespace-normal text-left" onClick={()=>edit(row)}>{detail(row)}</Button>)}</div>
        </div>; })}</div>
      </div>}
      <div className={view==='upcoming'?'space-y-3':'md:hidden space-y-3'}>
        {rows.length===0 ? <p className="text-muted-foreground py-8">{training?'No training scheduled.':'No upcoming account starts.'}</p> : rows.map(row=><Button key={row.id} variant="outline" className="w-full h-auto p-4 flex flex-col items-start gap-1 whitespace-normal text-left" onClick={()=>edit(row)}><span className="text-sm font-medium">{format(parseISO(entryDate(row)),'EEE, MMM d')}</span>{detail(row)}</Button>)}
      </div>
    </>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>{editing?'Edit':'Add'} {training?'training':'account start'}</DialogTitle></DialogHeader>
      <form onSubmit={save} className="space-y-4"><fieldset disabled={!canEdit||saving} className="space-y-4">
        {training && <SearchPicker label="Worker" required value={form.worker_id} options={options.people.map(p=>({id:p.id,name:personName(p)}))} onChange={v=>setForm({...form,worker_id:v})} />}
        <SearchPicker label={training?'Training manager':'Manager'} required={training} value={form.manager_id} options={options.managers.map(p=>({id:p.id,name:personName(p)}))} onChange={v=>setForm({...form,manager_id:v})} />
        <SearchPicker label="Account" required value={form.job_site_id} options={options.accounts} onChange={v=>setForm({...form,job_site_id:v})} />
        <div className="space-y-2"><Label htmlFor="planner-date">{training?'Training date':'Planned start date'} *</Label><Input id="planner-date" type="date" required value={form.session_date} onChange={e=>setForm({...form,session_date:e.target.value})} /></div>
        {training && <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label htmlFor="planner-start">Start *</Label><Input id="planner-start" type="time" required value={form.start_time} onChange={e=>setForm({...form,start_time:e.target.value})} /></div><div className="space-y-2"><Label htmlFor="planner-end">End *</Label><Input id="planner-end" type="time" required value={form.end_time} onChange={e=>setForm({...form,end_time:e.target.value})} /></div></div>}
        <div className="space-y-2"><Label htmlFor="planner-notes">Notes</Label><Textarea id="planner-notes" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} /></div>
      </fieldset>
      {canEdit && <div className="flex justify-between gap-3">{editing?<Button type="button" variant="destructive" size="icon" aria-label="Remove entry" disabled={saving} onClick={()=>void remove()}><Trash2 className="h-4 w-4" /></Button>:<span/>}<Button type="submit" disabled={saving}>{saving?'Saving…':training?'Save draft':'Save'}</Button></div>}
      </form>
    </DialogContent></Dialog>
  </section>;
}