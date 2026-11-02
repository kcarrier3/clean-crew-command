import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db, recomputeInvoice } from './billingApi';
import {
  JobSiteSalesTaxFields, jobSiteTaxFromRow, saveJobSiteTax, type JobSiteTaxForm,
} from './JobSiteSalesTaxFields';
import type { Invoice } from '@/lib/billing/types';
import { JOB_SITE_COLUMNS } from '@/lib/jobSiteColumns';

export const TaxReviewBanner = ({ invoice, onChanged }: { invoice: Invoice; onChanged: () => void }) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [original, setOriginal] = useState<JobSiteTaxForm | null>(null);
  const [form, setForm] = useState<JobSiteTaxForm | null>(null);
  const [saving, setSaving] = useState(false);

  const [attachOpen, setAttachOpen] = useState(false);
  const [sites, setSites] = useState<{ id: string; name: string; crm_company_id: string | null }[]>([]);
  const [attachId, setAttachId] = useState('');

  useEffect(() => { setOpen(false); setAttachOpen(false); setAttachId(''); }, [invoice.id]);

  // Invoices saved without an account have no tax county; let billing staff attach one.
  const openAttach = async () => {
    const { data, error } = await db.from('job_sites').select('id, name, crm_company_id').eq('active', true).order('name');
    if (error) {
      toast({ title: 'Could not load accounts', description: error.message, variant: 'destructive' });
      return;
    }
    setSites(data ?? []);
    setAttachOpen(true);
  };

  const saveAttach = async () => {
    const s = sites.find(x => x.id === attachId);
    if (!s) return;
    setSaving(true);
    try {
      // The invoice trigger recalculates sales tax from the new account on save.
      const { error } = await db.from('billing_invoices')
        .update({ job_site_id: s.id, crm_company_id: invoice.crm_company_id ?? s.crm_company_id ?? null })
        .eq('id', invoice.id);
      if (error) throw error;
      toast({ title: 'Account attached', description: 'Sales tax was recalculated.' });
      setAttachOpen(false);
      onChanged();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Could not attach account';
      toast({ title: 'Could not attach account', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const recalc = async () => {
    try {
      await recomputeInvoice({ id: invoice.id, notes: invoice.notes });
      toast({ title: 'Tax recalculated' });
      onChanged();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Could not recalculate';
      toast({ title: 'Could not recalculate', description: message, variant: 'destructive' });
    }
  };

  const editSite = async () => {
    if (!invoice.job_site_id) return;
    const { data, error } = await db.from('job_sites').select(JOB_SITE_COLUMNS).eq('id', invoice.job_site_id).maybeSingle();
    if (error || !data) {
      toast({ title: 'Could not load job site', description: error?.message, variant: 'destructive' });
      return;
    }
    const next = jobSiteTaxFromRow(data);
    setOriginal(next);
    setForm(next);
    setOpen(true);
  };

  const saveSite = async () => {
    if (!invoice.job_site_id || !form || !original) return;
    setSaving(true);
    try {
      await saveJobSiteTax(invoice.job_site_id, form, original);
      await recomputeInvoice({ id: invoice.id, notes: invoice.notes });
      toast({ title: 'Job site tax updated' });
      setOpen(false);
      onChanged();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Could not save job site';
      toast({ title: 'Could not save job site', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (invoice.tax_status !== 'needs_review') return null;

  return (
    <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-950 space-y-2">
      <p className="font-medium flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <span>Sales tax needs review before this invoice can be sent: {invoice.tax_review_reason || 'Review the job site county and customer exemption.'}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {invoice.job_site_id && (
          <Button size="sm" variant="outline" onClick={editSite}>Fix job site county</Button>
        )}
        {!invoice.job_site_id && (
          <Button size="sm" variant="outline" onClick={openAttach}>Choose account</Button>
        )}
        {invoice.crm_company_id && (
          <Button size="sm" variant="outline" asChild>
            <Link to={`/crm/accounts/${invoice.crm_company_id}`}>Customer certificate</Link>
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={recalc}>Recalculate</Button>
      </div>
      {attachOpen && (
        <div className="space-y-2 bg-white text-foreground rounded-md p-2">
          <label htmlFor="trb_site" className="text-xs font-medium">Account for this invoice</label>
          <select id="trb_site" value={attachId} onChange={e => setAttachId(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="" disabled>Select an account</option>
            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div className="flex gap-2">
            <Button size="sm" onClick={saveAttach} disabled={saving || !attachId}>{saving ? 'Saving…' : 'Save and recalculate'}</Button>
            <Button size="sm" variant="ghost" onClick={() => setAttachOpen(false)}>Cancel</Button>
          </div>
        </div>
      )}
      {open && form && (
        <div className="space-y-2 bg-white text-foreground rounded-md p-2">
          <JobSiteSalesTaxFields value={form} onChange={patch => setForm(f => f && ({ ...f, ...patch }))} />
          <div className="flex gap-2">
            <Button size="sm" onClick={saveSite} disabled={saving}>{saving ? 'Saving…' : 'Save and recalculate'}</Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
};
