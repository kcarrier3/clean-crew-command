import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  addMonths,
  addDays,
  addWeeks,
  differenceInCalendarDays,
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
  X,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
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

const toDateInput = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const startOfDayFromInput = (value: string) => {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
};

const endOfDayFromInput = (value: string) => {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 23, 59, 59, 999);
};

const dayKeyToDate = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
};

const addDaysISO = (iso: string, days: number) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
};

function DayCell({ dayKey, children, className }: { dayKey: string; children: React.ReactNode; className?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${dayKey}` });
  return (
    <div ref={setNodeRef} className={cn(className, isOver && 'ring-2 ring-inset ring-primary/60 bg-primary/5')}>
      {children}
    </div>
  );
}

function DraftChip({
  draft,
  dayKey,
  isStart,
  isEnd,
  subtitle,
  onOpen,
  onRemoveDay,
  isMultiDay,
}: {
  draft: Draft;
  dayKey: string;
  isStart: boolean;
  isEnd: boolean;
  subtitle?: string;
  onOpen: () => void;
  onRemoveDay: () => void;
  isMultiDay: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${draft.id}|${dayKey}`,
    data: { draft, dayKey },
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      style={colorStyle(draft.color)}
      className={cn(
        'group relative w-full text-left text-[11px] leading-tight border px-1.5 py-1 truncate cursor-grab active:cursor-grabbing touch-none',
        isStart ? 'rounded-l' : 'rounded-l-none border-l-0',
        isEnd ? 'rounded-r' : 'rounded-r-none border-r-0',
        !draft.color && KIND_STYLE[draft.kind],
        draft.promoted_schedule_id && 'opacity-60 line-through',
        isDragging && 'opacity-30',
      )}
      title={draft.title}
    >
      <div className="font-medium truncate">{isStart ? draft.title : `↳ ${draft.title}`}</div>
      {subtitle && isStart && <div className="truncate opacity-80">{subtitle}</div>}
      {isMultiDay && (
        <button
          type="button"
          aria-label="Remove this day"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRemoveDay();
          }}
          className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-sm border bg-background/90 text-foreground opacity-70 hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

const CalendarPlanner = () => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );
  const [activeDrag, setActiveDrag] = useState<{ draft: Draft; dayKey: string } | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const [cursor, setCursor] = useState(new Date());
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [jobSites, setJobSites] = useState<JobSiteOpt[]>([]);
  const [filterKind, setFilterKind] = useState<DraftKind | 'all'>('all');
  const [editing, setEditing] = useState<Partial<Draft> | null>(null);
  const [editingDayKey, setEditingDayKey] = useState<string | null>(null);

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
      .lte('start_at', gridEnd.toISOString())
      .or(`end_at.gte.${gridStart.toISOString()},and(end_at.is.null,start_at.gte.${gridStart.toISOString()})`)
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
      const start = new Date(d.start_at);
      const end = d.end_at ? new Date(d.end_at) : start;
      const cursorDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const lastDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      // guard against bad ranges
      if (lastDay < cursorDay) lastDay.setTime(cursorDay.getTime());
      let guard = 0;
      while (cursorDay <= lastDay && guard < 400) {
        const key = format(cursorDay, 'yyyy-MM-dd');
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(d);
        cursorDay.setDate(cursorDay.getDate() + 1);
        guard += 1;
      }
    });
    return map;
  }, [filteredDrafts]);

  const openNew = (date?: Date) => {
    const start = date ? new Date(date) : new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    setEditing({
      title: '',
      notes: '',
      kind: 'shift_draft',
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      all_day: true,
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
      start_at: startOfDayFromInput(toDateInput(new Date(editing.start_at!))).toISOString(),
      end_at: endOfDayFromInput(
        toDateInput(new Date(editing.end_at ?? editing.start_at!)),
      ).toISOString(),
      all_day: true,
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

  // Remove a single day from a multi-day entry without deleting the whole series.
  const removeDayFromDraft = async (draft: Draft, dayKey: string) => {
    if (!user) return;
    const start = new Date(draft.start_at);
    const end = new Date(draft.end_at ?? draft.start_at);
    const startKey = format(start, 'yyyy-MM-dd');
    const endKey = format(end, 'yyyy-MM-dd');

    if (startKey === endKey) {
      const { error } = await supabase.from('calendar_drafts').delete().eq('id', draft.id);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }
      await loadDrafts();
      return;
    }

    if (dayKey === startKey) {
      const nextStart = startOfDayFromInput(format(addDays(start, 1), 'yyyy-MM-dd'));
      const { error } = await supabase
        .from('calendar_drafts')
        .update({ start_at: nextStart.toISOString() })
        .eq('id', draft.id);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }
    } else if (dayKey === endKey) {
      const nextEnd = endOfDayFromInput(format(addDays(end, -1), 'yyyy-MM-dd'));
      const { error } = await supabase
        .from('calendar_drafts')
        .update({ end_at: nextEnd.toISOString() })
        .eq('id', draft.id);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }
    } else {
      // Split into two entries around the removed day
      const removed = dayKeyToDate(dayKey);
      const firstEnd = endOfDayFromInput(format(addDays(removed, -1), 'yyyy-MM-dd'));
      const secondStart = startOfDayFromInput(format(addDays(removed, 1), 'yyyy-MM-dd'));
      const { error: upErr } = await supabase
        .from('calendar_drafts')
        .update({ end_at: firstEnd.toISOString() })
        .eq('id', draft.id);
      if (upErr) {
        toast({ title: 'Error', description: upErr.message, variant: 'destructive' });
        return;
      }
      const { error: insErr } = await supabase.from('calendar_drafts').insert({
        title: draft.title,
        kind: draft.kind,
        notes: draft.notes ?? null,
        start_at: secondStart.toISOString(),
        end_at: end.toISOString(),
        all_day: draft.all_day,
        employee_id: draft.employee_id ?? null,
        job_site_id: draft.job_site_id ?? null,
        color: draft.color ?? null,
        created_by: user.id,
      });
      if (insErr) {
        toast({ title: 'Error', description: insErr.message, variant: 'destructive' });
        return;
      }
    }
    await loadDrafts();
  };

  const handleDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current as { draft: Draft; dayKey: string } | undefined;
    if (data) setActiveDrag(data);
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    const data = e.active.data.current as { draft: Draft; dayKey: string } | undefined;
    setActiveDrag(null);
    const overId = e.over?.id as string | undefined;
    if (!data || !overId?.startsWith('day:')) return;
    const targetKey = overId.slice(4);
    if (targetKey === data.dayKey) return;
    const deltaDays = Math.round(
      (dayKeyToDate(targetKey).getTime() - dayKeyToDate(data.dayKey).getTime()) / 86400000,
    );
    if (!deltaDays) return;

    const draft = data.draft;
    const startKey = format(new Date(draft.start_at), 'yyyy-MM-dd');
    const endKey = format(new Date(draft.end_at ?? draft.start_at), 'yyyy-MM-dd');
    const isMultiDay = startKey !== endKey;

    // Multi-day entry: detach only the dragged day and move it independently.
    if (isMultiDay && user) {
      const newStart = startOfDayFromInput(targetKey);
      const newEnd = endOfDayFromInput(targetKey);
      const { error: insErr } = await supabase.from('calendar_drafts').insert({
        title: draft.title,
        kind: draft.kind,
        notes: draft.notes ?? null,
        start_at: newStart.toISOString(),
        end_at: newEnd.toISOString(),
        all_day: draft.all_day,
        employee_id: draft.employee_id ?? null,
        job_site_id: draft.job_site_id ?? null,
        color: draft.color ?? null,
        created_by: user.id,
      });
      if (insErr) {
        toast({ title: 'Could not move entry', description: insErr.message, variant: 'destructive' });
        return;
      }
      await removeDayFromDraft(draft, data.dayKey);
      return;
    }

    const nextStart = addDaysISO(draft.start_at, deltaDays);
    const nextEnd = draft.end_at ? addDaysISO(draft.end_at, deltaDays) : null;

    const previous = drafts;
    setDrafts((cur) =>
      cur.map((d) => (d.id === draft.id ? { ...d, start_at: nextStart, end_at: nextEnd } : d)),
    );

    const { error } = await supabase
      .from('calendar_drafts')
      .update({ start_at: nextStart, end_at: nextEnd })
      .eq('id', draft.id);
    if (error) {
      setDrafts(previous);
      toast({ title: 'Could not move entry', description: error.message, variant: 'destructive' });
      return;
    }
    await loadDrafts();
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
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
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
                <DayCell
                  key={key}
                  dayKey={key}
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
                    {items.map((d) => {
                      const isStart = format(new Date(d.start_at), 'yyyy-MM-dd') === key;
                      const isEnd =
                        format(new Date(d.end_at ?? d.start_at), 'yyyy-MM-dd') === key;
                      return (
                        <DraftChip
                          key={d.id}
                          draft={d}
                          dayKey={key}
                          isStart={isStart}
                          isEnd={isEnd}
                          subtitle={d.job_site_id ? siteName(d.job_site_id) : undefined}
                          onOpen={() => { setEditingDayKey(key); setEditing(d); }}
                          isMultiDay={!(isStart && isEnd)}
                          onRemoveDay={() => removeDayFromDraft(d, key)}
                        />
                      );
                    })}
                  </div>
                </DayCell>
              );
            })}
          </div>
          <DragOverlay dropAnimation={null}>
            {activeDrag && (
              <div
                style={colorStyle(activeDrag.draft.color)}
                className={cn(
                  'text-[11px] leading-tight border rounded px-1.5 py-1 shadow-lg bg-background',
                  !activeDrag.draft.color && KIND_STYLE[activeDrag.draft.kind],
                )}
              >
                {activeDrag.draft.title}
              </div>
            )}
          </DragOverlay>
          </DndContext>
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
                  <p className="text-xs text-muted-foreground pb-2">
                    All-day entry — spans every day in the range.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Start date</Label>
                  <Input
                    type="date"
                    value={editing.start_at ? toDateInput(new Date(editing.start_at)) : ''}
                    onChange={(e) => {
                      if (!e.target.value) return;
                      const nextStart = startOfDayFromInput(e.target.value);
                      const currentEnd = editing.end_at ? new Date(editing.end_at) : null;
                      setEditing({
                        ...editing,
                        start_at: nextStart.toISOString(),
                        end_at:
                          currentEnd && currentEnd >= nextStart
                            ? currentEnd.toISOString()
                            : endOfDayFromInput(e.target.value).toISOString(),
                      });
                    }}
                  />
                </div>
                <div>
                  <Label>End date</Label>
                  <Input
                    type="date"
                    min={editing.start_at ? toDateInput(new Date(editing.start_at)) : undefined}
                    value={editing.end_at ? toDateInput(new Date(editing.end_at)) : ''}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        end_at: e.target.value
                          ? endOfDayFromInput(e.target.value).toISOString()
                          : null,
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
            <div className="flex flex-wrap gap-2">
              {editing?.id && editingDayKey &&
                format(new Date(editing.start_at as string), 'yyyy-MM-dd') !==
                  format(new Date((editing.end_at as string) ?? (editing.start_at as string)), 'yyyy-MM-dd') && (
                <Button
                  variant="outline"
                  onClick={async () => {
                    await removeDayFromDraft(editing as Draft, editingDayKey);
                    setEditing(null);
                    setEditingDayKey(null);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete this day only
                </Button>
              )}
              {editing?.id && (
                <Button variant="destructive" onClick={deleteDraft}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete entire event
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