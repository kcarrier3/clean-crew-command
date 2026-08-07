import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, Clock, FileSignature, CheckCircle, XCircle, Link2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { SignaturePad } from './SignaturePad';
import { format } from 'date-fns';

interface TMTicketsProps {
  jobSiteId: string;
  onHoursChange?: () => void;
}

interface HourLine {
  id: string;
  employee_id: string | null;
  time_entry_id: string | null;
  work_date: string;
  hours: number;
  notes: string | null;
}

interface Ticket {
  id: string;
  ticket_number: string | null;
  title: string;
  description: string | null;
  work_date: string;
  status: string;
  total_hours: number;
  customer_name: string | null;
  customer_signature_data: string | null;
  customer_signed_at: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_by: string;
}

const statusMeta: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  draft: { label: 'Draft', variant: 'outline' },
  pending_approval: { label: 'Pending approval', variant: 'secondary' },
  approved: { label: 'Approved', variant: 'default' },
  rejected: { label: 'Rejected', variant: 'destructive' },
};

export const TMTickets = ({ jobSiteId, onHoursChange }: TMTicketsProps) => {
  const { user, isManager, profile } = useAuth();
  const { toast } = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<Ticket | null>(null);
  const [lines, setLines] = useState<HourLine[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [punches, setPunches] = useState<any[]>([]);
  const [form, setForm] = useState({ title: '', description: '', work_date: format(new Date(), 'yyyy-MM-dd'), ticket_number: '' });
  const [newLine, setNewLine] = useState({ employee_id: '', work_date: format(new Date(), 'yyyy-MM-dd'), hours: '', notes: '' });
  const [customerName, setCustomerName] = useState('');

  const canApprove = isManager() || ['Owner', 'Operations Manager', 'Office Manager', 'Project Crew Lead', 'Night Manager', 'Janitorial Manager'].includes(profile?.job_title || '');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tm_tickets')
      .select('*')
      .eq('job_site_id', jobSiteId)
      .order('work_date', { ascending: false });
    if (error) toast({ title: 'Failed to load T&M tickets', description: error.message, variant: 'destructive' });
    setTickets((data as any) || []);
    setLoading(false);
  }, [jobSiteId, toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    supabase.from('profiles').select('id, first_name, last_name').eq('active', true).order('last_name')
      .then(({ data }) => setEmployees((data || []).map((p: any) => ({ id: p.id, name: `${p.first_name} ${p.last_name}` }))));
  }, []);

  const openTicket = async (t: Ticket) => {
    setActive(t);
    setCustomerName(t.customer_name || '');
    const [{ data: l }, { data: p }] = await Promise.all([
      supabase.from('tm_ticket_hours').select('*').eq('ticket_id', t.id).order('work_date'),
      supabase.from('time_entries').select('id, employee_id, clock_in, clock_out, profiles:employee_id(first_name,last_name)')
        .eq('job_site_id', jobSiteId).not('clock_out', 'is', null).order('clock_in', { ascending: false }).limit(100),
    ]);
    setLines((l as any) || []);
    setPunches(p || []);
  };

  const refreshActive = async (id: string) => {
    const { data } = await supabase.from('tm_tickets').select('*').eq('id', id).maybeSingle();
    if (data) setActive(data as any);
    const { data: l } = await supabase.from('tm_ticket_hours').select('*').eq('ticket_id', id).order('work_date');
    setLines((l as any) || []);
    load();
    onHoursChange?.();
  };

  const createTicket = async () => {
    if (!form.title.trim()) return;
    const { data, error } = await supabase.from('tm_tickets').insert({
      job_site_id: jobSiteId,
      title: form.title.trim(),
      description: form.description || null,
      work_date: form.work_date,
      ticket_number: form.ticket_number || null,
      created_by: user?.id,
    }).select().maybeSingle();
    if (error) { toast({ title: 'Could not create ticket', description: error.message, variant: 'destructive' }); return; }
    setOpen(false);
    setForm({ title: '', description: '', work_date: format(new Date(), 'yyyy-MM-dd'), ticket_number: '' });
    await load();
    if (data) openTicket(data as any);
  };

  const addLine = async () => {
    if (!active || !newLine.hours) return;
    const { error } = await supabase.from('tm_ticket_hours').insert({
      ticket_id: active.id,
      employee_id: newLine.employee_id || null,
      work_date: newLine.work_date,
      hours: parseFloat(newLine.hours),
      notes: newLine.notes || null,
    });
    if (error) { toast({ title: 'Could not add hours', description: error.message, variant: 'destructive' }); return; }
    setNewLine({ employee_id: '', work_date: format(new Date(), 'yyyy-MM-dd'), hours: '', notes: '' });
    refreshActive(active.id);
  };

  const linkPunch = async (punch: any) => {
    if (!active) return;
    const hours = (new Date(punch.clock_out).getTime() - new Date(punch.clock_in).getTime()) / 3600000;
    const { error } = await supabase.from('tm_ticket_hours').insert({
      ticket_id: active.id,
      employee_id: punch.employee_id,
      time_entry_id: punch.id,
      work_date: format(new Date(punch.clock_in), 'yyyy-MM-dd'),
      hours: Math.round(hours * 100) / 100,
      notes: 'Linked time punch',
    });
    if (error) { toast({ title: 'Could not link punch', description: error.message, variant: 'destructive' }); return; }
    refreshActive(active.id);
  };

  const removeLine = async (id: string) => {
    if (!active) return;
    await supabase.from('tm_ticket_hours').delete().eq('id', id);
    refreshActive(active.id);
  };

  const saveSignature = async (data: string) => {
    if (!active) return;
    const autoApprove = canApprove && active.status !== 'approved';
    const { error } = await supabase.from('tm_tickets').update({
      customer_name: customerName || null,
      customer_signature_data: data,
      customer_signed_at: new Date().toISOString(),
      status: autoApprove
        ? 'approved'
        : (active.status === 'draft' || active.status === 'rejected' ? 'pending_approval' : active.status),
      ...(autoApprove ? { approved_by: user?.id, approved_at: new Date().toISOString() } : {}),
    }).eq('id', active.id);
    if (error) { toast({ title: 'Could not save signature', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Signature captured', description: autoApprove ? 'Ticket approved — hours added to the project budget.' : 'Ticket sent for manager approval.' });
    refreshActive(active.id);
  };

  const decide = async (status: 'approved' | 'rejected') => {
    if (!active) return;
    if (status === 'approved' && !active.customer_signature_data) {
      toast({ title: 'Customer signature required', description: 'Capture the sign-off before approving.', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('tm_tickets').update({
      status,
      approved_by: status === 'approved' ? user?.id : null,
      approved_at: status === 'approved' ? new Date().toISOString() : null,
    }).eq('id', active.id);
    if (error) { toast({ title: 'Update failed', description: error.message, variant: 'destructive' }); return; }
    toast({ title: status === 'approved' ? 'Ticket approved' : 'Ticket rejected', description: status === 'approved' ? 'Hours added to the project budget.' : undefined });
    refreshActive(active.id);
  };

  const approvedHours = tickets.filter(t => t.status === 'approved').reduce((s, t) => s + Number(t.total_hours || 0), 0);
  const pendingHours = tickets.filter(t => t.status !== 'approved' && t.status !== 'rejected').reduce((s, t) => s + Number(t.total_hours || 0), 0);
  const editable = !!active && (active.status === 'draft' || active.status === 'rejected');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="font-semibold">T&amp;M Tickets</h3>
          <p className="text-xs text-muted-foreground">
            {approvedHours}h approved · {pendingHours}h pending. Approved hours add to the project budget.
          </p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />New ticket
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : tickets.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No T&amp;M tickets yet.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {tickets.map(t => (
            <Card key={t.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => openTicket(t)}>
              <CardContent className="p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{t.ticket_number ? `#${t.ticket_number} · ` : ''}{t.title}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(t.work_date), 'MMM d, yyyy')}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-semibold">{Number(t.total_hours)}h</span>
                  <Badge variant={statusMeta[t.status]?.variant || 'outline'}>{statusMeta[t.status]?.label || t.status}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New T&amp;M ticket</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Extra work performed" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Ticket #</Label><Input value={form.ticket_number} onChange={e => setForm({ ...form, ticket_number: e.target.value })} /></div>
              <div><Label>Work date</Label><Input type="date" value={form.work_date} onChange={e => setForm({ ...form, work_date: e.target.value })} /></div>
            </div>
            <div><Label>Scope / description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={createTicket}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!active} onOpenChange={o => { if (!o) setActive(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {active && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 flex-wrap">
                  {active.ticket_number ? `#${active.ticket_number} · ` : ''}{active.title}
                  <Badge variant={statusMeta[active.status]?.variant || 'outline'}>{statusMeta[active.status]?.label || active.status}</Badge>
                </DialogTitle>
              </DialogHeader>

              {active.description && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{active.description}</p>}

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4" />Hours ({Number(active.total_hours)}h)</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {lines.length === 0 && <p className="text-sm text-muted-foreground">No hours recorded.</p>}
                  {lines.map(l => (
                    <div key={l.id} className="flex items-center justify-between gap-2 text-sm border-b pb-1">
                      <div className="min-w-0">
                        <p className="truncate">{employees.find(e => e.id === l.employee_id)?.name || 'Unassigned'}{l.time_entry_id ? ' · punch' : ''}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(l.work_date + 'T00:00:00'), 'MMM d')}{l.notes ? ` · ${l.notes}` : ''}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-medium">{Number(l.hours)}h</span>
                        {editable && <Button size="icon" variant="ghost" onClick={() => removeLine(l.id)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                      </div>
                    </div>
                  ))}

                  {editable && (
                    <>
                      <Separator className="my-2" />
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <select
                          className="h-9 rounded-md border bg-background px-2 text-sm"
                          value={newLine.employee_id}
                          onChange={e => setNewLine({ ...newLine, employee_id: e.target.value })}
                        >
                          <option value="">Employee…</option>
                          {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                        <Input type="date" value={newLine.work_date} onChange={e => setNewLine({ ...newLine, work_date: e.target.value })} />
                        <Input type="number" step="0.25" placeholder="Hours" value={newLine.hours} onChange={e => setNewLine({ ...newLine, hours: e.target.value })} />
                        <Button onClick={addLine}><Plus className="h-4 w-4 mr-1" />Add</Button>
                      </div>
                      <Input placeholder="Notes (optional)" value={newLine.notes} onChange={e => setNewLine({ ...newLine, notes: e.target.value })} />
                    </>
                  )}
                </CardContent>
              </Card>

              {editable && punches.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Link2 className="h-4 w-4" />Link a time punch</CardTitle></CardHeader>
                  <CardContent className="space-y-1 max-h-48 overflow-y-auto">
                    {punches
                      .filter(p => !lines.some(l => l.time_entry_id === p.id))
                      .slice(0, 25)
                      .map(p => (
                        <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
                          <span className="truncate">
                            {p.profiles ? `${p.profiles.first_name} ${p.profiles.last_name}` : 'Employee'} · {format(new Date(p.clock_in), 'MMM d, p')}
                          </span>
                          <Button size="sm" variant="outline" onClick={() => linkPunch(p)}>Add</Button>
                        </div>
                      ))}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><FileSignature className="h-4 w-4" />Customer sign-off</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {active.customer_signature_data ? (
                    <div className="space-y-1">
                      <img src={active.customer_signature_data} alt="Customer signature" className="border rounded bg-background max-h-24" />
                      <p className="text-xs text-muted-foreground">
                        Signed by {active.customer_name || 'customer'}
                        {active.customer_signed_at ? ` on ${format(new Date(active.customer_signed_at), 'MMM d, yyyy p')}` : ''}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div><Label>Customer name</Label><Input value={customerName} onChange={e => setCustomerName(e.target.value)} /></div>
                      <SignaturePad onSignature={(data) => saveSignature(data)} />
                    </>
                  )}
                </CardContent>
              </Card>

              {active.rejection_reason && <p className="text-sm text-destructive">Rejected: {active.rejection_reason}</p>}

              {canApprove && active.status !== 'approved' && (
                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => decide('rejected')}><XCircle className="h-4 w-4 mr-2" />Reject</Button>
                  <Button onClick={() => decide('approved')}><CheckCircle className="h-4 w-4 mr-2" />Approve &amp; add hours</Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TMTickets;
