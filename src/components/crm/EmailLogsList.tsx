import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Mail, ArrowDown, ArrowUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import type { CrmEmailLog, CrmDeal } from './types';

export function EmailLogsList() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [logs, setLogs] = useState<CrmEmailLog[]>([]);
  const [deals, setDeals] = useState<CrmDeal[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    direction: 'outbound' as 'outbound' | 'inbound',
    subject: '', body: '', from_email: '', to_emails: '', deal_id: '',
    sent_at: new Date().toISOString().slice(0, 16),
  });

  const load = async () => {
    const [{ data: l }, { data: d }] = await Promise.all([
      (supabase as any).from('crm_email_logs').select('*').order('sent_at', { ascending: false }).limit(100),
      (supabase as any).from('crm_deals').select('id,name'),
    ]);
    setLogs(l || []); setDeals(d || []);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setForm({
      direction: 'outbound', subject: '', body: '', from_email: '', to_emails: '', deal_id: '',
      sent_at: new Date().toISOString().slice(0, 16),
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.subject.trim() && !form.body.trim()) {
      toast({ title: 'Subject or body required', variant: 'destructive' }); return;
    }
    const toList = form.to_emails.split(',').map(s => s.trim()).filter(Boolean);
    const { error } = await (supabase as any).from('crm_email_logs').insert({
      direction: form.direction,
      subject: form.subject.trim() || null,
      body: form.body.trim() || null,
      from_email: form.from_email.trim() || null,
      to_emails: toList,
      deal_id: form.deal_id || null,
      sent_at: new Date(form.sent_at).toISOString(),
      logged_by: user?.id,
      status: 'logged',
    });
    if (error) { toast({ title: 'Save failed', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Email logged' });
    setOpen(false); load();
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold flex items-center gap-2"><Mail className="h-4 w-4" /> Email Log</h3>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Log Email</Button>
      </div>

      <div className="space-y-2">
        {logs.map(l => (
          <Card key={l.id}>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {l.direction === 'outbound' ? <ArrowUp className="h-3 w-3 mr-1" /> : <ArrowDown className="h-3 w-3 mr-1" />}
                  {l.direction}
                </Badge>
                <p className="font-medium text-sm">{l.subject || '(no subject)'}</p>
                <span className="text-xs text-muted-foreground ml-auto">{format(new Date(l.sent_at), 'MMM d, h:mm a')}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {l.from_email && <>From {l.from_email} • </>}
                To {l.to_emails.join(', ') || '—'}
              </p>
              {l.body && <p className="text-xs mt-2 line-clamp-3 whitespace-pre-wrap">{l.body}</p>}
            </CardContent>
          </Card>
        ))}
        {logs.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            No emails logged yet. Log outbound and inbound messages to keep a paper trail per deal.
          </p>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Log Email</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Direction</Label>
                <Select value={form.direction} onValueChange={v => setForm({ ...form, direction: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="outbound">Outbound (sent)</SelectItem>
                    <SelectItem value="inbound">Inbound (received)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Sent At</Label><Input type="datetime-local" value={form.sent_at} onChange={e => setForm({ ...form, sent_at: e.target.value })} /></div>
            </div>
            <div><Label>From</Label><Input value={form.from_email} onChange={e => setForm({ ...form, from_email: e.target.value })} /></div>
            <div><Label>To (comma-separated)</Label><Input value={form.to_emails} onChange={e => setForm({ ...form, to_emails: e.target.value })} /></div>
            <div><Label>Subject</Label><Input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} /></div>
            <div><Label>Body</Label><Textarea rows={4} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} /></div>
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