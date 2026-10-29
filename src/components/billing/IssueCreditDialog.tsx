import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CrmLinkPicker } from './CrmLinkPicker';
import { db } from './billingApi';
import { CREDIT_REASONS, issueCustomerCredit, type CreditReason } from './creditsApi';
import { money } from '@/lib/billing/types';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onIssued?: () => void;
  defaultCompanyId?: string | null;
  defaultJobSiteId?: string | null;
  defaultInvoiceId?: string | null;
}

interface Site { id: string; name: string; crm_company_id: string | null }

export const IssueCreditDialog = ({
  open, onOpenChange, onIssued, defaultCompanyId, defaultJobSiteId, defaultInvoiceId,
}: Props) => {
  const { toast } = useToast();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [siteId, setSiteId] = useState('');
  const [sites, setSites] = useState<Site[]>([]);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState<CreditReason | ''>('');
  const [notes, setNotes] = useState('');
  const [reduces, setReduces] = useState(true);
  const [autoApply, setAutoApply] = useState(true);
  const [expires, setExpires] = useState('');
  const [referredId, setReferredId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCompanyId(defaultCompanyId ?? null);
    setSiteId(defaultJobSiteId ?? '');
    setAmount('');
    setReason('');
    setNotes('');
    setReduces(true);
    setAutoApply(true);
    setExpires('');
    setReferredId(null);
    db.from('job_sites').select('id, name, crm_company_id').eq('active', true).order('name')
      .then((res: { data: Site[] | null }) => setSites(res.data ?? []));
  }, [open, defaultCompanyId, defaultJobSiteId]);

  const visibleSites = companyId ? sites.filter(s => !s.crm_company_id || s.crm_company_id === companyId) : sites;
  const amountOk = Number(amount) > 0;
  const partyOk = !!(companyId || siteId);
  const referralOk = reason !== 'referral' || (!!referredId && referredId !== companyId);
  const canIssue = amountOk && partyOk && reason !== '' && referralOk;

  useEffect(() => {
    if (companyId && referredId === companyId) setReferredId(null);
  }, [companyId, referredId]);

  const submit = async () => {
    if (!canIssue) return;
    const value = Number(amount);
    setSaving(true);
    try {
      const row = await issueCustomerCredit({
        amount: value,
        reason,
        crmCompanyId: companyId,
        jobSiteId: siteId || null,
        notes: notes.trim() || null,
        reducesTaxableAmount: reduces,
        autoApply,
        relatedInvoiceId: defaultInvoiceId ?? null,
        referredCompanyId: reason === 'referral' ? referredId : null,
        expiresOn: expires || null,
      });
      const status = (row as { status?: string } | null)?.status;
      toast({
        title: status === 'pending_approval' ? 'Credit waiting for approval' : 'Credit issued',
        description: status === 'pending_approval'
          ? `${money(value)} is over the self-approve limit and needs Owner, Office Manager, or Operations Manager.`
          : `${money(value)} is available${autoApply ? ' and will apply to an open invoice when one exists' : ''}.`,
      });
      onOpenChange(false);
      onIssued?.();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Could not issue credit';
      toast({ title: 'Could not issue credit', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Issue credit</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Customer</Label>
            <CrmLinkPicker kind="company" value={companyId} onChange={id => setCompanyId(id)} placeholder="Customer" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cr_site">Job site</Label>
            <select id="cr_site" value={siteId} onChange={e => {
              const id = e.target.value;
              setSiteId(id);
              const site = sites.find(s => s.id === id);
              if (site?.crm_company_id && !companyId) setCompanyId(site.crm_company_id);
            }} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">No job site</option>
              {visibleSites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cr_reason">Reason</Label>
            <select id="cr_reason" required value={reason}
                    onChange={e => {
                      const next = e.target.value as CreditReason | '';
                      setReason(next);
                      if (next !== 'referral') setReferredId(null);
                    }}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Select a reason…</option>
              {CREDIT_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          {reason === 'referral' && (
            <div className="space-y-1.5">
              <Label>Who they referred</Label>
              <CrmLinkPicker
                kind="company"
                value={referredId}
                excludeId={companyId}
                onChange={id => setReferredId(id)}
                placeholder="Search customers"
              />
              <p className="text-xs text-muted-foreground">Required. Choose a different customer than the one receiving this credit.</p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="cr_amt">Amount</Label>
            <Input id="cr_amt" type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cr_exp">Expires</Label>
            <Input id="cr_exp" type="date" value={expires} onChange={e => setExpires(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cr_notes">Notes</Label>
            <Textarea id="cr_notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={reduces} onCheckedChange={v => setReduces(!!v)} className="mt-0.5" />
            <span>
              Reduces taxable amount
              <span className="block text-xs text-muted-foreground">Referral credit tax treatment: confirm with CPA.</span>
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={autoApply} onCheckedChange={v => setAutoApply(!!v)} />
            Apply automatically to the oldest unsent invoice
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !canIssue}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Issue credit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
