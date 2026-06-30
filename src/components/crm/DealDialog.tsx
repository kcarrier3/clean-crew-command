import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Phone, Mail, Users, FileText, CheckCircle2, FileDown, Pencil } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { QuoteBuilder } from './QuoteBuilder';
import type { CrmDeal, CrmStage, CrmActivity, CrmLead, CrmQuote, CrmQuoteItem } from './types';
import { generateQuotePdf } from './generateQuotePdf';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: CrmDeal | null;
  stages: CrmStage[];
  leads: CrmLead[];
  onChanged: () => void;
}

const ACT_ICONS = { call: Phone, email: Mail, meeting: Users, note: FileText, task: CheckCircle2 };

export function DealDialog({ open, onOpenChange, deal, stages, leads, onChanged }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [form, setForm] = useState({
    name: '', stage_id: '', value: 0, expected_close_date: '', probability: 50,
    lead_id: '', notes: '', lost_reason: '',
  });
  const [activities, setActivities] = useState<CrmActivity[]>([]);
  const [quotes, setQuotes] = useState<CrmQuote[]>([]);
  const [newAct, setNewAct] = useState({ type: 'note' as CrmActivity['type'], subject: '', body: '', due_at: '' });
  const [quoteBuilderOpen, setQuoteBuilderOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<CrmQuote | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (deal) {
      setForm({
        name: deal.name,
        stage_id: deal.stage_id,
        value: Number(deal.value) || 0,
        expected_close_date: deal.expected_close_date || '',
        probability: deal.probability ?? 50,
        lead_id: deal.lead_id || '',
        notes: deal.notes || '',
        lost_reason: deal.lost_reason || '',
      });
      loadRelated();
    } else if (open) {
      const firstStage = stages.find(s => !s.is_won && !s.is_lost) || stages[0];
      setForm({ name: '', stage_id: firstStage?.id || '', value: 0, expected_close_date: '', probability: 50, lead_id: '', notes: '', lost_reason: '' });
      setActivities([]); setQuotes([]);
    }
  }, [deal, open]);

  const loadRelated = async () => {
    if (!deal) return;
    const [{ data: acts }, { data: qs }] = await Promise.all([
      (supabase as any).from('crm_activities').select('*').eq('deal_id', deal.id).order('created_at', { ascending: false }),
      (supabase as any).from('crm_quotes').select('*').eq('deal_id', deal.id).order('created_at', { ascending: false }),
    ]);
    setActivities(acts || []);
    setQuotes(qs || []);
  };

  const save = async () => {
    if (!form.name.trim() || !form.stage_id) {
      toast({ title: 'Name and stage required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const stage = stages.find(s => s.id === form.stage_id);
    const payload: any = {
      name: form.name.trim(),
      stage_id: form.stage_id,
      value: form.value || 0,
      expected_close_date: form.expected_close_date || null,
      probability: form.probability,
      lead_id: form.lead_id || null,
      notes: form.notes || null,
      lost_reason: stage?.is_lost ? (form.lost_reason || null) : null,
      won_at: stage?.is_won ? new Date().toISOString() : null,
      lost_at: stage?.is_lost ? new Date().toISOString() : null,
    };
    let error;
    if (deal) {
      ({ error } = await (supabase as any).from('crm_deals').update(payload).eq('id', deal.id));
    } else {
      payload.owner_id = user?.id;
      payload.created_by = user?.id;
      ({ error } = await (supabase as any).from('crm_deals').insert(payload));
    }
    setSaving(false);
    if (error) { toast({ title: 'Failed to save deal', description: error.message, variant: 'destructive' }); return; }
    toast({ title: deal ? 'Deal updated' : 'Deal created' });
    onOpenChange(false);
    onChanged();
  };

  const addActivity = async () => {
    if (!deal || !newAct.subject.trim()) return;
    const { error } = await (supabase as any).from('crm_activities').insert({
      deal_id: deal.id,
      type: newAct.type,
      subject: newAct.subject.trim(),
      body: newAct.body || null,
      due_at: newAct.due_at || null,
      owner_id: user?.id,
      created_by: user?.id,
    });
    if (error) { toast({ title: 'Failed', description: error.message, variant: 'destructive' }); return; }
    setNewAct({ type: 'note', subject: '', body: '', due_at: '' });
    loadRelated();
  };

  const completeActivity = async (id: string) => {
    await (supabase as any).from('crm_activities').update({ completed_at: new Date().toISOString() }).eq('id', id);
    loadRelated();
  };

  const downloadQuote = async (q: CrmQuote) => {
    const { data: items } = await (supabase as any).from('crm_quote_items').select('*').eq('quote_id', q.id).order('sort_order');
    const lead = leads.find(l => l.id === form.lead_id);
    generateQuotePdf({
      quote: q,
      items: (items || []) as CrmQuoteItem[],
      deal: deal!,
      clientName: lead?.contact_name || undefined,
      clientEmail: lead?.email || undefined,
      clientCompany: lead?.company_name || undefined,
    });
  };

  const stage = stages.find(s => s.id === form.stage_id);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{deal ? deal.name : 'New Deal'}</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="details">
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="activities" disabled={!deal}>Activities ({activities.length})</TabsTrigger>
              <TabsTrigger value="quotes" disabled={!deal}>Quotes ({quotes.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-3 mt-4">
              <div>
                <Label>Deal Name *</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Stage *</Label>
                  <Select value={form.stage_id} onValueChange={v => setForm({ ...form, stage_id: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {stages.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Linked Lead</Label>
                  <Select value={form.lead_id || 'none'} onValueChange={v => setForm({ ...form, lead_id: v === 'none' ? '' : v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {leads.map(l => <SelectItem key={l.id} value={l.id}>{l.company_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Value ($)</Label>
                  <Input type="number" step="0.01" value={form.value} onChange={e => setForm({ ...form, value: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>Probability %</Label>
                  <Input type="number" min={0} max={100} value={form.probability} onChange={e => setForm({ ...form, probability: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>Expected Close</Label>
                  <Input type="date" value={form.expected_close_date} onChange={e => setForm({ ...form, expected_close_date: e.target.value })} />
                </div>
              </div>
              {stage?.is_lost && (
                <div>
                  <Label>Lost Reason</Label>
                  <Input value={form.lost_reason} onChange={e => setForm({ ...form, lost_reason: e.target.value })} />
                </div>
              )}
              <div>
                <Label>Notes</Label>
                <Textarea rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
              </div>
              {stage?.is_won && deal && !deal.account_id && (
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="p-3 text-sm">
                    <strong>🎉 Deal Won!</strong> Head to the Accounts tab to create a Job Site for{' '}
                    <strong>{form.name}</strong>, then come back and link it here once created.
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="activities" className="space-y-3 mt-4">
              <Card>
                <CardContent className="p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={newAct.type} onValueChange={v => setNewAct({ ...newAct, type: v as any })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="note">Note</SelectItem>
                        <SelectItem value="call">Call</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="meeting">Meeting</SelectItem>
                        <SelectItem value="task">Task / Follow-up</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input type="datetime-local" value={newAct.due_at} onChange={e => setNewAct({ ...newAct, due_at: e.target.value })} placeholder="Due date (optional)" />
                  </div>
                  <Input placeholder="Subject" value={newAct.subject} onChange={e => setNewAct({ ...newAct, subject: e.target.value })} />
                  <Textarea rows={2} placeholder="Details (optional)" value={newAct.body} onChange={e => setNewAct({ ...newAct, body: e.target.value })} />
                  <Button size="sm" onClick={addActivity}><Plus className="h-3 w-3 mr-1" /> Log activity</Button>
                </CardContent>
              </Card>
              {activities.map(a => {
                const Icon = ACT_ICONS[a.type] || FileText;
                const overdue = a.due_at && !a.completed_at && new Date(a.due_at) < new Date();
                return (
                  <Card key={a.id} className={overdue ? 'border-red-300' : ''}>
                    <CardContent className="p-3 flex gap-3">
                      <Icon className="h-4 w-4 mt-1 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{a.subject}</span>
                          <Badge variant="outline" className="text-[10px]">{a.type}</Badge>
                          {a.completed_at && <Badge className="bg-green-100 text-green-800 text-[10px]">done</Badge>}
                          {overdue && <Badge className="bg-red-100 text-red-800 text-[10px]">overdue</Badge>}
                        </div>
                        {a.body && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{a.body}</p>}
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {a.due_at && <>Due {format(new Date(a.due_at), 'MMM d, p')} · </>}
                          Logged {format(new Date(a.created_at), 'MMM d')}
                        </p>
                      </div>
                      {!a.completed_at && (
                        <Button size="sm" variant="ghost" onClick={() => completeActivity(a.id)}>
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>

            <TabsContent value="quotes" className="space-y-3 mt-4">
              <Button size="sm" onClick={() => { setEditingQuote(null); setQuoteBuilderOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" /> New Quote
              </Button>
              {quotes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No quotes yet.</p>
              ) : quotes.map(q => (
                <Card key={q.id}>
                  <CardContent className="p-3 flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{q.quote_number} <Badge variant="outline" className="text-[10px] ml-2">{q.status}</Badge></p>
                      <p className="text-sm text-muted-foreground">Total: ${Number(q.total).toFixed(2)}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => downloadQuote(q)}><FileDown className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEditingQuote(q); setQuoteBuilderOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Deal'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {deal && (
        <QuoteBuilder
          open={quoteBuilderOpen}
          onOpenChange={setQuoteBuilderOpen}
          deal={deal}
          lead={leads.find(l => l.id === form.lead_id) || null}
          quote={editingQuote}
          onSaved={loadRelated}
        />
      )}
    </>
  );
}