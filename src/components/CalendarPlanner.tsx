import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  CalendarRange,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type DraftKind = 'shift_draft' | 'event' | 'holiday' | 'note';

interface Draft {
  id: string;
  title: string;
  notes: string | null;
  kind: DraftKind;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
  employee_id: string | null;
  job_site_id: string | null;
  color: string | null;
  promoted_schedule_id: string | null;
}

interface JobSiteOpt { id: string; name: string }

const KIND_LABEL: Record<DraftKind, string> = {
  shift_draft: 'Shift draft',
  event: 'Event',
  holiday: 'Holiday',
  note: 'Note',
};

const KIND_STYLE: Record<DraftKind, string> = {
  shift_draft: 'bg-primary/15 text-primary border-primary/30',
  event: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
  holiday: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
  note: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
};

const COLOR_SWATCHES: { label: string; value: string }[] = [
  { label: 'Default', value: '' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Green', value: '#10b981' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Rose', value: '#f43f5e' },
  { label: 'Violet', value: '#8b5cf6' },
  { label: 'Teal', value: '#14b8a6' },
  { label: 'Slate', value: '#64748b' },
];

const hexToRgba = (hex: string, alpha: number) => {
  const h = hex.replace('#', '');
  const bigint = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r},${g},${b},${alpha})`;
};

const colorStyle = (color: string | null | undefined): CSSProperties | undefined => {
  if (!color) return undefined;
  return {
    backgroundColor: hexToRgba(color, 0.18),
    borderColor: hexToRgba(color, 0.5),
    color: color,
  };
};

const toLocalInput = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const CalendarPlanner = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [cursor, setCursor] = useState(new Date());
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [jobSites, setJobSites] = useState<JobSiteOpt[]>([]);
  const [filterKind, setFilterKind] = useState<DraftKind | 'all'>('all');
  const [editing, setEditing] = useState<Partial<Draft> | null>(null);

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(monthEnd);

  const days = useMemo(() => {
    const out: Date[] = [];
    const d = new Date(gridStart);
    while (d <= gridEnd) {
      out.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return out;
  }, [gridStart, gridEnd]);

  useEffect(() => {
    void loadDrafts();
    void loadLookups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor]);

  const loadDrafts = async () => {
    const { data, error } = await supabase
      .from('calendar_drafts')
      .select('*')
      .gte('start_at', gridStart.toISOString())
      .lte('start_at', gridEnd.toISOString())
      .order('start_at');
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    setDrafts((data ?? []) as Draft[]);
  };

  const loadLookups = async () => {
    const sites = await supabase
      .from('job_sites')
      .select('id, name')
      .eq('active', true)
      .order('name');
    if (sites.data) setJobSites(sites.data as JobSiteOpt[]);
  };

  const filteredDrafts = drafts.filter(
    (d) => filterKind === 'all' || d.kind === filterKind,
  );

  const draftsByDay = useMemo(() => {
    const map = new Map<string, Draft[]>();
    filteredDrafts.forEach((d) => {
      const key = format(new Date(d.start_at), 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    });
    return map;
  }, [filteredDrafts]);

  const openNew = (date?: Date) => {
    const start = date ? new Date(date) : new Date();
    start.setHours(8, 0, 0, 0);
    const end = new Date(start);
    end.setHours(start.getHours() + 8);
    setEditing({
      title: '',
      notes: '',
      kind: 'shift_draft',
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      all_day: false,
      employee_id: null,
      job_site_id: null,
      color: '',
    });
  };

  const saveDraft = async () => {
    if (!editing || !user) return;
    if (!editing.title?.trim()) {
      toast({ title: 'Title required', variant: 'destructive' });
      return;
    }
    const payload = {
      title: editing.title!,
      notes: editing.notes ?? null,
      kind: (editing.kind ?? 'shift_draft') as DraftKind,
      start_at: editing.start_at!,
      end_at: editing.end_at ?? null,
      all_day: !!editing.all_day,
      employee_id: editing.employee_id ?? null,
      job_site_id: editing.job_site_id ?? null,
      color: editing.color ?? null,
    };
    if (editing.id) {
      const { error } = await supabase
        .from('calendar_drafts')
        .update(payload)
        .eq('id', editing.id);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }
    } else {
      const { error } = await supabase
        .from('calendar_drafts')
        .insert({ ...payload, created_by: user.id });
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }
    }
    setEditing(null);
    await loadDrafts();
  };

  const deleteDraft = async () => {
    if (!editing?.id) return;
    const { error } = await supabase
      .from('calendar_drafts')
      .delete()
      .eq('id', editing.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    setEditing(null);
    await loadDrafts();
  };

  const siteName = (id: string | null) => {
    if (!id) return '';
    return jobSites.find((x) => x.id === id)?.name ?? '';
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle className="flex items-center gap-2">
            <CalendarRange className="h-5 w-5 text-primary" />
            Planning Calendar
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCursor(addMonths(cursor, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-medium min-w-[140px] text-center">
              {format(cursor, 'MMMM yyyy')}
            </div>
            <Button variant="outline" size="sm" onClick={() => setCursor(addMonths(cursor, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>
              Today
            </Button>
            <Select value={filterKind} onValueChange={(v) => setFilterKind(v as DraftKind | 'all')}>
              <SelectTrigger className="w-[150px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All kinds</SelectItem>
                <SelectItem value="shift_draft">Shift drafts</SelectItem>
                <SelectItem value="event">Events</SelectItem>
                <SelectItem value="holiday">Holidays</SelectItem>
                <SelectItem value="note">Notes</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => openNew()}>
              <Plus className="h-4 w-4 mr-1" />
              Draft
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-px bg-border rounded-md overflow-hidden text-sm">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="bg-muted/60 px-2 py-1 text-xs font-semibold text-muted-foreground">
                {d}
              </div>
            ))}
            {days.map((day) => {
              const key = format(day, 'yyyy-MM-dd');
              const items = draftsByDay.get(key) ?? [];
              const muted = !isSameMonth(day, cursor);
              return (
                <div
                  key={key}
                  className={cn(
                    'min-h-[110px] bg-background p-1.5 align-top',
                    muted && 'bg-muted/30 text-muted-foreground',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <button
                      className={cn(
                        'text-xs font-medium rounded px-1.5 py-0.5 hover:bg-muted',
                        isSameDay(day, new Date()) && 'bg-primary text-primary-foreground hover:bg-primary',
                      )}
                      onClick={() => openNew(day)}
                    >
                      {format(day, 'd')}
                    </button>
                  </div>
                  <div className="mt-1 space-y-1">
                    {items.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => setEditing(d)}
                        style={colorStyle(d.color)}
                        className={cn(
                          'w-full text-left text-[11px] leading-tight rounded border px-1.5 py-1 truncate',
                          !d.color && KIND_STYLE[d.kind],
                          d.promoted_schedule_id && 'opacity-60 line-through',
                        )}
                        title={d.title}
                      >
                        <div className="font-medium truncate">{d.title}</div>
                        {d.job_site_id && (
                          <div className="truncate opacity-80">{siteName(d.job_site_id)}</div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-4 text-xs text-muted-foreground">
            {(Object.keys(KIND_LABEL) as DraftKind[]).map((k) => (
              <span key={k} className="flex items-center gap-1.5">
                <span className={cn('inline-block w-3 h-3 rounded border', KIND_STYLE[k])} />
                {KIND_LABEL[k]}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Edit draft' : 'New draft'}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Title</Label>
                <Input
                  value={editing.title ?? ''}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Kind</Label>
                  <Select
                    value={(editing.kind ?? 'shift_draft') as string}
                    onValueChange={(v) => setEditing({ ...editing, kind: v as DraftKind })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="shift_draft">Shift draft</SelectItem>
                      <SelectItem value="event">Event</SelectItem>
                      <SelectItem value="holiday">Holiday</SelectItem>
                      <SelectItem value="note">Note</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!editing.all_day}
                      onChange={(e) => setEditing({ ...editing, all_day: e.target.checked })}
                    />
                    All day
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Start</Label>
                  <Input
                    type="datetime-local"
                    value={editing.start_at ? toLocalInput(new Date(editing.start_at)) : ''}
                    onChange={(e) =>
                      setEditing({ ...editing, start_at: new Date(e.target.value).toISOString() })
                    }
                  />
                </div>
                <div>
                  <Label>End</Label>
                  <Input
                    type="datetime-local"
                    value={editing.end_at ? toLocalInput(new Date(editing.end_at)) : ''}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        end_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                      })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Account</Label>
                  <Select
                    value={editing.job_site_id ?? 'none'}
                    onValueChange={(v) =>
                      setEditing({ ...editing, job_site_id: v === 'none' ? null : v })
                    }
                  >
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {jobSites.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Color</Label>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    {COLOR_SWATCHES.map((c) => {
                      const selected = (editing.color ?? '') === c.value;
                      return (
                        <button
                          key={c.label}
                          type="button"
                          onClick={() => setEditing({ ...editing, color: c.value })}
                          className={cn(
                            'h-6 w-6 rounded-full border-2 transition',
                            selected ? 'border-foreground ring-2 ring-offset-1 ring-foreground/30' : 'border-border',
                          )}
                          style={{
                            backgroundColor: c.value || 'transparent',
                            backgroundImage: c.value
                              ? undefined
                              : 'linear-gradient(45deg, transparent 45%, hsl(var(--muted-foreground)) 45%, hsl(var(--muted-foreground)) 55%, transparent 55%)',
                          }}
                          title={c.label}
                          aria-label={c.label}
                        />
                      );
                    })}
                    <Input
                      type="color"
                      value={editing.color || '#3b82f6'}
                      onChange={(e) => setEditing({ ...editing, color: e.target.value })}
                      className="h-8 w-12 p-1"
                      aria-label="Custom color"
                    />
                  </div>
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  rows={2}
                  value={editing.notes ?? ''}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                />
              </div>
              {editing.id && (
                <div className="text-xs text-muted-foreground">
                  {editing.job_site_id && <Badge variant="secondary">{siteName(editing.job_site_id!)}</Badge>}
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex justify-between sm:justify-between">
            <div>
              {editing?.id && (
                <Button variant="destructive" onClick={deleteDraft}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={saveDraft}>Save</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarPlanner;