import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText } from 'lucide-react';
import { db } from './billingApi';
import { money, type BillingEvent } from '@/lib/billing/types';
import { SOV_STATE_LABEL } from '@/lib/billing/sov';
import { fetchProjectSov, type SovCheckpoint } from './sovApi';

interface Props {
  jobSiteId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onInvoice: (events: BillingEvent[]) => void;
}

interface SiteInfo {
  name: string;
  client_name: string | null;
  billing_contact_name: string | null;
  billing_email: string | null;
  billing_terms: string | null;
  billing_po_number: string | null;
  crm_company_id: string | null;
}

export const SovReadyDialog = ({ jobSiteId, open, onOpenChange, onInvoice }: Props) => {
  const [site, setSite] = useState<SiteInfo | null>(null);
  const [company, setCompany] = useState<string | null>(null);
  const [rows, setRows] = useState<SovCheckpoint[]>([]);
  const [events, setEvents] = useState<BillingEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !jobSiteId) return;
    setLoading(true);
    (async () => {
      const [{ data: siteRow }, sov, { data: ev }] = await Promise.all([
        db.from('job_sites')
          .select('name, client_name, billing_contact_name, billing_email, billing_terms, billing_po_number, crm_company_id')
          .eq('id', jobSiteId).maybeSingle(),
        fetchProjectSov(jobSiteId, true),
        db.from('billing_events').select('*').eq('job_site_id', jobSiteId).in('status', ['ready', 'hold']),
      ]);
      setSite(siteRow ?? null);
      setRows(sov);
      setEvents((ev ?? []) as BillingEvent[]);
      if (siteRow?.crm_company_id) {
        const { data: co } = await db.from('crm_companies').select('name').eq('id', siteRow.crm_company_id).maybeSingle();
        setCompany(co?.name ?? null);
      } else setCompany(null);
      setLoading(false);
    })().catch(() => setLoading(false));
  }, [open, jobSiteId]);

  const readyAmount = rows.filter(r => r.billingState === 'ready').reduce((s, r) => s + Number(r.amount || 0), 0);
  const readyEvents = events.filter(e => e.status === 'ready' && e.project_phase_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule of values</DialogTitle>
        </DialogHeader>
        {loading || !site ? <p className="text-sm text-muted-foreground">Loading…</p> : (
          <div className="space-y-3 text-sm">
            <div>
              <p className="font-medium">{site.name}</p>
              <p className="text-muted-foreground">{company || site.client_name || 'No customer linked'}</p>
            </div>
            <div className="grid gap-1 text-xs text-muted-foreground">
              <p>Billing contact: {site.billing_contact_name || '—'}</p>
              <p>Billing email: {site.billing_email || '—'}</p>
              <p>Terms: {site.billing_terms || '—'}{site.billing_po_number ? ` · PO ${site.billing_po_number}` : ''}</p>
            </div>
            <div className="rounded-md border divide-y">
              {rows.map(r => (
                <div key={r.phaseId} className="flex items-start justify-between gap-2 p-2">
                  <div>
                    <p className="font-medium">{r.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {SOV_STATE_LABEL[r.billingState]}
                      {r.completedByName ? ` · Completed by ${r.completedByName}` : ''}
                      {r.completedAt ? ` · ${r.completedAt.slice(0, 10)}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="tabular-nums">{r.amount == null ? '—' : money(r.amount)}</p>
                    <Badge variant="outline" className="text-[10px]">{SOV_STATE_LABEL[r.billingState]}</Badge>
                  </div>
                </div>
              ))}
              {!rows.length && <p className="p-3 text-muted-foreground">This job has no schedule of values.</p>}
            </div>
            <div className="flex justify-between font-medium">
              <span>Amount ready to bill</span>
              <span className="tabular-nums">{money(readyAmount)}</span>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button disabled={!readyEvents.length} onClick={() => { onOpenChange(false); onInvoice(readyEvents); }}>
            <FileText className="h-4 w-4 mr-1" /> Invoice ready items
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
