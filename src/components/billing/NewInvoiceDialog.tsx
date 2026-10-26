import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, Trash2, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createManualInvoice, db, type ManualInvoiceLine } from './billingApi';
import { money } from '@/lib/billing/types';
import { dueDateFromTerms } from '@/lib/billing/kpi';

interface Props { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (id: string) => void }
interface Site { id: string; name: string; client_name: string | null; billing_email: string | null; billing_terms: string | null; billing_po_number: string | null; crm_company_id: string | null }

const today = () => new Date().toISOString().slice(0, 10);
const blank = (): ManualInvoiceLine => ({ description: '', quantity: 1, unit_price: 0 });

export const NewInvoiceDialog = ({ open, onOpenChange, onCreated }: Props) => {
  const { toast } = useToast();
  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSiteId] = useState('');
  const [customer, setCustomer] = useState('');
  const [email, setEmail] = useState('');
  const [po, setPo] = useState('');
  const [date, setDate] = useState(today());
  const [terms, setTerms] = useState('Net 30');
  const [taxRate, setTaxRate] = useState('0');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<ManualInvoiceLine[]>([blank()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSiteId(''); setCustomer(''); setEmail(''); setPo(''); setDate(today());
    setTerms('Net 30'); setTaxRate('0'); setNotes(''); setLines([blank()]);
    db.from('job_sites').select('id, name, client_name, billing_email, billing_terms, billing_po_number, crm_company_id')
      .eq('active', true).order('name').then(({ data }: any) => setSites(data ?? []));
  }, [open]);

  const pickSite = (id: string) => {
    setSiteId(id);
    const s = sites.find(x => x.id === id);
    if (!s) return;
    setCustomer(s.client_name || s.name);
    setEmail(s.billing_email || '');
    setPo(s.billing_po_number || '');
    setTerms(s.billing_terms || 'Net 30');
  };

  const setLine = (i: number, patch: Partial<ManualInvoiceLine>) =>
    setLines(ls => ls.map((l, idx) => idx === i ? { ...l, ...patch } : l));

  const subtotal = lines.reduce((s, l) => s + (l.quantity || 0) * (l.unit_price || 0), 0);
  const tax = Math.round(subtotal * (parseFloat(taxRate) || 0)) / 100;

  const submit = async () => {
    setSaving(true);
    try {
      const site = sites.find(s => s.id === siteId);
      const inv = await createManualInvoice({
        jobSiteId: site?.id ?? null, crmCompanyId: site?.crm_company_id ?? null,
        customerName: customer.trim() || null, billingEmail: email.trim() || null,
        poNumber: po.trim() || null, invoiceDate: date, terms,
        taxRate: parseFloat(taxRate) || 0, notes: notes.trim() || null, lines,
      });
      toast({ title: 'Invoice created', description: `${inv.invoice_number} — ${money(inv.total)}` });
      onOpenChange(false);
      onCreated(inv.id);
    } catch (e: any) {
      toast({ title: 'Could not create invoice', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileText className="h-4 w-4" /> New invoice</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ni_site">Account (optional)</Label>
            <select id="ni_site" value={siteId} onChange={e => pickSite(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">No account</option>
              {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5"><Label htmlFor="ni_cust">Customer name</Label>
            <Input id="ni_cust" value={customer} onChange={e => setCustomer(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="ni_email">Billing email</Label>
            <Input id="ni_email" type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="ni_po">PO number</Label>
            <Input id="ni_po" value={po} onChange={e => setPo(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="ni_date">Invoice date</Label>
            <Input id="ni_date" type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="ni_terms">Payment terms</Label>
            <Input id="ni_terms" value={terms} onChange={e => setTerms(e.target.value)} />
            <p className="text-[11px] text-muted-foreground">Due {dueDateFromTerms(date, terms)}</p></div>
          <div className="space-y-1.5"><Label htmlFor="ni_tax">Tax rate (%)</Label>
            <Input id="ni_tax" type="number" step="0.001" value={taxRate} onChange={e => setTaxRate(e.target.value)} /></div>
        </div>

        <div className="space-y-2">
          <Label>Line items</Label>
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_4.5rem_6rem_auto] gap-2 items-center">
              <Input placeholder="Description" value={l.description} onChange={e => setLine(i, { description: e.target.value })} />
              <Input type="number" aria-label="Quantity" value={l.quantity} onChange={e => setLine(i, { quantity: parseFloat(e.target.value) || 0 })} />
              <Input type="number" step="0.01" aria-label="Unit price" value={l.unit_price} onChange={e => setLine(i, { unit_price: parseFloat(e.target.value) || 0 })} />
              <Button variant="ghost" size="icon" aria-label="Remove line" disabled={lines.length === 1}
                      onClick={() => setLines(ls => ls.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setLines(ls => [...ls, blank()])}>
            <Plus className="h-4 w-4 mr-1" /> Add line
          </Button>
        </div>

        <div className="space-y-1.5"><Label htmlFor="ni_notes">Notes</Label>
          <Textarea id="ni_notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} /></div>

        <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
          <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{money(subtotal)}</span></div>
          <div className="flex justify-between"><span>Tax</span><span className="tabular-nums">{money(tax)}</span></div>
          <div className="flex justify-between font-semibold"><span>Total</span><span className="tabular-nums">{money(subtotal + tax)}</span></div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Create invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
