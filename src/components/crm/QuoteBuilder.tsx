import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, FileDown, PenLine, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { generateQuotePdf } from './generateQuotePdf';
import { QuoteSignatureDialog } from './QuoteSignatureDialog';
import { convertQuoteToInvoice } from './InvoicesList';
import type { CrmDeal, CrmLead, CrmQuote, CrmQuoteItem, CrmService } from './types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: CrmDeal;
  lead: CrmLead | null;
  quote?: CrmQuote | null;
  onSaved?: () => void;
}

interface DraftItem {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
}

const STATUSES: CrmQuote['status'][] = ['draft', 'sent', 'accepted', 'rejected', 'expired'];

export function QuoteBuilder({ open, onOpenChange, deal, lead, quote, onSaved }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<CrmQuote['status']>('draft');
  const [taxRate, setTaxRate] = useState(0);
  const [validUntil, setValidUntil] = useState('');
  const [terms, setTerms] = useState('');
  const [items, setItems] = useState<DraftItem[]>([{ description: '', quantity: 1, unit_price: 0 }]);
  const [services, setServices] = useState<CrmService[]>([]);
  const [sigOpen, setSigOpen] = useState(false);

  useEffect(() => {
    const loadExisting = async () => {
      const { data: svc } = await (supabase as any)
        .from('crm_services').select('*').eq('active', true).order('name');
      setServices(svc || []);
      if (quote) {
        setStatus(quote.status);
        setTaxRate(Number(quote.tax_rate) || 0);
        setValidUntil(quote.valid_until || '');
        setTerms(quote.terms || '');
        const { data } = await (supabase as any)
          .from('crm_quote_items')
          .select('*')
          .eq('quote_id', quote.id)
          .order('sort_order');
        setItems((data || []).map((i: CrmQuoteItem) => ({
          id: i.id, description: i.description, quantity: Number(i.quantity), unit_price: Number(i.unit_price),
        })));
      } else {
        setStatus('draft'); setTaxRate(0); setValidUntil(''); setTerms('');
        setItems([{ description: '', quantity: 1, unit_price: 0 }]);
      }
    };
    if (open) loadExisting();
  }, [open, quote]);

  const subtotal = items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0);
  const tax = subtotal * (Number(taxRate) || 0) / 100;
  const total = subtotal + tax;

  const updateItem = (idx: number, patch: Partial<DraftItem>) => {
    setItems(items.map((it, i) => i === idx ? { ...it, ...patch } : it));
  };

  const addFromService = (serviceId: string) => {
    const s = services.find(x => x.id === serviceId);
    if (!s) return;
    setItems([...items, { description: s.name, quantity: 1, unit_price: Number(s.default_unit_price) }]);
  };

  const handleConvertToInvoice = async () => {
    if (!quote) { toast({ title: 'Save the quote first', variant: 'destructive' }); return; }
    try {
      const inv = await convertQuoteToInvoice(quote.id, user?.id);
      toast({ title: 'Invoice created', description: inv.invoice_number });
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Failed to create invoice', description: e.message, variant: 'destructive' });
    }
  };

  const save = async (alsoDownload = false) => {
    const validItems = items.filter(i => i.description.trim());
    if (validItems.length === 0) {
      toast({ title: 'Add at least one line item', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const quotePayload: any = {
      deal_id: deal.id,
      status,
      subtotal,
      tax_rate: taxRate,
      tax,
      total,
      valid_until: validUntil || null,
      terms: terms || null,
    };
    let savedQuote = quote;
    if (quote) {
      const { data, error } = await (supabase as any)
        .from('crm_quotes').update(quotePayload).eq('id', quote.id).select().single();
      if (error) { toast({ title: 'Failed to save', description: error.message, variant: 'destructive' }); setSaving(false); return; }
      savedQuote = data;
      await (supabase as any).from('crm_quote_items').delete().eq('quote_id', quote.id);
    } else {
      quotePayload.created_by = user?.id;
      const { data, error } = await (supabase as any)
        .from('crm_quotes').insert(quotePayload).select().single();
      if (error) { toast({ title: 'Failed to save', description: error.message, variant: 'destructive' }); setSaving(false); return; }
      savedQuote = data;
    }

    const itemRows = validItems.map((i, idx) => ({
      quote_id: savedQuote!.id,
      description: i.description.trim(),
      quantity: i.quantity,
      unit_price: i.unit_price,
      line_total: (Number(i.quantity) || 0) * (Number(i.unit_price) || 0),
      sort_order: idx,
    }));
    const { error: itemsErr } = await (supabase as any).from('crm_quote_items').insert(itemRows);
    if (itemsErr) {
      toast({ title: 'Failed to save line items', description: itemsErr.message, variant: 'destructive' });
      setSaving(false); return;
    }

    setSaving(false);
    toast({ title: 'Quote saved' });
    onSaved?.();

    if (alsoDownload && savedQuote) {
      const itemsForPdf: CrmQuoteItem[] = itemRows.map(r => ({
        ...r, id: '', sort_order: r.sort_order,
      })) as any;
      generateQuotePdf({
        quote: savedQuote,
        items: itemsForPdf,
        deal,
        clientName: lead?.contact_name || undefined,
        clientEmail: lead?.email || undefined,
        clientCompany: lead?.company_name || undefined,
      });
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{quote ? `Edit ${quote.quote_number}` : 'New Quote'} — {deal.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={v => setStatus(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tax %</Label>
              <Input type="number" step="0.01" value={taxRate} onChange={e => setTaxRate(parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <Label>Valid Until</Label>
              <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <Label>Line Items</Label>
              <div className="flex gap-2">
                {services.length > 0 && (
                  <Select value="" onValueChange={addFromService}>
                    <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="Add from catalog" /></SelectTrigger>
                    <SelectContent>
                      {services.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name} — ${Number(s.default_unit_price).toFixed(2)}/{s.unit}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button size="sm" variant="outline" onClick={() => setItems([...items, { description: '', quantity: 1, unit_price: 0 }])}>
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_80px_100px_100px_32px] gap-2 items-center">
                  <Input placeholder="Description" value={item.description} onChange={e => updateItem(idx, { description: e.target.value })} />
                  <Input type="number" step="0.5" value={item.quantity} onChange={e => updateItem(idx, { quantity: parseFloat(e.target.value) || 0 })} />
                  <Input type="number" step="0.01" placeholder="Price" value={item.unit_price} onChange={e => updateItem(idx, { unit_price: parseFloat(e.target.value) || 0 })} />
                  <div className="text-right text-sm font-medium">${((item.quantity || 0) * (item.unit_price || 0)).toFixed(2)}</div>
                  <Button size="sm" variant="ghost" onClick={() => setItems(items.filter((_, i) => i !== idx))}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t pt-3 space-y-1 text-sm">
            <div className="flex justify-between"><span>Subtotal:</span><span>${subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Tax ({taxRate}%):</span><span>${tax.toFixed(2)}</span></div>
            <div className="flex justify-between font-semibold text-base"><span>Total:</span><span>${total.toFixed(2)}</span></div>
          </div>

          <div>
            <Label>Terms & Conditions</Label>
            <Textarea rows={3} value={terms} onChange={e => setTerms(e.target.value)} placeholder="Payment terms, scope notes…" />
          </div>
        </div>

        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          {quote && (
            <>
              <Button variant="outline" onClick={() => setSigOpen(true)} disabled={saving}>
                <PenLine className="h-4 w-4 mr-2" /> Capture Signature
              </Button>
              <Button variant="outline" onClick={handleConvertToInvoice} disabled={saving}>
                <FileText className="h-4 w-4 mr-2" /> Convert to Invoice
              </Button>
            </>
          )}
          <Button variant="outline" onClick={() => save(true)} disabled={saving}>
            <FileDown className="h-4 w-4 mr-2" /> Save & Download PDF
          </Button>
          <Button onClick={() => save(false)} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
      {quote && (
        <QuoteSignatureDialog
          open={sigOpen}
          onOpenChange={setSigOpen}
          quote={quote}
          onSigned={() => onSaved?.()}
        />
      )}
    </Dialog>
  );
}