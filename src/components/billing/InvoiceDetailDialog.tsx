import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Mail, Send, Ban, History, CreditCard, AlertTriangle, Link2 } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { db } from './billingApi';
import { RecordPaymentDialog } from './RecordPaymentDialog';
import { SendInvoiceDialog } from './SendInvoiceDialog';
import { saveInvoicePdf } from '@/lib/billing/invoicePdf';
import {
  EMAIL_STATUS_CLASS, EMAIL_STATUS_LABEL,
  INVOICE_STATUS_CLASS, INVOICE_STATUS_LABEL, money, type Invoice, type InvoiceItem,
} from '@/lib/billing/types';
import { businessDays, calendarDays } from '@/lib/billing/kpi';
import {
  DEFAULT_ONLINE_PAYMENT_CONFIG, buildPaymentLink, isCollectionReady,
  setInvoiceOnlinePayment, PROCESSOR_LABEL, fetchOnlinePaymentConfig,
  type OnlinePaymentConfig,
} from '@/lib/billing/onlinePayments';

interface Props {
  invoiceId: string | null;
  onOpenChange: (o: boolean) => void;
  onChanged?: () => void;
}

export const InvoiceDetailDialog = ({ invoiceId, onOpenChange, onChanged }: Props) => {
  const { toast } = useToast();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [emails, setEmails] = useState<any[]>([]);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [payCfg, setPayCfg] = useState<OnlinePaymentConfig>(DEFAULT_ONLINE_PAYMENT_CONFIG);

  const load = async () => {
    if (!invoiceId) return;
    setLoading(true);
    const [{ data: inv }, { data: it }, { data: hist }, { data: allocs }, { data: em }] = await Promise.all([
      db.from('billing_invoices').select('*').eq('id', invoiceId).maybeSingle(),
      db.from('billing_invoice_items').select('*').eq('invoice_id', invoiceId).order('sort_order'),
      db.from('billing_invoice_history').select('*').eq('invoice_id', invoiceId).order('created_at', { ascending: false }),
      db.from('billing_payment_allocations')
        .select('id, amount, payment:billing_payments(*)').eq('invoice_id', invoiceId),
      db.from('billing_email_messages').select('*').eq('invoice_id', invoiceId).order('created_at', { ascending: false }),
    ]);
    setInvoice(inv ?? null);
    setItems(it ?? []);
    setHistory(hist ?? []);
    setPayments(allocs ?? []);
    setEmails(em ?? []);
    let siteName: string | null = null;
    if (inv?.job_site_id) {
      const { data: site } = await db.from('job_sites').select('name').eq('id', inv.job_site_id).maybeSingle();
      siteName = site?.name ?? null;
    }
    setProjectName(siteName);
    setLoading(false);
  };

  useEffect(() => { if (invoiceId) load(); }, [invoiceId]);
  useEffect(() => { fetchOnlinePaymentConfig().then(setPayCfg).catch(() => {}); }, []);

  /** Turns the customer pay link on or off for this invoice. */
  const toggleOnlinePayment = async (on: boolean) => {
    if (!invoice) return;
    const link = on ? buildPaymentLink(payCfg, invoice) : null;
    try {
      await setInvoiceOnlinePayment(invoice.id, { enabled: on, link, processor: payCfg.processor });
      toast({ title: on ? 'Online payment enabled for this invoice' : 'Online payment turned off' });
      load(); onChanged?.();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const copyPayLink = async (link: string) => {
    await navigator.clipboard.writeText(link);
    toast({ title: 'Pay link copied' });
  };

  const downloadPdf = () => {
    if (!invoice) return;
    saveInvoicePdf({
      invoice: {
        invoice_number: invoice.invoice_number,
        status: invoice.status,
        issue_date: invoice.invoice_date,
        due_date: invoice.due_date,
        po_number: invoice.po_number,
        terms: invoice.payment_terms,
        notes: invoice.notes,
        subtotal: Number(invoice.subtotal),
        tax_rate: Number(invoice.tax_rate),
        tax: Number(invoice.tax),
        total: Number(invoice.total),
        amount_paid: Number(invoice.amount_paid),
        balance_due: Number(invoice.balance_due),
        bill_to_address: (invoice as any).bill_to_address,
        bill_to_city: (invoice as any).bill_to_city,
        bill_to_state: (invoice as any).bill_to_state,
        bill_to_zip: (invoice as any).bill_to_zip,
        ship_to_name: (invoice as any).ship_to_name,
        ship_to_address: (invoice as any).ship_to_address,
        ship_to_city: (invoice as any).ship_to_city,
        ship_to_state: (invoice as any).ship_to_state,
        ship_to_zip: (invoice as any).ship_to_zip,
        tax_jurisdiction: (invoice as any).tax_jurisdiction,
      },
      items: items.map(i => ({
        description: i.description, quantity: Number(i.quantity),
        unit_price: Number(i.unit_price), line_total: Number(i.line_total),
      })),
      clientCompany: invoice.customer_name,
      clientName: invoice.billing_contact_name,
      clientEmail: invoice.billing_email,
      projectName,
    });
  };

  const voidInvoice = async () => {
    if (!invoice) return;
    if (Number(invoice.amount_paid) > 0) {
      toast({
        title: 'Cannot void a paid invoice',
        description: 'Remove or reallocate the applied payments first, then void.',
        variant: 'destructive',
      });
      return;
    }
    const { error } = await db.from('billing_invoices')
      .update({ status: 'void', voided_at: new Date().toISOString() }).eq('id', invoice.id);
    if (error) return toast({ title: 'Error', description: error.message, variant: 'destructive' });
    await db.from('billing_events').update({ status: 'ready', invoice_id: null, invoiced_at: null })
      .eq('invoice_id', invoice.id);
    // Recurring invoices: reopen the period so it can be regenerated.
    await db.from('recurring_billing_periods')
      .update({ status: 'ready', invoice_id: null, generated_at: null })
      .eq('invoice_id', invoice.id);
    toast({ title: 'Invoice voided', description: 'Its billable items returned to the billing queue.' });
    load(); onChanged?.();
  };

  const markSentManually = async () => {
    if (!invoice) return;
    const { error } = await db.from('billing_invoices')
      .update({ sent_at: new Date().toISOString(), status: 'sent' }).eq('id', invoice.id);
    if (error) return toast({ title: 'Error', description: error.message, variant: 'destructive' });
    await db.from('billing_invoice_history').insert({
      invoice_id: invoice.id, event_type: 'sent_manually', detail: 'Marked as sent outside the app',
    });
    load(); onChanged?.();
  };

  const daysToInvoice = invoice
    ? calendarDays(invoice.earliest_completed_at, invoice.generated_at) : null;
  const bizToInvoice = invoice
    ? businessDays(invoice.earliest_completed_at, invoice.generated_at) : null;

  return (
    <>
      <Dialog open={!!invoiceId} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-3xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              Invoice {invoice?.invoice_number ?? ''}
              {invoice && (
                <Badge className={INVOICE_STATUS_CLASS[invoice.status] ?? ''}>
                  {INVOICE_STATUS_LABEL[invoice.status] ?? invoice.status}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {loading || !invoice ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <Tabs defaultValue="detail">
              <TabsList>
                <TabsTrigger value="detail">Invoice</TabsTrigger>
                <TabsTrigger value="payments">Payments</TabsTrigger>
                <TabsTrigger value="email">Email</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>

              <TabsContent value="detail" className="space-y-4 mt-4">
                <div className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  <div><span className="text-muted-foreground">Customer:</span> {invoice.customer_name ?? '—'}</div>
                  <div><span className="text-muted-foreground">Project:</span> {projectName ?? '—'}</div>
                  <div><span className="text-muted-foreground">Billing contact:</span> {invoice.billing_contact_name ?? '—'}</div>
                  <div><span className="text-muted-foreground">Billing email:</span> {invoice.billing_email ?? '—'}</div>
                  <div><span className="text-muted-foreground">Invoice date:</span> {invoice.invoice_date}</div>
                  <div><span className="text-muted-foreground">Due:</span> {invoice.due_date ?? '—'} ({invoice.payment_terms ?? 'Net 30'})</div>
                  <div><span className="text-muted-foreground">PO:</span> {invoice.po_number ?? '—'}</div>
                  <div><span className="text-muted-foreground">QuickBooks:</span> {invoice.qb_sync_status.replace('_', ' ')}</div>
                </div>

                <div className="rounded-md border">
                  <div className="grid grid-cols-12 gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <span className="col-span-7">Description</span>
                    <span className="col-span-2 text-right">Qty</span>
                    <span className="col-span-3 text-right">Amount</span>
                  </div>
                  {items.map(i => (
                    <div key={i.id} className="grid grid-cols-12 gap-2 px-3 py-2 text-sm border-b last:border-0">
                      <span className="col-span-7">{i.description}</span>
                      <span className="col-span-2 text-right tabular-nums">{Number(i.quantity)}</span>
                      <span className="col-span-3 text-right tabular-nums">{money(i.line_total)}</span>
                    </div>
                  ))}
                </div>

                <div className="ml-auto w-full sm:w-72 space-y-1 text-sm">
                  <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{money(invoice.subtotal)}</span></div>
                  <div className="flex justify-between"><span>Tax</span><span className="tabular-nums">{money(invoice.tax)}</span></div>
                  <div className="flex justify-between font-semibold"><span>Total</span><span className="tabular-nums">{money(invoice.total)}</span></div>
                  <div className="flex justify-between text-green-700"><span>Paid</span><span className="tabular-nums">{money(invoice.amount_paid)}</span></div>
                  <div className="flex justify-between font-semibold"><span>Balance due</span><span className="tabular-nums">{money(invoice.balance_due)}</span></div>
                </div>

                <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                  Completed {invoice.earliest_completed_at ? format(new Date(invoice.earliest_completed_at), 'MMM d, yyyy') : '—'} ·
                  Invoiced {format(new Date(invoice.generated_at), 'MMM d, yyyy')} ·
                  {daysToInvoice != null ? ` ${daysToInvoice} calendar days` : ' —'}
                  {bizToInvoice != null ? ` (${bizToInvoice} business days)` : ''}
                  {invoice.sent_at ? ` · Sent ${format(new Date(invoice.sent_at), 'MMM d, yyyy')}` : ' · Not sent yet'}
                </div>

                <div className="rounded-md border p-3 space-y-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium flex items-center gap-2">
                      <CreditCard className="h-4 w-4" /> Online payment
                    </p>
                    <Badge variant="outline">{PROCESSOR_LABEL[payCfg.processor]}</Badge>
                  </div>
                  {!isCollectionReady(payCfg) ? (
                    <p className="text-xs text-muted-foreground">
                      Online collection is not switched on yet. Set the processor and pay page in
                      Billing → Settings → Online payment collection, then invoices can carry a pay link.
                    </p>
                  ) : (invoice as any).online_payment_enabled && (invoice as any).payment_link_url ? (
                    <div className="space-y-2">
                      <p className="text-xs break-all text-muted-foreground">{(invoice as any).payment_link_url}</p>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline"
                                onClick={() => copyPayLink((invoice as any).payment_link_url)}>
                          <Link2 className="h-4 w-4 mr-1" /> Copy pay link
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => toggleOnlinePayment(false)}>
                          Turn off
                        </Button>
                      </div>
                      {(invoice as any).online_paid_at && (
                        <p className="text-xs text-green-700">
                          Paid online {format(new Date((invoice as any).online_paid_at), 'MMM d, yyyy')}
                        </p>
                      )}
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => toggleOnlinePayment(true)}
                            disabled={invoice.status === 'void'}>
                      <Link2 className="h-4 w-4 mr-1" /> Create pay link for this invoice
                    </Button>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={downloadPdf}>
                    <Download className="h-4 w-4 mr-1" /> Download PDF
                  </Button>
                  <Button size="sm" onClick={() => setPayOpen(true)} disabled={invoice.status === 'void'}>
                    <CreditCard className="h-4 w-4 mr-1" /> Record payment
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setSendOpen(true)}
                          disabled={invoice.status === 'void'}>
                    <Mail className="h-4 w-4 mr-1" />
                    {invoice.last_emailed_at ? 'Resend invoice' : 'Send invoice'}
                  </Button>
                  {!invoice.sent_at && invoice.status !== 'void' && (
                    <Button size="sm" variant="outline" onClick={markSentManually}>
                      <Send className="h-4 w-4 mr-1" /> Mark as sent
                    </Button>
                  )}
                  {invoice.status !== 'void' && (
                    <Button size="sm" variant="ghost" onClick={voidInvoice}>
                      <Ban className="h-4 w-4 mr-1" /> Void
                    </Button>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="payments" className="space-y-3 mt-4">
                {!payments.length ? (
                  <p className="text-sm text-muted-foreground">No payments applied yet.</p>
                ) : payments.map(a => (
                  <div key={a.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                    <div>
                      <p className="font-medium">
                        {money(a.amount)} · {a.payment?.method === 'check' ? 'Check' : a.payment?.method}
                        {a.payment?.reference_number ? ` #${a.payment.reference_number}` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Received {a.payment?.payment_date}
                        {a.payment?.deposit_date ? ` · Deposited ${a.payment.deposit_date}` : ''}
                        {a.payment?.deposit_account_label ? ` · ${a.payment.deposit_account_label}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
                <Button size="sm" onClick={() => setPayOpen(true)} disabled={invoice.status === 'void'}>
                  <CreditCard className="h-4 w-4 mr-1" /> Record payment
                </Button>
              </TabsContent>

              <TabsContent value="email" className="space-y-3 mt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" onClick={() => setSendOpen(true)} disabled={invoice.status === 'void'}>
                    <Mail className="h-4 w-4 mr-1" />
                    {emails.some(m => m.status === 'sent' || m.status === 'delivered')
                      ? 'Resend invoice' : 'Send invoice'}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Review the message before it goes out — nothing sends from this screen directly.
                  </span>
                </div>

                {!emails.length ? (
                  <p className="text-sm text-muted-foreground">This invoice has not been emailed yet.</p>
                ) : (
                  <div className="space-y-2 pt-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Delivery history</p>
                    {emails.map(m => (
                      <div key={m.id} className="rounded-md border p-2 text-xs space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={EMAIL_STATUS_CLASS[m.status] ?? ''}>
                            {EMAIL_STATUS_LABEL[m.status] ?? m.status}
                          </Badge>
                          <span className="text-muted-foreground">
                            {format(new Date(m.created_at), 'MMM d, yyyy p')} · {m.provider ?? 'no provider'}
                          </span>
                        </div>
                        <p>{m.subject}</p>
                        <p className="text-muted-foreground break-words">
                          To: {(m.to_recipients ?? []).join(', ')}
                          {m.cc_recipients?.length ? ` · CC: ${m.cc_recipients.join(', ')}` : ''}
                        </p>
                        <p className="text-muted-foreground">
                          {m.sent_at ? `Sent ${format(new Date(m.sent_at), 'MMM d, p')}` : 'Not sent'}
                          {m.delivered_at ? ` · Delivered ${format(new Date(m.delivered_at), 'MMM d, p')}` : ''}
                          {m.opened_at ? ` · Opened ${format(new Date(m.opened_at), 'MMM d, p')}` : ''}
                        </p>
                        {(m.failure_reason || m.error_message) && (
                          <p className="text-destructive flex items-start gap-1">
                            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                            {m.failure_reason || m.error_message}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="history" className="space-y-2 mt-4">
                {!history.length ? (
                  <p className="text-sm text-muted-foreground">No history yet.</p>
                ) : history.map(h => (
                  <div key={h.id} className="flex items-start gap-2 rounded-md border p-2 text-sm">
                    <History className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div>
                      <p>
                        {h.event_type.replace(/_/g, ' ')}
                        {h.from_status ? ` — ${h.from_status} → ${h.to_status}` : h.to_status ? ` — ${h.to_status}` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(h.created_at), 'MMM d, yyyy p')}{h.detail ? ` · ${h.detail}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      <RecordPaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        invoice={invoice}
        onSaved={() => { load(); onChanged?.(); }}
      />

      <SendInvoiceDialog
        invoiceId={invoiceId}
        open={sendOpen}
        onOpenChange={setSendOpen}
        onSent={() => { load(); onChanged?.(); }}
      />
    </>
  );
};

export default InvoiceDetailDialog;