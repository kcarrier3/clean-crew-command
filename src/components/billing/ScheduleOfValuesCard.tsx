import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Loader2, Plus, Receipt, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { money } from '@/lib/billing/types';
import { SOV_STATE_LABEL } from '@/lib/billing/sov';
import { fetchProjectSov, saveProjectSov, type SovCheckpoint, type SovDraftLine } from './sovApi';

interface Props {
  jobSiteId: string;
  /** Office view includes amounts and billed state. */
  showAmounts: boolean;
}

const blank = (): SovDraftLine => ({ name: '', amount: '' });

export const ScheduleOfValuesCard = ({ jobSiteId, showAmounts }: Props) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<SovCheckpoint[]>([]);
  const [editing, setEditing] = useState(false);
  const [flat, setFlat] = useState(false);
  const [draft, setDraft] = useState<SovDraftLine[]>([blank()]);

  const load = async () => {
    setLoading(true);
    try {
      const list = await fetchProjectSov(jobSiteId, showAmounts);
      setRows(list);
      setFlat(list.length <= 1);
      setDraft(list.length
        ? list.map(r => ({ phaseId: r.phaseId, name: r.name, amount: r.amount == null ? '' : String(r.amount) }))
        : [blank()]);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Could not load the schedule of values';
      toast({ title: 'Could not load the schedule of values', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [jobSiteId, showAmounts]);

  const ready = rows.filter(r => r.billingState === 'ready').reduce((s, r) => s + Number(r.amount || 0), 0);
  const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);

  const save = async () => {
    setSaving(true);
    try {
      const lines = flat ? draft.slice(0, 1) : draft;
      await saveProjectSov(jobSiteId, lines);
      toast({ title: 'Schedule of values saved' });
      setEditing(false);
      await load();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Could not save';
      toast({ title: 'Could not save the schedule of values', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!showAmounts) return null;
  if (loading) return <p className="text-sm text-muted-foreground">Loading schedule of values…</p>;

  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm flex items-center gap-2">
          <Receipt className="h-4 w-4" /> Schedule of values
        </CardTitle>
        {!editing && (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit</Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Dollar amounts are visible to the Owner, an admin, and the Office Manager. Managers and employees see the checkpoint names only.
        </p>
        {!editing ? (
          <>
            {!rows.length && <p className="text-sm text-muted-foreground">No schedule of values yet.</p>}
            {rows.map(r => (
              <div key={r.phaseId} className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">{r.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {SOV_STATE_LABEL[r.billingState]}
                    {r.completedByName ? ` · ${r.completedByName}` : ''}
                    {r.completedAt ? ` · ${r.completedAt.slice(0, 10)}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="tabular-nums">{r.amount == null ? '—' : money(r.amount)}</p>
                  <Badge variant="outline" className="text-[10px]">{SOV_STATE_LABEL[r.billingState]}</Badge>
                </div>
              </div>
            ))}
            {rows.length > 0 && (
              <div className="text-sm border-t pt-2 space-y-1">
                <div className="flex justify-between"><span>Schedule total</span><span className="tabular-nums">{money(total)}</span></div>
                <div className="flex justify-between font-medium"><span>Ready to bill</span><span className="tabular-nums">{money(ready)}</span></div>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label htmlFor="sov_flat">Small job — one flat price</Label>
                <p className="text-xs text-muted-foreground">Turn this off to bill a dollar amount per phase.</p>
              </div>
              <Switch id="sov_flat" checked={flat} onCheckedChange={v => {
                setFlat(v);
                if (v) setDraft(d => d.slice(0, 1).length ? d.slice(0, 1) : [blank()]);
              }} />
            </div>
            {(flat ? draft.slice(0, 1) : draft).map((line, i) => (
              <div key={line.phaseId ?? i} className="grid grid-cols-[1fr_8rem_auto] gap-2">
                <Input aria-label="Checkpoint name" placeholder={flat ? 'Job complete' : 'Phase name'} value={line.name}
                       onChange={e => setDraft(d => d.map((row, idx) => idx === i ? { ...row, name: e.target.value } : row))} />
                <Input aria-label="Amount" type="number" min="0" step="0.01" placeholder="Amount" value={line.amount}
                       onChange={e => setDraft(d => d.map((row, idx) => idx === i ? { ...row, amount: e.target.value } : row))} />
                {!flat && (
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove checkpoint"
                          onClick={() => setDraft(d => d.filter((_, idx) => idx !== i))}
                          disabled={draft.length === 1}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {!flat && (
              <Button type="button" size="sm" variant="outline" onClick={() => setDraft(d => [...d, blank()])}>
                <Plus className="h-4 w-4 mr-1" /> Phase
              </Button>
            )}
            <div className="flex gap-2">
              <Button size="sm" onClick={save} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Save schedule
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditing(false); load(); }}>Cancel</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
