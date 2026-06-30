import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Phone, Mail, Users, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, isPast, isToday } from 'date-fns';
import type { CrmActivity, CrmDeal } from './types';

const ICONS = { call: Phone, email: Mail, meeting: Users, note: FileText, task: CheckCircle2 };

interface Props {
  deals: CrmDeal[];
  onOpenDeal: (deal: CrmDeal) => void;
  reloadKey?: number;
}

export function ActivitiesFeed({ deals, onOpenDeal, reloadKey }: Props) {
  const [acts, setActs] = useState<CrmActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('crm_activities')
      .select('*')
      .is('completed_at', null)
      .order('due_at', { ascending: true, nullsFirst: false })
      .limit(50);
    setActs(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [reloadKey]);

  const complete = async (id: string) => {
    await (supabase as any).from('crm_activities').update({ completed_at: new Date().toISOString() }).eq('id', id);
    load();
  };

  const overdue = acts.filter(a => a.due_at && isPast(new Date(a.due_at)) && !isToday(new Date(a.due_at)));
  const today = acts.filter(a => a.due_at && isToday(new Date(a.due_at)));
  const upcoming = acts.filter(a => a.due_at && !isPast(new Date(a.due_at)) && !isToday(new Date(a.due_at)));
  const noDate = acts.filter(a => !a.due_at);

  const Section = ({ title, list, color }: { title: string; list: CrmActivity[]; color: string }) => (
    list.length === 0 ? null : (
      <div className="space-y-2">
        <h3 className={`text-sm font-semibold ${color}`}>{title} ({list.length})</h3>
        {list.map(a => {
          const Icon = ICONS[a.type] || FileText;
          const deal = deals.find(d => d.id === a.deal_id);
          return (
            <Card key={a.id} className="hover:shadow-sm cursor-pointer" onClick={() => deal && onOpenDeal(deal)}>
              <CardContent className="p-3 flex gap-3 items-start">
                <Icon className="h-4 w-4 mt-1 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{a.subject}</span>
                    <Badge variant="outline" className="text-[10px]">{a.type}</Badge>
                  </div>
                  {a.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.body}</p>}
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {deal && <>For: {deal.name} · </>}
                    {a.due_at && <>Due {format(new Date(a.due_at), 'MMM d, p')}</>}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); complete(a.id); }}>
                  <CheckCircle2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    )
  );

  if (loading) return <p className="text-muted-foreground text-sm">Loading…</p>;
  if (acts.length === 0) return <Card><CardContent className="py-10 text-center text-muted-foreground">No open follow-ups. You're all caught up.</CardContent></Card>;

  return (
    <div className="space-y-4">
      <Section title="Overdue" list={overdue} color="text-red-600" />
      <Section title="Today" list={today} color="text-orange-600" />
      <Section title="Upcoming" list={upcoming} color="text-blue-600" />
      <Section title="No due date" list={noDate} color="text-muted-foreground" />
    </div>
  );
}