import { useEffect, useState } from 'react';
import { db } from './billingApi';
import { fetchProjectSov } from './sovApi';
import { money } from '@/lib/billing/types';
import { progressBillLine, type ProgressBillLine } from '@/lib/billing/sov';

/** Progress draw on one invoice: scheduled value, prior bills, this period, remaining. */
export const InvoiceProgressSummary = ({ jobSiteId, invoiceId }: { jobSiteId: string; invoiceId: string }) => {
  const [lines, setLines] = useState<ProgressBillLine[] | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data: site } = await db.from('job_sites').select('progress_billing').eq('id', jobSiteId).maybeSingle();
      if (!site?.progress_billing) { if (!cancel) setLines(null); return; }
      const rows = await fetchProjectSov(jobSiteId, true);
      if (cancel) return;
      setLines(rows.filter(r => r.amount != null).map(r =>
        progressBillLine(r.name, Number(r.amount), r.eventStatus, r.invoiceId, invoiceId)));
    })().catch(() => { if (!cancel) setLines(null); });
    return () => { cancel = true; };
  }, [jobSiteId, invoiceId]);

  if (!lines?.length) return null;
  const sum = (pick: (l: ProgressBillLine) => number) => lines.reduce((s, l) => s + pick(l), 0);

  return (
    <div className="rounded-md border p-3 space-y-2 text-sm">
      <p className="font-medium">Progress billing</p>
      <div className="grid grid-cols-5 gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
        <span>Checkpoint</span>
        <span className="text-right">Scheduled</span>
        <span className="text-right">Previous</span>
        <span className="text-right">This period</span>
        <span className="text-right">Remaining</span>
      </div>
      {lines.map((l, i) => (
        <div key={`${l.name}-${i}`} className="grid grid-cols-5 gap-2">
          <span className="truncate">{l.name}</span>
          <span className="text-right tabular-nums">{money(l.scheduled)}</span>
          <span className="text-right tabular-nums">{money(l.previouslyBilled)}</span>
          <span className="text-right tabular-nums">{money(l.thisPeriod)}</span>
          <span className="text-right tabular-nums">{money(l.remaining)}</span>
        </div>
      ))}
      <div className="grid grid-cols-5 gap-2 border-t pt-2 font-medium">
        <span>Total</span>
        <span className="text-right tabular-nums">{money(sum(l => l.scheduled))}</span>
        <span className="text-right tabular-nums">{money(sum(l => l.previouslyBilled))}</span>
        <span className="text-right tabular-nums">{money(sum(l => l.thisPeriod))}</span>
        <span className="text-right tabular-nums">{money(sum(l => l.remaining))}</span>
      </div>
    </div>
  );
};
