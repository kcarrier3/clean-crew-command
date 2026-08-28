import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronDown, ChevronRight, Loader2, PackageCheck, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { money } from '@/lib/billing/types';
import {
  fetchUnbilledSupplyUsage, queueSupplyUsage, type SupplyUsageGroup,
} from '@/lib/billing/supplyBilling';

interface Props { onQueued?: () => void }

/** Resale supplies dropped off at accounts, waiting to be pushed into Ready to Bill. */
export const SupplyUsageToBillCard = ({ onQueued }: Props) => {
  const { toast } = useToast();
  const [groups, setGroups] = useState<SupplyUsageGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    try {
      const rows = await fetchUnbilledSupplyUsage();
      setGroups(rows);
      setSelected(Object.fromEntries(rows.map(g => [g.jobSiteId, true])));
    } catch (e: any) {
      toast({ title: 'Could not load supply usage', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const chosen = groups.filter(g => selected[g.jobSiteId]);
  const chosenTotal = chosen.reduce((s, g) => s + g.totalAmount, 0);

  const addToQueue = async () => {
    if (!chosen.length) return;
    setBusy(true);
    try {
      const n = await queueSupplyUsage(chosen);
      toast({
        title: `${n} supply item${n === 1 ? '' : 's'} added to Ready to Bill`,
        description: 'Invoice them like any other billable item.',
      });
      await load();
      onQueued?.();
    } catch (e: any) {
      toast({ title: 'Could not add to the queue', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  if (!loading && !groups.length) return null;

  return (
    <Card className="border-emerald-200 bg-emerald-50/40">
      <CardHeader className="pb-3 gap-3 sm:flex-row sm:items-center sm:justify-between space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <PackageCheck className="h-4 w-4" /> Supply usage waiting to be billed
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Resale supplies dropped off at customer accounts. Add them here instead of running a separate report.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={load} disabled={loading || busy}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button size="sm" onClick={addToQueue} disabled={!chosen.length || busy}>
            {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Add to Ready to Bill{chosen.length ? ` (${money(chosenTotal)})` : ''}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading supply drop-offs…</p>
        ) : groups.map(g => (
          <div key={g.jobSiteId} className="rounded-lg border bg-card p-3">
            <div className="flex items-start gap-3">
              <Checkbox
                className="mt-1"
                checked={!!selected[g.jobSiteId]}
                onCheckedChange={v => setSelected(s => ({ ...s, [g.jobSiteId]: !!v }))}
                aria-label={`Select supplies for ${g.jobSiteName}`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium truncate">{g.jobSiteName}</p>
                  <Badge className="bg-emerald-100 text-emerald-900">{g.lines.length} drop-off{g.lines.length === 1 ? '' : 's'}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {format(new Date(g.earliestAt), 'MMM d, yyyy')}
                  {g.earliestAt !== g.latestAt ? ` – ${format(new Date(g.latestAt), 'MMM d, yyyy')}` : ''}
                  {' · '}{g.totalQty} units
                </p>
                <Button
                  variant="ghost" size="sm" className="h-7 px-1 mt-1 text-xs"
                  onClick={() => setOpen(o => ({ ...o, [g.jobSiteId]: !o[g.jobSiteId] }))}
                >
                  {open[g.jobSiteId] ? <ChevronDown className="h-3.5 w-3.5 mr-1" /> : <ChevronRight className="h-3.5 w-3.5 mr-1" />}
                  {open[g.jobSiteId] ? 'Hide items' : 'View items'}
                </Button>
                {open[g.jobSiteId] && (
                  <div className="mt-1 space-y-1">
                    {g.lines.map(l => (
                      <div key={l.id} className="flex justify-between gap-2 text-xs text-muted-foreground">
                        <span className="truncate">
                          {format(new Date(l.date), 'MMM d')} · {l.qty} {l.unit} {l.itemName}
                        </span>
                        <span className="tabular-nums">{money(l.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-lg font-semibold tabular-nums shrink-0">{money(g.totalAmount)}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default SupplyUsageToBillCard;
