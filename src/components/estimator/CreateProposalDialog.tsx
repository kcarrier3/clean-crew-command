import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createProposal, proposalTotals, type ProposalLine, type Proposal } from '@/lib/proposals/proposalApi';
import { money } from './calc';
import { BillToShipTo, toEditable, type EditableAddress } from '@/components/billing/BillToShipTo';
import {
  fetchCompanyAddress, fetchTaxRates, resolveTaxRate, type ResolvedTax, type TaxRateRow,
} from '@/lib/billing/taxRates';

export interface ProposalDefaults {
  title: string;
  periodLabel: string;
  customerName?: string | null;
  customerContactName?: string | null;
  customerEmail?: string | null;
  lines: ProposalLine[];
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  estimateId: string | null;
  revisionId: string | null;
  leadId: string | null;
  companyId: string | null;
  defaults: ProposalDefaults;
  onCreated?: (p: Proposal) => void;
}

/** Builds the customer-safe version of an estimate: prices only, no cost data. */
export function CreateProposalDialog({
  open, onOpenChange, estimateId, revisionId, leadId, companyId, defaults, onCreated,
}: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(defaults.title);
  const [customerName, setCustomerName] = useState(defaults.customerName || '');
  const [contactName, setContactName] = useState(defaults.customerContactName || '');
  const [email, setEmail] = useState(defaults.customerEmail || '');
  const [validUntil, setValidUntil] = useState('');
  const [intro, setIntro] = useState('');
  const [terms, setTerms] = useState('');
  const [taxRate, setTaxRate] = useState(0);
  const [lines, setLines] = useState<ProposalLine[]>(defaults.lines);
  const [billTo, setBillTo] = useState<EditableAddress>(toEditable());
  const [shipTo, setShipTo] = useState<EditableAddress>(toEditable());
  const [rates, setRates] = useState<TaxRateRow[]>([]);
  const [resolved, setResolved] = useState<ResolvedTax | null>(null);
  const [taxTouched, setTaxTouched] = useState(false);

  useEffect(() => { fetchTaxRates().then(setRates).catch(() => setRates([])); }, []);

  useEffect(() => {
    if (!open) return;
    setTitle(defaults.title);
    setCustomerName(defaults.customerName || '');
    setContactName(defaults.customerContactName || '');
    setEmail(defaults.customerEmail || '');
    setLines(defaults.lines.map(l => ({ ...l })));
    setValidUntil('');
    setIntro('');
    setTerms('');
    setTaxRate(0);
    setTaxTouched(false);
    (async () => {
      const co = await fetchCompanyAddress(companyId);
      const addr = toEditable(co ?? { name: defaults.customerName ?? '' });
      setBillTo(addr);
      setShipTo(addr);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Tax follows the ship-to (service) city unless it was typed over.
  useEffect(() => {
    if (!open || !rates.length) return;
    const r = resolveTaxRate(shipTo, rates);
    setResolved(r);
    if (!taxTouched) setTaxRate(r.rate);
  }, [open, rates, shipTo, taxTouched]);

  const totals = proposalTotals(lines, taxRate);

  const patch = (idx: number, p: Partial<ProposalLine>) =>
    setLines(ls => ls.map((l, i) => (i === idx ? { ...l, ...p } : l)));

  const save = async () => {
    const valid = lines.filter(l => l.label.trim());
    if (!valid.length) {
      toast({ title: 'Add at least one service line', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const p = await createProposal({
        estimate_id: estimateId,
        revision_id: revisionId,
        lead_id: leadId,
        company_id: companyId,
        title: title.trim() || 'Service Proposal',
        customer_name: customerName.trim() || null,
        customer_contact_name: contactName.trim() || null,
        customer_email: email.trim() || null,
        period_label: defaults.periodLabel,
        valid_until: validUntil || null,
        intro: intro.trim() || null,
        terms: terms.trim() || null,
        lines: valid.map(l => ({ label: l.label.trim(), detail: l.detail?.trim() || null, amount: Number(l.amount) || 0 })),
        tax_rate: Number(taxRate) || 0,
        bill_to_name: billTo.name || null,
        bill_to_address: billTo.address || null,
        bill_to_city: billTo.city || null,
        bill_to_state: billTo.state || null,
        bill_to_zip: billTo.zip || null,
        ship_to_name: shipTo.name || null,
        ship_to_address: shipTo.address || null,
        ship_to_city: shipTo.city || null,
        ship_to_state: shipTo.state || null,
        ship_to_zip: shipTo.zip || null,
        tax_jurisdiction: resolved?.jurisdiction ?? null,
      });
      toast({ title: `Proposal ${p.proposal_number} created`, description: 'Linked to this estimate and the opportunity in Waypoint.' });
      onCreated?.(p);
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Could not create proposal', description: e?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Customer proposal</DialogTitle>
          <DialogDescription>
            Only what you see here is shared with the customer — wages, burden, supply cost, overhead and margin are never included.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs">Proposal title</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Customer / account</Label>
              <Input value={customerName} onChange={e => setCustomerName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Contact name</Label>
              <Input value={contactName} onChange={e => setContactName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Contact email</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Valid until</Label>
              <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Introduction (optional)</Label>
          </div>

          <BillToShipTo
            billTo={billTo} shipTo={shipTo} onBillTo={setBillTo} onShipTo={setShipTo}
            resolved={resolved}
            taxOverridden={taxTouched && !!resolved && taxRate !== resolved.rate}
            onResetTax={() => { setTaxTouched(false); if (resolved) setTaxRate(resolved.rate); }}
          />

          <div className="space-y-1.5">
            <Textarea rows={2} value={intro} onChange={e => setIntro(e.target.value)}
              placeholder="Thank you for the opportunity to provide facility services…" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs">Services &amp; pricing ({defaults.periodLabel})</Label>
              <Button size="sm" variant="outline"
                onClick={() => setLines([...lines, { label: '', detail: '', amount: 0 }])}>
                <Plus className="h-3 w-3 mr-1" /> Add line
              </Button>
            </div>
            <div className="space-y-2">
              {lines.map((l, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_110px_32px] gap-2 items-start">
                  <div className="space-y-1">
                    <Input placeholder="Service" value={l.label} onChange={e => patch(idx, { label: e.target.value })} />
                    <Input className="h-8 text-xs" placeholder="Customer-facing detail (optional)"
                      value={l.detail || ''} onChange={e => patch(idx, { detail: e.target.value })} />
                  </div>
                  <Input type="number" step="0.01" value={l.amount}
                    onChange={e => patch(idx, { amount: parseFloat(e.target.value) || 0 })} />
                  <Button size="sm" variant="ghost" onClick={() => setLines(lines.filter((_, i) => i !== idx))}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs">Tax %</Label>
              <Input type="number" step="0.01" value={taxRate}
                onChange={e => { setTaxTouched(true); setTaxRate(parseFloat(e.target.value) || 0); }} />
              {resolved && (
                <p className="text-xs text-muted-foreground">
                  {resolved.jurisdiction ? `${resolved.jurisdiction} — ${resolved.rate.toFixed(2)}%` : 'No jurisdiction match'}
                </p>
              )}
            </div>
            <div className="text-sm space-y-1">
              <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{money(totals.subtotal)}</span></div>
              <div className="flex justify-between"><span>Tax</span><span className="tabular-nums">{money(totals.tax)}</span></div>
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Total {defaults.periodLabel}</span>
                <span className="tabular-nums">{money(totals.total)}</span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Terms &amp; conditions (optional)</Label>
            <Textarea rows={3} value={terms} onChange={e => setTerms(e.target.value)}
              placeholder="Payment terms, contract length, cancellation notice…" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Creating…' : 'Create proposal'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CreateProposalDialog;
