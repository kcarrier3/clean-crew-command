import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Mail, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { fetchInvoices } from './billingApi';
import { InvoiceDetailDialog } from './InvoiceDetailDialog';
import { SendInvoiceDialog } from './SendInvoiceDialog';
import {
  INVOICE_STATUS_CLASS, INVOICE_STATUS_LABEL, money, type Invoice,
} from '@/lib/billing/types';

interface Props { focusInvoiceId?: string | null; onFocusHandled?: () => void }

export const InvoicesTab = ({ focusInvoiceId, onFocusHandled }: Props) => {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [sendId, setSendId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try { setInvoices(await fetchInvoices()); }
    catch (e: any) { toast({ title: 'Could not load invoices', description: e.message, variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (focusInvoiceId) { setOpenId(focusInvoiceId); onFocusHandled?.(); }
  }, [focusInvoiceId]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return invoices
      .filter(i => status === 'all' || i.status === status)
      .filter(i => !needle
        || i.invoice_number.toLowerCase().includes(needle)
        || (i.customer_name ?? '').toLowerCase().includes(needle)
        || (i.po_number ?? '').toLowerCase().includes(needle));
  }, [invoices, q, status]);

  const openBalance = invoices
    .filter(i => !['paid', 'void'].includes(i.status))
    .reduce((s, i) => s + Number(i.balance_due || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Open A/R</p>
          <p className="text-2xl font-semibold tabular-nums">{money(openBalance)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Invoices</p>
          <p className="text-2xl font-semibold tabular-nums">{invoices.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Past due</p>
          <p className="text-2xl font-semibold tabular-nums">
            {invoices.filter(i => i.status === 'past_due').length}
          </p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-3 gap-3 sm:flex-row sm:items-center sm:justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Invoices</CardTitle>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search number, customer, PO"
                     className="pl-8 w-full sm:w-64" />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {Object.entries(INVOICE_STATUS_LABEL).map(([v, l]) =>
                  <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? <p className="text-sm text-muted-foreground">Loading…</p>
            : !visible.length ? (
              <div className="rounded-md border border-dashed p-8 text-center">
                <p className="text-sm font-medium">No invoices yet</p>
                <p className="text-xs text-muted-foreground mt-1">Generate one from the Ready to Bill queue.</p>
              </div>
            ) : visible.map(i => (
              <div key={i.id}
                   role="button" tabIndex={0}
                   onClick={() => setOpenId(i.id)}
                   onKeyDown={e => { if (e.key === 'Enter') setOpenId(i.id); }}
                   className="w-full rounded-lg border p-3 text-left transition hover:bg-muted/50 cursor-pointer">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{i.invoice_number}</span>
                      <Badge className={INVOICE_STATUS_CLASS[i.status] ?? ''}>
                        {INVOICE_STATUS_LABEL[i.status] ?? i.status}
                      </Badge>
                      {i.email_status && (
                        <Badge variant="outline" className="text-xs">
                          Email: {i.email_status}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {i.customer_name ?? 'No customer'} · Issued {i.invoice_date}
                      {i.due_date ? ` · Due ${i.due_date}` : ''}{i.po_number ? ` · PO ${i.po_number}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold tabular-nums">{money(i.total)}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">Balance {money(i.balance_due)}</p>
                    {i.status !== 'void' && (
                      <Button size="sm" variant="ghost" className="mt-1 h-7 px-2"
                              onClick={e => { e.stopPropagation(); setSendId(i.id); }}>
                        <Mail className="h-3.5 w-3.5 mr-1" />
                        {i.last_emailed_at ? 'Resend' : 'Send'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
        </CardContent>
      </Card>

      <InvoiceDetailDialog
        invoiceId={openId}
        onOpenChange={o => !o && setOpenId(null)}
        onChanged={load}
      />

      <SendInvoiceDialog
        invoiceId={sendId}
        open={!!sendId}
        onOpenChange={o => !o && setSendId(null)}
        onSent={load}
      />
    </div>
  );
};

export default InvoicesTab;