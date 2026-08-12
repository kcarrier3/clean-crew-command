import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createInvoiceFromEvents, db } from './billingApi';
import { money, type BillingEvent } from '@/lib/billing/types';
import { dueDateFromTerms } from '@/lib/billing/kpi';

interface Props {
  events: BillingEvent[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (invoiceId: string) => void;
}

const today = () => new Date().toISOString().slice(0, 10);

export const GenerateInvoiceDialog = ({ events, open, onOpenChange, onCreated }: Props) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [invoiceDate, setInvoiceDate] = useState(today());
  const [terms, setTerms] = useState('Net 30');
  const [taxRate, setTaxRate] = useState('0');
  const [po, setPo] = useState('');
  const [email, setEmail] = useState('');
  const [contact, setContact] = useState('');
  const [customer, setCustomer] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open || !events.length) return;
    const first = events[0];
    setPo(first.po_number ?? '');
    setEmail(first.billing_email ?? '');
    setInvoiceDate(today());
    setNotes('');
    (async () => {
      if (first.job_site_id) {
        const { data } = await db.from('job_sites')
          .select('name, client_name, billing_terms, billing_contact_name, billing_email, billing_po_number')
          .eq('id', first.job_site_id).maybeSingle();
        if (data) {
          setTerms(data.billing_terms || 'Net 30');
          setContact(data.billing_contact_name || '');
          setCustomer(data.client_name || data.name || '');
          if (!first.billing_email && data.billing_email) setEmail(data.billing_email);
          if (!first.po_number && data.billing_po_number) setPo(data.billing_po_number);
        }
      }
      if (first.crm_company_id) {
        const { data: co } = await db.from('crm_companies').select('name').eq('id', first.crm_company_id).maybeSingle();
        if (co?.name) setCustomer(co.name);
        const { data: prefs } = await db.from('billing_account_preferences')
          .select('primary_billing_email, default_terms')
          .eq('crm_company_id', first.crm_company_id).maybeSingle();
        if (prefs?.primary_billing_email) setEmail(prefs.primary_billing_email);
        if (prefs?.default_terms) setTerms(prefs.default_terms);
      }
    })();
  }, [open, events]);

  const subtotal = events.reduce((s, e) => s + Number(e.amount || 0), 0);
  const tax = Math.round(subtotal * (parseFloat(taxRate) || 0) / 100 * 100) / 100;
  const total = subtotal + tax;

  const submit = async () => {
    setSaving(true);
    try {
      const inv = await createInvoiceFromEvents({
        events, invoiceDate, terms,
        taxRate: parseFloat(taxRate) || 0,
        poNumber: po.trim() || null,
        billingEmail: email.trim() || null,
        billingContactName: contact.trim() || null,
        customerName: customer.trim() || null,
        notes: notes.trim() || null,
      });
      toast({ title: 'Invoice generated', description: `${inv.invoice_number} — ${money(inv.total)}` });
      onOpenChange(false);
      onCreated(inv.id);
    } catch (e: any) {
      toast({ title: 'Could not generate invoice', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" /> Generate invoice
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-md border divide-y">
          {events.map(e => (
            <div key={e.id} className="flex items-center justify-between gap-3 p-2 text-sm">
              <span className="min-w-0 truncate">{e.label}</span>
              <span className="font-medium tabular-nums">{money(e.amount)}</span>
            </div>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="inv_customer">Customer / account</Label>
            <Input id="inv_customer" value={customer} onChange={e => setCustomer(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv_contact">Billing contact</Label>
            <Input id="inv_contact" value={contact} onChange={e => setContact(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv_email">Billing email</Label>
            <Input id="inv_email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv_po">PO number</Label>
            <Input id="inv_po" value={po} onChange={e => setPo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv_date">Invoice date</Label>
            <Input id="inv_date" type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv_terms">Payment terms</Label>
            <Input id="inv_terms" value={terms} onChange={e => setTerms(e.target.value)} placeholder="Net 30" />
            <p className="text-xs text-muted-foreground">Due {dueDateFromTerms(invoiceDate, terms)}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv_tax">Tax rate (%)</Label>
            <Input id="inv_tax" type="number" step="0.01" value={taxRate} onChange={e => setTaxRate(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="inv_notes">Notes on invoice</Label>
          <Textarea id="inv_notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
          <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{money(subtotal)}</span></div>
          <div className="flex justify-between"><span>Tax</span><span className="tabular-nums">{money(tax)}</span></div>
          <div className="flex justify-between font-semibold"><span>Total</span><span className="tabular-nums">{money(total)}</span></div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !events.length}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Generate invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GenerateInvoiceDialog;