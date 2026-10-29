import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Repeat } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { db } from './billingApi';
import { RecurringScheduleWizard } from './RecurringScheduleWizard';
import { money } from '@/lib/billing/types';

interface Props { jobSiteId: string; jobSiteName: string }

/** Recurring schedules for a monthly account. Visible only to billing job titles. */
export const RecurringBillingSetupCard = ({ jobSiteId, jobSiteName }: Props) => {
  const { canViewSov } = useAuth();
  const [rows, setRows] = useState<{ id: string; label: string; status: string; amount: number }[]>([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const load = async () => {
    const { data } = await db.from('recurring_billing_schedules')
      .select('id, label, status, amount').eq('job_site_id', jobSiteId).order('label');
    setRows(data ?? []);
  };

  useEffect(() => { if (canViewSov()) load(); }, [jobSiteId, canViewSov]);

  if (!canViewSov()) return null;

  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm flex items-center gap-2">
          <Repeat className="h-4 w-4" /> Recurring billing
        </CardTitle>
        <Button size="sm" variant="outline" onClick={() => { setEditId(null); setOpen(true); }}>Set up billing</Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {!rows.length && <p className="text-sm text-muted-foreground">No schedule yet.</p>}
        {rows.map(r => (
          <button key={r.id} type="button" className="flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm hover:bg-muted/50"
                  onClick={() => { setEditId(r.id); setOpen(true); }}>
            <span>{r.label}</span>
            <span className="flex items-center gap-2">
              <Badge variant="secondary">{r.status}</Badge>
              <span className="tabular-nums">{money(r.amount)}</span>
            </span>
          </button>
        ))}
      </CardContent>
      <RecurringScheduleWizard
        open={open}
        onOpenChange={setOpen}
        jobSiteId={jobSiteId}
        jobSiteName={jobSiteName}
        scheduleId={editId}
        onSaved={load}
      />
    </Card>
  );
};

export default RecurringBillingSetupCard;
