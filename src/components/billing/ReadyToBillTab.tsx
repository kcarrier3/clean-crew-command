import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertTriangle, Building2, CalendarClock, FileText, Mail, PauseCircle, PlayCircle,
  Receipt, Search, XCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { db, fetchBillingEvents } from './billingApi';
import { GenerateInvoiceDialog } from './GenerateInvoiceDialog';
import { SupplyUsageToBillCard } from './SupplyUsageToBillCard';
import { money, type BillingEvent } from '@/lib/billing/types';
import { ageInDays } from '@/lib/billing/kpi';

interface Props { onInvoiceCreated?: (id: string) => void }

export const ReadyToBillTab = ({ onInvoiceCreated }: Props) => {
  const { toast } = useToast();
  const [events, setEvents] = useState<BillingEvent[]>([]);
  const [siteNames, setSiteNames] = useState<Record<string, string>>({});
  const [leadNames, setLeadNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [showHeld, setShowHeld] = useState(true);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [genOpen, setGenOpen] = useState(false);
  const [genEvents, setGenEvents] = useState<BillingEvent[]>([]);
  const [holdTarget, setHoldTarget] = useState<BillingEvent | null>(null);
  const [holdReason, setHoldReason] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const rows = await fetchBillingEvents(['ready', 'hold']);
      setEvents(rows);
      const siteIds = [...new Set(rows.map(r => r.job_site_id).filter(Boolean))] as string[];
      const leadIds = [...new Set(rows.map(r => r.crm_lead_id).filter(Boolean))] as string[];
      if (siteIds.length) {
        const { data } = await db.from('job_sites').select('id, name, client_name').in('id', siteIds);
        setSiteNames(Object.fromEntries((data ?? []).map((s: any) => [s.id, s.client_name || s.name])));
      }
      if (leadIds.length) {
        const { data } = await db.from('crm_leads').select('id, name').in('id', leadIds);
        setLeadNames(Object.fromEntries((data ?? []).map((l: any) => [l.id, l.name])));
      }
    } catch (e: any) {
      toast({ title: 'Could not load Ready to Bill', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return events
      .filter(e => showHeld || e.status !== 'hold')
      .filter(e => !needle
        || e.label.toLowerCase().includes(needle)
        || (e.po_number ?? '').toLowerCase().includes(needle)
        || (siteNames[e.job_site_id ?? ''] ?? '').toLowerCase().includes(needle));
  }, [events, q, showHeld, siteNames]);

  const readyOnly = events.filter(e => e.status === 'ready');
  const totalReady = readyOnly.reduce((s, e) => s + Number(e.amount || 0), 0);
  const oldest = readyOnly.length ? ageInDays(readyOnly[0].completed_at) : null;
  const heldCount = events.filter(e => e.status === 'hold').length;

  const selectedEvents = visible.filter(e => selected[e.id] && e.status === 'ready');

  const putOnHold = async () => {
    if (!holdTarget) return;
    if (!holdReason.trim()) {
      toast({ title: 'Reason required', description: 'Enter why this item is on billing hold.', variant: 'destructive' });
      return;
    }
    const { data: u } = await db.auth.getUser();
    const { error } = await db.from('billing_events').update({
      status: 'hold', hold_reason: holdReason.trim(),
      hold_at: new Date().toISOString(), hold_by: u?.user?.id ?? null,
    }).eq('id', holdTarget.id);
    if (error) return toast({ title: 'Error', description: error.message, variant: 'destructive' });
    setHoldTarget(null); setHoldReason('');
    load();
  };

  const releaseHold = async (e: BillingEvent) => {
    const { error } = await db.from('billing_events')
      .update({ status: 'ready', hold_reason: null, hold_at: null, hold_by: null }).eq('id', e.id);
    if (error) return toast({ title: 'Error', description: error.message, variant: 'destructive' });
    load();
  };

  const cancelEvent = async (e: BillingEvent) => {
    const { error } = await db.from('billing_events').update({ status: 'cancelled' }).eq('id', e.id);
    if (error) return toast({ title: 'Error', description: error.message, variant: 'destructive' });
    toast({ title: 'Removed from Ready to Bill' });
    load();
  };

  const openGenerate = (list: BillingEvent[]) => {
    if (!list.length) return;
    const site = list[0].job_site_id;
    if (list.some(e => e.job_site_id !== site)) {
      toast({ title: 'Different jobs selected', description: 'Combine only items from the same job for now.', variant: 'destructive' });
      return;
    }
    setGenEvents(list);
    setGenOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Ready to bill</p>
          <p className="text-2xl font-semibold tabular-nums">{money(totalReady)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Items waiting</p>
          <p className="text-2xl font-semibold tabular-nums">{readyOnly.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Oldest item</p>
          <p className="text-2xl font-semibold tabular-nums">{oldest == null ? '—' : `${oldest}d`}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">On billing hold</p>
          <p className="text-2xl font-semibold tabular-nums">{heldCount}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-3 gap-3 sm:flex-row sm:items-center sm:justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-4 w-4" /> Ready to Bill queue
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search job, customer, PO"
                     className="pl-8 w-full sm:w-64" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={showHeld} onCheckedChange={v => setShowHeld(!!v)} /> Show holds
            </label>
            <Button size="sm" disabled={!selectedEvents.length} onClick={() => openGenerate(selectedEvents)}>
              <FileText className="h-4 w-4 mr-1" />
              Invoice selected{selectedEvents.length ? ` (${selectedEvents.length})` : ''}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !visible.length ? (
            <div className="rounded-md border border-dashed p-8 text-center">
              <Receipt className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">Nothing waiting to be billed</p>
              <p className="text-xs text-muted-foreground mt-1">
                Items land here automatically when a crew marks a configured phase or a whole project complete.
              </p>
            </div>
          ) : visible.map(e => {
            const age = ageInDays(e.completed_at) ?? 0;
            const held = e.status === 'hold';
            return (
              <div key={e.id}
                   className={`rounded-lg border p-3 ${held ? 'bg-amber-50/60 border-amber-200' : 'bg-card'}`}>
                <div className="flex items-start gap-3">
                  <Checkbox
                    className="mt-1"
                    disabled={held}
                    checked={!!selected[e.id]}
                    onCheckedChange={v => setSelected(s => ({ ...s, [e.id]: !!v }))}
                    aria-label={`Select ${e.label}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium truncate">{e.label}</p>
                      {held ? <Badge className="bg-amber-100 text-amber-900">On hold</Badge>
                            : <Badge className="bg-blue-100 text-blue-800">Ready</Badge>}
                      {age >= 5 && !held && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" /> {age}d old
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 grid gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {siteNames[e.job_site_id ?? ''] ?? 'No account linked'}
                      </span>
                      <span className="flex items-center gap-1">
                        <CalendarClock className="h-3 w-3" />
                        Completed {format(new Date(e.completed_at), 'MMM d, yyyy')} · {age}d ago
                      </span>
                      {e.crm_lead_id && <span>Opportunity: {leadNames[e.crm_lead_id] ?? 'linked'}</span>}
                      {e.contract_amount != null && <span>Contract {money(e.contract_amount)}</span>}
                      {e.billing_percent != null && <span>{Number(e.billing_percent)}% of contract</span>}
                      {e.po_number && <span>PO {e.po_number}</span>}
                      {e.billing_email && (
                        <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{e.billing_email}</span>
                      )}
                    </div>
                    {e.notes && <p className="mt-1 text-xs text-muted-foreground italic">“{e.notes}”</p>}
                    {held && e.hold_reason && (
                      <p className="mt-1 text-xs text-amber-900">Hold reason: {e.hold_reason}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-semibold tabular-nums">{money(e.amount)}</p>
                    <div className="mt-2 flex flex-wrap justify-end gap-1">
                      {!held && (
                        <Button size="sm" onClick={() => openGenerate([e])}>
                          <FileText className="h-3.5 w-3.5 mr-1" /> Invoice
                        </Button>
                      )}
                      {held ? (
                        <Button size="sm" variant="outline" onClick={() => releaseHold(e)}>
                          <PlayCircle className="h-3.5 w-3.5 mr-1" /> Release
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline"
                                onClick={() => { setHoldTarget(e); setHoldReason(''); }}>
                          <PauseCircle className="h-3.5 w-3.5 mr-1" /> Hold
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => cancelEvent(e)} aria-label="Remove from queue">
                        <XCircle className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <GenerateInvoiceDialog
        events={genEvents}
        open={genOpen}
        onOpenChange={setGenOpen}
        onCreated={id => { setSelected({}); load(); onInvoiceCreated?.(id); }}
      />

      <Dialog open={!!holdTarget} onOpenChange={o => !o && setHoldTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Place billing hold</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{holdTarget?.label}</p>
          <div className="space-y-2">
            <Label htmlFor="hold_reason">Reason (required)</Label>
            <Textarea id="hold_reason" rows={3} value={holdReason} onChange={e => setHoldReason(e.target.value)}
                      placeholder="e.g. Waiting on customer PO" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHoldTarget(null)}>Cancel</Button>
            <Button onClick={putOnHold}>Place hold</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReadyToBillTab;