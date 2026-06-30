import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileDown, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { generateInvoicePdf } from './generateInvoicePdf';
import { INVOICE_STATUS_LABELS } from './types';
import type { CrmInvoice, CrmInvoiceItem, CrmInvoiceStatus } from './types';

const STATUS_COLORS: Record<CrmInvoiceStatus, string> = {
  draft: 'bg-gray-100 text-gray-800',
  sent: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
  void: 'bg-gray-100 text-gray-500',
};

export function InvoicesList() {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<CrmInvoice[]>([]);
  const [filter, setFilter] = useState<CrmInvoiceStatus | 'all'>('all');

  const load = async () => {
    const { data } = await (supabase as any).from('crm_invoices').select('*').order('created_at', { ascending: false });
    setInvoices(data || []);
  };
  useEffect(() => { load(); }, []);

  const updateStatus = async (id: string, status: CrmInvoiceStatus) => {
    const patch: any = { status };
    if (status === 'paid') patch.paid_at = new Date().toISOString();
    const { error } = await (supabase as any).from('crm_invoices').update(patch).eq('id', id);
    if (error) { toast({ title: 'Update failed', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Invoice updated' });
    load();
  };

  const downloadPdf = async (invoice: CrmInvoice) => {
    const { data: items } = await (supabase as any).from('crm_invoice_items').select('*').eq('invoice_id', invoice.id).order('sort_order');
    let clientCompany: string | undefined;
    if (invoice.company_id) {
      const { data: c } = await (supabase as any).from('crm_companies').select('name').eq('id', invoice.company_id).maybeSingle();
      clientCompany = c?.name;
    }
    generateInvoicePdf({ invoice, items: (items || []) as CrmInvoiceItem[], clientCompany });
  };

  const filtered = filter === 'all' ? invoices : invoices.filter(i => i.status === filter);
  const totalOutstanding = invoices
    .filter(i => i.status === 'sent' || i.status === 'overdue')
    .reduce((s, i) => s + Number(i.total) - Number(i.amount_paid), 0);
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.total), 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-3">
          <p className="text-xs text-muted-foreground">Outstanding</p>
          <p className="text-lg font-bold">${totalOutstanding.toLocaleString()}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-xs text-muted-foreground">Paid (all-time)</p>
          <p className="text-lg font-bold">${totalPaid.toLocaleString()}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-xs text-muted-foreground">Total Invoices</p>
          <p className="text-lg font-bold">{invoices.length}</p>
        </CardContent></Card>
      </div>

      <div className="flex items-center gap-2">
        <Select value={filter} onValueChange={v => setFilter(v as any)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {(Object.keys(INVOICE_STATUS_LABELS) as CrmInvoiceStatus[]).map(s => (
              <SelectItem key={s} value={s}>{INVOICE_STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground ml-2">Invoices are created from quotes.</p>
      </div>

      <div className="space-y-2">
        {filtered.map(inv => (
          <Card key={inv.id}>
            <CardContent className="p-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{inv.invoice_number}</p>
                  <Badge className={STATUS_COLORS[inv.status]}>{INVOICE_STATUS_LABELS[inv.status]}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Issued {format(new Date(inv.issue_date), 'MMM d, yyyy')}
                  {inv.due_date && ` • Due ${format(new Date(inv.due_date), 'MMM d, yyyy')}`}
                </p>
              </div>
              <p className="text-lg font-bold">${Number(inv.total).toFixed(2)}</p>
              <div className="flex items-center gap-2">
                <Select value={inv.status} onValueChange={v => updateStatus(inv.id, v as CrmInvoiceStatus)}>
                  <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(INVOICE_STATUS_LABELS) as CrmInvoiceStatus[]).map(s => (
                      <SelectItem key={s} value={s}>{INVOICE_STATUS_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={() => downloadPdf(inv)}>
                  <FileDown className="h-3 w-3 mr-1" /> PDF
                </Button>
                {inv.status !== 'paid' && (
                  <Button size="sm" variant="outline" onClick={() => updateStatus(inv.id, 'paid')}>
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Mark Paid
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            No invoices yet. Convert an accepted quote into an invoice from the deal pipeline.
          </p>
        )}
      </div>
    </div>
  );
}

export async function convertQuoteToInvoice(quoteId: string, userId: string | undefined) {
  const { data: quote } = await (supabase as any).from('crm_quotes').select('*').eq('id', quoteId).maybeSingle();
  if (!quote) throw new Error('Quote not found');
  const { data: items } = await (supabase as any).from('crm_quote_items').select('*').eq('quote_id', quoteId).order('sort_order');
  let companyId: string | null = null;
  if (quote.deal_id) {
    const { data: deal } = await (supabase as any).from('crm_deals').select('company_id').eq('id', quote.deal_id).maybeSingle();
    companyId = deal?.company_id || null;
  }
  const due = new Date(); due.setDate(due.getDate() + 30);
  const { data: inv, error } = await (supabase as any).from('crm_invoices').insert({
    deal_id: quote.deal_id,
    quote_id: quote.id,
    company_id: companyId,
    status: 'draft',
    subtotal: quote.subtotal,
    tax_rate: quote.tax_rate,
    tax: quote.tax,
    total: quote.total,
    due_date: due.toISOString().slice(0, 10),
    terms: quote.terms,
    created_by: userId,
  }).select().single();
  if (error) throw error;
  if (items && items.length) {
    await (supabase as any).from('crm_invoice_items').insert(
      items.map((it: any, idx: number) => ({
        invoice_id: inv.id,
        description: it.description,
        quantity: it.quantity,
        unit_price: it.unit_price,
        line_total: it.line_total,
        sort_order: idx,
      }))
    );
  }
  return inv;
}