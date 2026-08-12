import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link2, Loader2, Receipt } from 'lucide-react';
import { db } from '@/components/billing/billingApi';
import { CrmLinkPicker } from '@/components/billing/CrmLinkPicker';
import { useToast } from '@/hooks/use-toast';
import { INVOICE_STATUS_CLASS, INVOICE_STATUS_LABEL, money, type Invoice } from '@/lib/billing/types';

interface Props { dealId: string; companyId?: string | null }

interface SiteRow { id: string; name: string; is_recurring_monthly: boolean | null }

/** Financial rollup for a Waypoint opportunity: linked projects, invoices, balances. */
export const OpportunityBillingTab = ({ dealId, companyId }: Props) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [pending, setPending] = useState(0);
  const [linkSiteId, setLinkSiteId] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: s }, { data: inv }, { data: evts }] = await Promise.all([
      db.from('job_sites').select('id, name, is_recurring_monthly').eq('crm_deal_id', dealId).order('name'),
      db.from('billing_invoices').select('*').eq('crm_deal_id', dealId)
        .order('invoice_date', { ascending: false }),
      db.from('billing_events').select('amount').eq('crm_deal_id', dealId).eq('status', 'ready'),
    ]);
    setSites((s ?? []) as SiteRow[]);
    setInvoices((inv ?? []) as Invoice[]);
    setPending((evts ?? []).reduce((t: number, e: any) => t + Number(e.amount || 0), 0));
    setLoading(false);
  };

  useEffect(() => { load(); }, [dealId]);

  const invoiced = invoices.filter(i => i.status !== 'void')
    .reduce((t, i) => t + Number(i.total || 0), 0);
  const paid = invoices.filter(i => i.status !== 'void')
    .reduce((t, i) => t + Number(i.amount_paid || 0), 0);
  const outstanding = invoices.filter(i => i.status !== 'void')
    .reduce((t, i) => t + Number(i.balance_due || 0), 0);

  const linkSite = async () => {
    if (!linkSiteId) return;
    setLinking(true);
    const { error } = await db.from('job_sites').update({ crm_deal_id: dealId }).eq('id', linkSiteId);
    setLinking(false);
    if (error) return toast({ title: 'Could not link', description: error.message, variant: 'destructive' });
    setLinkSiteId(null);
    toast({ title: 'Project linked to this opportunity' });
    load();
  };

  if (loading) return <p className="text-sm text-muted-foreground mt-4">Loading billing…</p>;

  const stat = (label: string, value: number) => (
    <Card><CardContent className="p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{money(value)}</p>
    </CardContent></Card>
  );

  return (
    <div className="space-y-3 mt-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stat('Ready to bill', pending)}
        {stat('Invoiced', invoiced)}
        {stat('Paid', paid)}
        {stat('Outstanding', outstanding)}
      </div>

      <Card>
        <CardContent className="p-3 space-y-2">
          <p className="text-sm font-medium flex items-center gap-2"><Link2 className="h-4 w-4" /> Linked accounts / projects</p>
          {sites.length === 0
            ? <p className="text-xs text-muted-foreground">No account is linked to this opportunity yet.</p>
            : sites.map(s => (
              <div key={s.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                <span className="text-sm truncate">{s.name}</span>
                <Badge variant="outline" className="text-[10px]">
                  {s.is_recurring_monthly ? 'Recurring' : 'Project'}
                </Badge>
              </div>
            ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3 space-y-2">
          <p className="text-sm font-medium flex items-center gap-2"><Receipt className="h-4 w-4" /> Invoices</p>
          {invoices.length === 0
            ? <p className="text-xs text-muted-foreground">
                No invoices yet. Invoices appear here once billing is generated for a linked account.
              </p>
            : invoices.map(i => (
              <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
                <div className="min-w-[8rem]">
                  <p className="text-sm font-medium">{i.invoice_number}</p>
                  <p className="text-xs text-muted-foreground">
                    {i.invoice_date}{i.due_date ? ` · due ${i.due_date}` : ''}
                  </p>
                </div>
                <span className="text-sm tabular-nums">{money(i.total)}</span>
                <Badge className={INVOICE_STATUS_CLASS[i.status]}>
                  {INVOICE_STATUS_LABEL[i.status] ?? i.status}
                </Badge>
              </div>
            ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3 space-y-2">
          <p className="text-sm font-medium">Link an existing account to this opportunity</p>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex-1 min-w-[12rem]">
              <JobSitePicker companyId={companyId} value={linkSiteId} onChange={setLinkSiteId} />
            </div>
            <Button size="sm" onClick={linkSite} disabled={!linkSiteId || linking}>
              {linking && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Link
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

/** Lightweight job-site search reusing the CRM picker styling. */
const JobSitePicker = ({ value, onChange, companyId }: {
  value: string | null; onChange: (id: string | null) => void; companyId?: string | null;
}) => {
  const [sites, setSites] = useState<SiteRow[]>([]);
  useEffect(() => {
    let q = db.from('job_sites').select('id, name, is_recurring_monthly').eq('active', true).order('name').limit(200);
    if (companyId) q = q.eq('crm_company_id', companyId);
    q.then(({ data }: any) => setSites(data ?? []));
  }, [companyId]);
  return (
    <select
      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
      value={value ?? ''}
      aria-label="Account to link"
      onChange={e => onChange(e.target.value || null)}
    >
      <option value="">Select an account…</option>
      {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select>
  );
};

export default OpportunityBillingTab;
