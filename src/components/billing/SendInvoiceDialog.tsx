import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Loader2, Mail, Paperclip, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from './billingApi';
import { invoicePdfBlob } from '@/lib/billing/invoicePdf';
import { money } from '@/lib/billing/types';
import {
  DEFAULT_INVOICE_BODY, DEFAULT_INVOICE_SUBJECT, fetchEmailConfig, renderTemplate,
  sendInvoiceEmail, uploadInvoicePdf, type EmailConfig,
} from '@/lib/billing/emailService';

interface Props {
  invoiceId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSent?: () => void;
}

const listToText = (v: string[] | null | undefined) => (v ?? []).filter(Boolean).join(', ');
const textToList = (v: string) => v.split(',').map(s => s.trim()).filter(Boolean);

/** Preview + composer shown before any invoice email leaves the building. */
export const SendInvoiceDialog = ({ invoiceId, open, onOpenChange, onSent }: Props) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [config, setConfig] = useState<EmailConfig | null>(null);
  const [invoice, setInvoice] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [instructions, setInstructions] = useState<string | null>(null);
  /** One key per intended send — repeat clicks can never mail a duplicate. */
  const sendKey = useRef<string>('');

  useEffect(() => {
    if (!open || !invoiceId) return;
    sendKey.current = crypto.randomUUID();
    setLoading(true);
    (async () => {
      const cfg = await fetchEmailConfig(true);
      setConfig(cfg);

      const [{ data: inv }, { data: its }, { data: tpl }] = await Promise.all([
        db.from('billing_invoices').select('*').eq('id', invoiceId).maybeSingle(),
        db.from('billing_invoice_items').select('*').eq('invoice_id', invoiceId).order('sort_order'),
        db.from('billing_email_templates').select('*').eq('key', 'invoice_default').maybeSingle(),
      ]);
      setInvoice(inv ?? null);
      setItems(its ?? []);

      let site: string | null = null;
      if (inv?.job_site_id) {
        const { data } = await db.from('job_sites').select('name').eq('id', inv.job_site_id).maybeSingle();
        site = data?.name ?? null;
      }
      setProjectName(site);

      let prefs: any = null;
      if (inv?.crm_company_id) {
        const { data } = await db.from('billing_account_preferences')
          .select('*').eq('crm_company_id', inv.crm_company_id).maybeSingle();
        prefs = data ?? null;
      }
      setInstructions(prefs?.special_instructions ?? null);

      const recipients = [
        prefs?.primary_billing_email || inv?.billing_email || '',
        ...(prefs?.additional_recipients ?? []),
      ].filter(Boolean);
      setTo(listToText(Array.from(new Set(recipients))));
      setCc(listToText(prefs?.cc_recipients));

      const contactName = prefs?.billing_contact_name || inv?.billing_contact_name || '';
      const vars: Record<string, string> = {
        invoice_number: inv?.invoice_number ?? '',
        customer_name: inv?.customer_name ?? site ?? '',
        billing_contact_first_name: contactName.split(' ')[0] || 'there',
        invoice_total: money(inv?.total),
        invoice_date: inv?.invoice_date ?? '',
        due_date: inv?.due_date ?? '',
        po_number: inv?.po_number ?? '—',
        project_name: site ?? '',
        company_name: 'Summit Facilities Group',
      };
      setSubject(renderTemplate(tpl?.subject || DEFAULT_INVOICE_SUBJECT, vars));
      setBody(renderTemplate(tpl?.body || DEFAULT_INVOICE_BODY, vars));
      setLoading(false);
    })();
  }, [open, invoiceId]);

  const send = async () => {
    if (!invoice || sending) return;
    const recipients = textToList(to);
    if (!recipients.length) {
      toast({
        title: 'No billing email on file',
        description: 'Add a billing email for this account in Billing → Settings, or type one here before sending.',
        variant: 'destructive',
      });
      return;
    }
    setSending(true);
    try {
      const blob = invoicePdfBlob({
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
      const path = await uploadInvoicePdf(invoice.id, invoice.invoice_number, blob);

      const res = await sendInvoiceEmail({
        invoice_id: invoice.id,
        template_key: 'invoice_default',
        to: recipients,
        cc: textToList(cc),
        subject, body,
        attachment_path: path,
        idempotency_key: sendKey.current,
      });

      if (res.ok) {
        toast({
          title: res.duplicate ? 'Already sent' : 'Invoice emailed',
          description: `${invoice.invoice_number} → ${recipients.join(', ')}`,
        });
        onOpenChange(false);
        onSent?.();
      } else {
        toast({
          title: res.configured === false ? 'Email sending is not configured yet' : 'Invoice not sent',
          description: res.error,
          variant: 'destructive',
        });
        onSent?.();
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!sending) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <Mail className="h-4 w-4" /> Send invoice {invoice?.invoice_number ?? ''}
            {config && (
              <Badge variant={config.configured ? 'secondary' : 'destructive'}>
                {config.configured ? `Provider: ${config.provider}` : 'Sending not configured'}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading || !invoice ? (
          <p className="text-sm text-muted-foreground">Loading invoice…</p>
        ) : (
          <div className="space-y-3">
            {config && !config.configured && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> Email sending is not configured yet
                </p>
                <p className="text-xs mt-1">
                  Review and save the message now — it is stored in Email Activity as a draft. Nothing goes out
                  until a provider API key and a verified sending domain are set up in Billing → Settings.
                </p>
              </div>
            )}

            {!to.trim() && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
                <p className="font-medium">No billing email on file for this account</p>
                <p className="text-xs mt-1 text-muted-foreground">
                  Add one under Billing → Settings → Customer billing preferences, or type a recipient below
                  for this send only.
                </p>
              </div>
            )}

            {instructions && (
              <div className="rounded-md bg-muted/50 p-3 text-xs">
                <span className="font-medium">Billing instructions: </span>{instructions}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="send_to">To (comma separated)</Label>
                <Input id="send_to" value={to} onChange={e => setTo(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="send_cc">CC</Label>
                <Input id="send_cc" value={cc} onChange={e => setCc(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="send_subject">Subject</Label>
              <Input id="send_subject" value={subject} onChange={e => setSubject(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="send_body">Message</Label>
              <Textarea id="send_body" rows={12} value={body} onChange={e => setBody(e.target.value)} />
            </div>

            <div className="flex items-center gap-2 rounded-md border p-2 text-sm">
              <Paperclip className="h-4 w-4 text-muted-foreground" />
              Invoice-{invoice.invoice_number}.pdf
              <span className="ml-auto text-xs text-muted-foreground">
                {money(invoice.total)} · due {invoice.due_date ?? '—'}
              </span>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>Cancel</Button>
          <Button onClick={send} disabled={sending || loading || !invoice}>
            {sending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
            {sending ? 'Sending…' : 'Send invoice'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SendInvoiceDialog;