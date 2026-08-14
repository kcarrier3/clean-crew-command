import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Target, Settings2, TrendingUp, TrendingDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { PIPELINE_SHORT_LABELS, type CrmDeal, type CrmLead, type CrmStage } from './types';

export const SALES_GOALS_KEY = 'sales_goals';

export interface SalesGoals {
  monthly: number;
  annual: number;
  monthlyProject: number;
  monthlyJanitorial: number;
}

const DEFAULT_GOALS: SalesGoals = { monthly: 0, annual: 0, monthlyProject: 0, monthlyJanitorial: 0 };

const parseGoals = (value: string | null | undefined): SalesGoals => {
  if (!value) return DEFAULT_GOALS;
  try {
    const p = JSON.parse(value);
    return {
      monthly: Number(p.monthly) || 0,
      annual: Number(p.annual) || 0,
      monthlyProject: Number(p.monthlyProject) || 0,
      monthlyJanitorial: Number(p.monthlyJanitorial) || 0,
    };
  } catch { return DEFAULT_GOALS; }
};

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
const pct = (actual: number, goal: number) => (goal > 0 ? (actual / goal) * 100 : 0);

interface WonRow { at: number; amount: number; pipeline: string }

interface Props {
  leads: CrmLead[];
  deals: CrmDeal[];
  stages: CrmStage[];
}

/** Goal vs. actual won revenue for the current month and year to date. */
export const SalesGoalCard = ({ leads, deals, stages }: Props) => {
  const { toast } = useToast();
  const { isManager } = useAuth();
  const [goals, setGoals] = useState<SalesGoals>(DEFAULT_GOALS);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<SalesGoals>(DEFAULT_GOALS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('app_settings').select('value').eq('key', SALES_GOALS_KEY).maybeSingle();
      setGoals(parseGoals(data?.value));
    })();
  }, []);

  const wonRows = useMemo<WonRow[]>(() => {
    const wonStageIds = new Set(stages.filter(s => s.is_won).map(s => s.id));
    const rows: WonRow[] = [];
    const countedLeadIds = new Set<string>();

    // Deals explicitly marked won carry the authoritative close date.
    deals.forEach(d => {
      if (!d.won_at) return;
      rows.push({ at: new Date(d.won_at).getTime(), amount: Number(d.value) || 0, pipeline: d.pipeline || 'project' });
      if (d.lead_id) countedLeadIds.add(d.lead_id);
    });

    // Opportunities sitting in a won stage without a deal record still count.
    leads.forEach(l => {
      if (!l.stage_id || !wonStageIds.has(l.stage_id)) return;
      if (countedLeadIds.has(l.id)) return;
      const ts = l.close_date || l.updated_at || l.created_at;
      rows.push({ at: new Date(ts).getTime(), amount: Number(l.amount) || 0, pipeline: l.pipeline || 'project' });
    });

    return rows.filter(r => !Number.isNaN(r.at));
  }, [leads, deals, stages]);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const yearStart = new Date(now.getFullYear(), 0, 1).getTime();

  const sum = (rows: WonRow[]) => rows.reduce((s, r) => s + r.amount, 0);
  const monthRows = wonRows.filter(r => r.at >= monthStart);
  const monthActual = sum(monthRows);
  const ytdActual = sum(wonRows.filter(r => r.at >= yearStart));
  const projectActual = sum(monthRows.filter(r => r.pipeline === 'project'));
  const janitorialActual = sum(monthRows.filter(r => r.pipeline === 'janitorial'));

  // Where we should be by today if the month closed evenly.
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const paceTarget = goals.monthly * (now.getDate() / daysInMonth);
  const paceDelta = monthActual - paceTarget;

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('app_settings').upsert(
      { key: SALES_GOALS_KEY, value: JSON.stringify(draft), description: 'Waypoint sales goals' },
      { onConflict: 'key' },
    );
    setSaving(false);
    if (error) { toast({ title: 'Could not save goals', description: error.message, variant: 'destructive' }); return; }
    setGoals(draft);
    setOpen(false);
    toast({ title: 'Sales goals updated' });
  };

  const Bar = ({ label, actual, goal }: { label: string; actual: number; goal: number }) => {
    const p = pct(actual, goal);
    return (
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className="text-xs font-medium">
            {money(actual)} {goal > 0 && <span className="text-muted-foreground">/ {money(goal)}</span>}
          </span>
        </div>
        <Progress value={Math.min(p, 100)} className="h-2" />
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>{goal > 0 ? `${p.toFixed(0)}% of goal` : 'No goal set'}</span>
          {goal > 0 && <span>{actual >= goal ? 'Goal met' : `${money(goal - actual)} to go`}</span>}
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Sales goal vs. actual</h3>
            {goals.monthly > 0 && (
              <Badge
                variant="outline"
                className={paceDelta >= 0 ? 'text-emerald-700 border-emerald-300' : 'text-amber-700 border-amber-300'}
              >
                {paceDelta >= 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                {paceDelta >= 0 ? 'Ahead' : 'Behind'} pace by {money(Math.abs(paceDelta))}
              </Badge>
            )}
          </div>
          {isManager() && (
            <Dialog open={open} onOpenChange={o => { setOpen(o); if (o) setDraft(goals); }}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm"><Settings2 className="h-4 w-4 mr-1" /> Goals</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Sales goals</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  {([
                    ['monthly', 'Monthly goal (all won revenue)'],
                    ['annual', 'Annual goal'],
                    ['monthlyProject', `Monthly ${PIPELINE_SHORT_LABELS.project.toLowerCase()} goal (optional)`],
                    ['monthlyJanitorial', `Monthly ${PIPELINE_SHORT_LABELS.janitorial.toLowerCase()} goal (optional)`],
                  ] as Array<[keyof SalesGoals, string]>).map(([key, label]) => (
                    <div key={key} className="space-y-1">
                      <Label htmlFor={`goal-${key}`}>{label}</Label>
                      <Input
                        id={`goal-${key}`}
                        type="number"
                        min={0}
                        value={draft[key] || ''}
                        onChange={e => setDraft(d => ({ ...d, [key]: Number(e.target.value) || 0 }))}
                      />
                    </div>
                  ))}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save goals'}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Bar
            label={`This month (${now.toLocaleString(undefined, { month: 'long' })})`}
            actual={monthActual}
            goal={goals.monthly}
          />
          <Bar label={`Year to date (${now.getFullYear()})`} actual={ytdActual} goal={goals.annual} />
          {(goals.monthlyProject > 0 || goals.monthlyJanitorial > 0) && (
            <>
              <Bar label={`${PIPELINE_SHORT_LABELS.project} — this month`} actual={projectActual} goal={goals.monthlyProject} />
              <Bar label={`${PIPELINE_SHORT_LABELS.janitorial} — this month`} actual={janitorialActual} goal={goals.monthlyJanitorial} />
            </>
          )}
        </div>

        {goals.monthly === 0 && goals.annual === 0 && (
          <p className="text-xs text-muted-foreground">
            {isManager() ? 'Set a goal to start tracking against it.' : 'No sales goals set yet.'}
          </p>
        )}
      </CardContent>
    </Card>
  );
};
