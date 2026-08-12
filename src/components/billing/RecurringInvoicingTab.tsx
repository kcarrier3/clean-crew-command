import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangle, FileText, Loader2, PauseCircle, PlayCircle, RefreshCw, Search, SkipForward,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  fetchRecurringRows, generateMany, setPeriodStatus, type RecurringRow,
} from './recurringApi';
import {
  PERIOD_STATUS_CLASS, PERIOD_STATUS_LABEL, currentPeriodStart, invoiceDateForPeriod,
  periodLabel, periodOptions, scheduleBillsPeriod, type RecurringPeriodStatus,
} from '@/lib/billing/recurring';
import { money } from '@/lib/billing/types';

interface Props { onOpenInvoice?: (invoiceId: string) => void }

/** Derived status for a row when no explicit period row exists yet. */
const rowStatus = (r: RecurringRow): RecurringPeriodStatus => {
  if (r.period?.status) return r.period.status;
  if (!r.schedule || !r.schedule.active || !Number(r.schedule.amount)) return 'pending';
  return 'ready';
};

const blockingIssue = (r: RecurringRow): string | null => {
  if (!r.schedule) return 'No recurring billing schedule set up on this account.';
  if (!r.schedule.active) return 'Recurring billing is inactive.';
  if (!Number(r.schedule.amount)) return 'Recurring amount is missing.';
  if (r.schedule.po_required && !r.schedule.po_number) return 'PO number required but missing.';
  return null;
};

export const RecurringInvoicingTab = ({ onOpenInvoice }: Props) => {
  const { toast } = useToast();
  const [period, setPeriod] = useState(currentPeriodStart());
  const [rows, setRows] = useState<RecurringRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    try {
      setRows(await fetchRecurringRows(period));
      setSelected(new Set());
    } catch (e: any) {
      toast({ title: 'Could not load recurring accounts', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [period]);

  const visible = useMemo(() => rows.filter(r => {
    if (r.schedule && !scheduleBillsPeriod(r.schedule, period)) return false;
    const term = q.trim().toLowerCase();
    if (!term) return true;
    return `${r.site.name} ${r.site.client_name ?? ''}`.toLowerCase().includes(term);
  }), [rows, q, period]);

  const readyRows = visible.filter(r => rowStatus(r) === 'ready' && !blockingIssue(r));
  const selectedRows = visible.filter(r => selected.has(r.site.id));
  const totals = {
    ready: readyRows.reduce((s, r) => s + Number(r.schedule?.amount || 0), 0),
    generated: visible.filter(r => rowStatus(r) === 'generated')
      .reduce((s, r) => s + Number(r.period?.amount || 0), 0),
    issues: visible.filter(r => blockingIssue(r)).length,
  };

  const toggle = (id: string) => setSelected(s => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const toggleAll = () => setSelected(s =>
    s.size === readyRows.length ? new Set() : new Set(readyRows.map(r => r.site.id)));

  const run = async (target: RecurringRow[]) => {
    if (!target.length) return;
    setBusy(true);
    const res = await generateMany(target, period);
    setBusy(false);
    if (res.ok.length) toast({ title: `${res.ok.length} invoice(s) generated` });
    if (res.failed.length) {
      toast({
        title: `${res.failed.length} skipped`,
        description: res.failed.slice(0, 4).map(f => `${f.name}: ${f.error}`).join(' · '),
        variant: 'destructive',
      });
    }
    load();
  };

  const mark = async (r: RecurringRow, status: RecurringPeriodStatus) => {
    try {
      await setPeriodStatus(r, period, status);
      load();
    } catch (e: any) {
      toast({ title: 'Could not update', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[13rem]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {periodOptions().map(p => (
              <SelectItem key={p} value={p}>{periodLabel(p)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[12rem]">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search accounts…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Ready this period</CardTitle></CardHeader>
          <CardContent className="pt-0"><p className="text-xl font-semibold">{money(totals.ready)}</p>
            <p className="text-xs text-muted-foreground">{readyRows.length} account(s)</p></CardContent></Card>
        <Card><CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Already generated</CardTitle></CardHeader>
          <CardContent className="pt-0"><p className="text-xl font-semibold">{money(totals.generated)}</p></CardContent></Card>
        <Card><CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Needs attention</CardTitle></CardHeader>
          <CardContent className="pt-0"><p className="text-xl font-semibold">{totals.issues}</p>
            <p className="text-xs text-muted-foreground">missing setup or PO</p></CardContent></Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={toggleAll} disabled={!readyRows.length}>
          {selected.size === readyRows.length && readyRows.length ? 'Clear selection' : 'Select all ready'}
        </Button>
        <Button size="sm" onClick={() => run(selectedRows)} disabled={busy || !selectedRows.length}>
          {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <PlayCircle className="h-4 w-4 mr-1" />}
          Generate {selectedRows.length || ''} selected
        </Button>
        <span className="text-xs text-muted-foreground">
          Invoices are created as “Ready to send” — nothing is emailed automatically.
        </span>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !visible.length ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
          No recurring monthly accounts bill in {periodLabel(period)}.
        </CardContent></Card>
      ) : visible.map(r => {
        const status = rowStatus(r);
        const issue = blockingIssue(r);
        const amount = Number(r.period?.amount ?? r.schedule?.amount ?? 0);
        const invDate = r.schedule ? invoiceDateForPeriod(period, r.schedule) : null;
        return (
          <Card key={r.site.id}>
            <CardContent className="p-3 flex flex-wrap items-center gap-3">
              <Checkbox
                checked={selected.has(r.site.id)}
                disabled={status !== 'ready' || !!issue}
                onCheckedChange={() => toggle(r.site.id)}
                aria-label={`Select ${r.site.name}`}
              />
              <div className="flex-1 min-w-[12rem]">
                <p className="font-medium text-sm truncate">{r.site.client_name || r.site.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {r.site.name}
                  {invDate && <> · invoice dated {invDate}</>}
                  {r.lastInvoice && <> · last {r.lastInvoice.invoice_number} ({r.lastInvoice.invoice_date})</>}
                </p>
                {issue && (
                  <p className="text-xs text-destructive flex items-center gap-1 mt-0.5">
                    <AlertTriangle className="h-3 w-3" /> {issue}
                  </p>
                )}
              </div>
              <span className="text-sm font-semibold tabular-nums">{money(amount)}</span>
              <Badge className={PERIOD_STATUS_CLASS[status]}>{PERIOD_STATUS_LABEL[status]}</Badge>
              <div className="flex items-center gap-1">
                {status === 'generated' && r.period?.invoice_id && onOpenInvoice && (
                  <Button size="sm" variant="outline" onClick={() => onOpenInvoice(r.period!.invoice_id!)}>
                    <FileText className="h-3.5 w-3.5 mr-1" /> Invoice
                  </Button>
                )}
                {status !== 'generated' && (
                  <>
                    <Button size="sm" variant="outline" disabled={!!issue || busy}
                            onClick={() => run([r])}>Generate</Button>
                    {status !== 'held' ? (
                      <Button size="icon" variant="ghost" aria-label="Hold" onClick={() => mark(r, 'held')}>
                        <PauseCircle className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button size="icon" variant="ghost" aria-label="Release hold" onClick={() => mark(r, 'ready')}>
                        <PlayCircle className="h-4 w-4" />
                      </Button>
                    )}
                    {status !== 'skipped' && (
                      <Button size="icon" variant="ghost" aria-label="Skip this period"
                              onClick={() => mark(r, 'skipped')}>
                        <SkipForward className="h-4 w-4" />
                      </Button>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default RecurringInvoicingTab;
