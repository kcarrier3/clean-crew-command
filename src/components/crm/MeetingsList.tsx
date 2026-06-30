import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Calendar, MapPin, Pencil } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { MEETING_STATUS_LABELS } from './types';
import type { CrmMeeting, CrmMeetingStatus, CrmDeal, CrmCompany } from './types';

export function MeetingsList() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [meetings, setMeetings] = useState<CrmMeeting[]>([]);
  const [deals, setDeals] = useState<CrmDeal[]>([]);
  const [companies, setCompanies] = useState<CrmCompany[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CrmMeeting | null>(null);
  const [form, setForm] = useState({
    title: '', description: '', start_at: '', end_at: '', location: '',
    meeting_url: '', deal_id: '', company_id: '', status: 'scheduled' as CrmMeetingStatus, notes: '',
  });

  const load = async () => {
    const [{ data: m }, { data: d }, { data: c }] = await Promise.all([
      (supabase as any).from('crm_meetings').select('*').order('start_at', { ascending: true }),
      (supabase as any).from('crm_deals').select('id,name'),
      (supabase as any).from('crm_companies').select('id,name'),
    ]);
    setMeetings(m || []); setDeals(d || []); setCompanies(c || []);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    const now = new Date();
    now.setMinutes(0, 0, 0); now.setHours(now.getHours() + 1);
    setForm({
      title: '', description: '', start_at: now.toISOString().slice(0, 16), end_at: '',
      location: '', meeting_url: '', deal_id: '', company_id: '', status: 'scheduled', notes: '',
    });
    setOpen(true);
  };
  const openEdit = (m: CrmMeeting) => {
    setEditing(m);
    setForm({
      title: m.title, description: m.description || '',
      start_at: m.start_at.slice(0, 16),
      end_at: m.end_at ? m.end_at.slice(0, 16) : '',
      location: m.location || '', meeting_url: m.meeting_url || '',
      deal_id: m.deal_id || '', company_id: m.company_id || '',
      status: m.status, notes: m.notes || '',
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.title.trim() || !form.start_at) { toast({ title: 'Title and start required', variant: 'destructive' }); return; }
    const payload: any = {
      title: form.title.trim(), description: form.description.trim() || null,
      start_at: new Date(form.start_at).toISOString(),
      end_at: form.end_at ? new Date(form.end_at).toISOString() : null,
      location: form.location.trim() || null,
      meeting_url: form.meeting_url.trim() || null,
      deal_id: form.deal_id || null,
      company_id: form.company_id || null,
      status: form.status,
      notes: form.notes.trim() || null,
    };
    if (editing) {
      const { error } = await (supabase as any).from('crm_meetings').update(payload).eq('id', editing.id);
      if (error) { toast({ title: 'Save failed', description: error.message, variant: 'destructive' }); return; }
    } else {
      payload.created_by = user?.id; payload.owner_id = user?.id;
      const { error } = await (supabase as any).from('crm_meetings').insert(payload);
      if (error) { toast({ title: 'Save failed', description: error.message, variant: 'destructive' }); return; }
    }
    toast({ title: 'Meeting saved' });
    setOpen(false); load();
  };

  const upcoming = meetings.filter(m => new Date(m.start_at) >= new Date() && m.status === 'scheduled');
  const past = meetings.filter(m => !(new Date(m.start_at) >= new Date() && m.status === 'scheduled'));

  const renderMeeting = (m: CrmMeeting) => (
    <Card key={m.id}>
      <CardContent className="p-3 flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold">{m.title}</p>
            <Badge variant="outline" className="text-xs">{MEETING_STATUS_LABELS[m.status]}</Badge>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
            <Calendar className="h-3 w-3" />
            {format(new Date(m.start_at), 'MMM d, yyyy h:mm a')}
            {m.end_at && ` – ${format(new Date(m.end_at), 'h:mm a')}`}
          </p>
          {m.location && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {m.location}
            </p>
          )}
        </div>
        <Button size="sm" variant="ghost" onClick={() => openEdit(m)}><Pencil className="h-3 w-3" /></Button>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Meetings</h3>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Schedule Meeting</Button>
      </div>

      <div>
        <p className="text-sm font-medium text-muted-foreground mb-2">Upcoming ({upcoming.length})</p>
        <div className="space-y-2">
          {upcoming.length ? upcoming.map(renderMeeting) : <p className="text-xs text-muted-foreground">No upcoming meetings.</p>}
        </div>
      </div>

      {past.length > 0 && (
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">Past / Other</p>
          <div className="space-y-2">{past.slice(0, 20).map(renderMeeting)}</div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Edit Meeting' : 'Schedule Meeting'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Start *</Label><Input type="datetime-local" value={form.start_at} onChange={e => setForm({ ...form, start_at: e.target.value })} /></div>
              <div><Label>End</Label><Input type="datetime-local" value={form.end_at} onChange={e => setForm({ ...form, end_at: e.target.value })} /></div>
            </div>
            <div><Label>Location</Label><Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></div>
            <div><Label>Meeting URL</Label><Input value={form.meeting_url} onChange={e => setForm({ ...form, meeting_url: e.target.value })} placeholder="Zoom, Meet…" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Linked Deal</Label>
                <Select value={form.deal_id || 'none'} onValueChange={v => setForm({ ...form, deal_id: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {deals.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Linked Company</Label>
                <Select value={form.company_id || 'none'} onValueChange={v => setForm({ ...form, company_id: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v as CrmMeetingStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(MEETING_STATUS_LABELS) as CrmMeetingStatus[]).map(s => (
                    <SelectItem key={s} value={s}>{MEETING_STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}