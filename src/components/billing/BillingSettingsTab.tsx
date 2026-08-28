import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Mail, Save, Settings2, Building2, RefreshCw, ScanLine } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from './billingApi';
import { TaxRatesCard } from './TaxRatesCard';
import { OnlinePaymentsCard } from './OnlinePaymentsCard';
import {
  AUTO_CONFIDENCE_THRESHOLD, fetchAutoApplyEnabled, setAutoApplyEnabled,
} from '@/lib/billing/checkIntake';
import {
  EMAIL_TEMPLATE_VARIABLES, FUTURE_EMAIL_HOOKS, fetchEmailConfig, type EmailConfig,
} from '@/lib/billing/emailService';

export const BillingSettingsTab = () => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [prefs, setPrefs] = useState<Record<string, any>>({});
  const [companyId, setCompanyId] = useState('');
  const [saving, setSaving] = useState(false);
  const [emailConfig, setEmailConfig] = useState<EmailConfig | null>(null);
  const [autoApply, setAutoApply] = useState(true);

  const load = async () => {
    const [{ data: t }, { data: c }] = await Promise.all([
      db.from('billing_email_templates').select('*').order('name'),
      db.from('crm_companies').select('id, name').order('name').limit(500),
    ]);
    setTemplates(t ?? []);
    setCompanies(c ?? []);
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { fetchEmailConfig(true).then(setEmailConfig); }, []);
  useEffect(() => { fetchAutoApplyEnabled().then(setAutoApply).catch(() => setAutoApply(true)); }, []);

  const toggleAutoApply = async (v: boolean) => {
    setAutoApply(v);
    try { await setAutoApplyEnabled(v); toast({ title: v ? 'Automatic check posting is on' : 'Automatic check posting is off' }); }
    catch (e: any) { setAutoApply(!v); toast({ title: 'Could not save the setting', description: e.message, variant: 'destructive' }); }
  };

  const loadPrefs = async (id: string) => {
    setCompanyId(id);
    if (!id) return;
    const { data } = await db.from('billing_account_preferences')
      .select('*').eq('crm_company_id', id).maybeSingle();
    setPrefs(data ?? {
      crm_company_id: id, primary_billing_email: '', additional_recipients: [], cc_recipients: [],
      po_required: false, consolidated_invoicing: false, auto_send_allowed: false, default_terms: 'Net 30',
    });
  };

  const savePrefs = async () => {
    if (!companyId) return;
    setSaving(true);
    const { error } = await db.from('billing_account_preferences').upsert({
      crm_company_id: companyId,
      primary_billing_email: prefs.primary_billing_email || null,
      billing_contact_name: prefs.billing_contact_name || null,
      billing_phone: prefs.billing_phone || null,
      default_po_number: prefs.default_po_number || null,
      delivery_method: prefs.delivery_method || 'email',
      reply_to_email: prefs.reply_to_email || null,
      special_instructions: prefs.special_instructions || null,
      additional_recipients: prefs.additional_recipients ?? [],
      cc_recipients: prefs.cc_recipients ?? [],
      po_required: !!prefs.po_required,
      consolidated_invoicing: !!prefs.consolidated_invoicing,
      auto_send_allowed: !!prefs.auto_send_allowed,
      default_terms: prefs.default_terms || 'Net 30',
      notes: prefs.notes || null,
    }, { onConflict: 'crm_company_id' });
    setSaving(false);
    toast(error
      ? { title: 'Error', description: error.message, variant: 'destructive' }
      : { title: 'Billing preferences saved' });
  };

  const saveTemplate = async (t: any) => {
    const { error } = await db.from('billing_email_templates')
      .update({ subject: t.subject, body: t.body, name: t.name }).eq('id', t.id);
    toast(error
      ? { title: 'Error', description: error.message, variant: 'destructive' }
      : { title: 'Template saved' });
  };

  const csv = (v: string[] | undefined) => (v ?? []).join(', ');
  const parseCsv = (s: string) => s.split(',').map(x => x.trim()).filter(Boolean);

  return (
    <div className="space-y-4">
      <OnlinePaymentsCard />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><ScanLine className="h-4 w-4" /> Scanned check posting</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <label className="flex items-center justify-between rounded-md border p-2">
            <span>Automatically apply high-confidence scanned checks</span>
            <Switch checked={autoApply} onCheckedChange={toggleAutoApply} />
          </label>
          <p className="text-muted-foreground">
            A check posts on its own only when the amount, check number and every stub invoice number are read with
            at least {Math.round(AUTO_CONFIDENCE_THRESHOLD * 100)}% confidence, all invoices match open balances, the
            payer agrees with the invoice customer and the applications reconcile to the check total to the exact cent.
            Duplicates, overpayments, unapplied cash, ambiguous partials and any scan warning always go to
            <strong> Checks needing review</strong> in Payments. The threshold is fixed to keep posting safe.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Mail className="h-4 w-4" /> Email delivery</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span>Provider:</span>
            <Badge variant={emailConfig?.configured ? 'secondary' : 'destructive'}>
              {emailConfig?.configured ? emailConfig.provider : 'Not configured'}
            </Badge>
          </div>
          <div className="grid gap-1 sm:grid-cols-2">
            <p><span className="text-muted-foreground">Sender:</span> {emailConfig?.from ?? 'billing@summitfacilitiesgroup.com'}</p>
            <p><span className="text-muted-foreground">Reply-to:</span> {emailConfig?.reply_to ?? 'Uses the sender address'}</p>
          </div>
          <p className="text-muted-foreground">
            Invoice emails are sent server-side through the <code>send-invoice-email</code> function, so no API key
            ever reaches the browser. Every attempt is logged in Email Activity, and an invoice is only marked sent
            once the provider accepts the message.
          </p>
          {!emailConfig?.configured && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
              <p className="font-medium">One-time setup still needed</p>
              <ul className="mt-1 list-disc pl-5 text-xs space-y-0.5">
                <li>Verify the sending domain (summitfacilitiesgroup.com) with Resend.</li>
                <li>Add the <code>RESEND_API_KEY</code> secret.</li>
                <li>Optional: <code>BILLING_FROM_EMAIL</code> and <code>BILLING_REPLY_TO_EMAIL</code> to override the sender and reply-to.</li>
                <li>For delivery tracking, point a Resend webhook at the <code>resend-webhook</code> function and add <code>RESEND_WEBHOOK_SECRET</code>.</li>
              </ul>
              <p className="text-xs mt-1">
                Until then messages can be composed and reviewed — they are stored as drafts and never sent.
              </p>
            </div>
          )}
          <div className="flex flex-wrap gap-1">
            {FUTURE_EMAIL_HOOKS.map(h => (
              <Badge key={h} variant="outline" className="capitalize">{h.replace(/_/g, ' ')} — planned</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Settings2 className="h-4 w-4" /> Email templates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {templates.map((t, idx) => (
            <div key={t.id} className="space-y-2 rounded-md border p-3">
              <div className="space-y-1.5">
                <Label htmlFor={`tpl_sub_${t.id}`}>{t.name} — subject</Label>
                <Input id={`tpl_sub_${t.id}`} value={t.subject}
                       onChange={e => setTemplates(ts => ts.map((x, i) => i === idx ? { ...x, subject: e.target.value } : x))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`tpl_body_${t.id}`}>Body</Label>
                <Textarea id={`tpl_body_${t.id}`} rows={6} value={t.body}
                          onChange={e => setTemplates(ts => ts.map((x, i) => i === idx ? { ...x, body: e.target.value } : x))} />
                <p className="text-xs text-muted-foreground">Variables: {EMAIL_TEMPLATE_VARIABLES.join(' ')}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => saveTemplate(t)}>
                <Save className="h-4 w-4 mr-1" /> Save template
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Customer billing preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="pref_company">Account</Label>
            <select
              id="pref_company"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={companyId}
              onChange={e => loadPrefs(e.target.value)}
            >
              <option value="">Select an account…</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {companyId && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="pref_email">Primary billing email</Label>
                  <Input id="pref_email" value={prefs.primary_billing_email ?? ''}
                         onChange={e => setPrefs(p => ({ ...p, primary_billing_email: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pref_contact">Billing contact name</Label>
                  <Input id="pref_contact" value={prefs.billing_contact_name ?? ''}
                         onChange={e => setPrefs(p => ({ ...p, billing_contact_name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pref_phone">Billing phone</Label>
                  <Input id="pref_phone" value={prefs.billing_phone ?? ''}
                         onChange={e => setPrefs(p => ({ ...p, billing_phone: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pref_terms">Default terms</Label>
                  <Input id="pref_terms" value={prefs.default_terms ?? ''}
                         onChange={e => setPrefs(p => ({ ...p, default_terms: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pref_po">Default PO number</Label>
                  <Input id="pref_po" value={prefs.default_po_number ?? ''}
                         onChange={e => setPrefs(p => ({ ...p, default_po_number: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pref_delivery">Invoice delivery method</Label>
                  <select
                    id="pref_delivery"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={prefs.delivery_method ?? 'email'}
                    onChange={e => setPrefs(p => ({ ...p, delivery_method: e.target.value }))}
                  >
                    <option value="email">Email</option>
                    <option value="portal">Customer portal upload</option>
                    <option value="mail">Postal mail</option>
                    <option value="none">Do not send</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pref_reply">Reply-to for this account</Label>
                  <Input id="pref_reply" value={prefs.reply_to_email ?? ''}
                         onChange={e => setPrefs(p => ({ ...p, reply_to_email: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pref_more">Additional recipients</Label>
                  <Input id="pref_more" value={csv(prefs.additional_recipients)}
                         onChange={e => setPrefs(p => ({ ...p, additional_recipients: parseCsv(e.target.value) }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pref_cc">CC recipients</Label>
                  <Input id="pref_cc" value={csv(prefs.cc_recipients)}
                         onChange={e => setPrefs(p => ({ ...p, cc_recipients: parseCsv(e.target.value) }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pref_instructions">Special billing instructions</Label>
                <Textarea id="pref_instructions" rows={3} value={prefs.special_instructions ?? ''}
                          onChange={e => setPrefs(p => ({ ...p, special_instructions: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="flex items-center justify-between rounded-md border p-2 text-sm">
                  <span>PO number required on invoices</span>
                  <Switch checked={!!prefs.po_required}
                          onCheckedChange={v => setPrefs(p => ({ ...p, po_required: v }))} />
                </label>
                <label className="flex items-center justify-between rounded-md border p-2 text-sm">
                  <span>Consolidate multiple jobs onto one invoice</span>
                  <Switch checked={!!prefs.consolidated_invoicing}
                          onCheckedChange={v => setPrefs(p => ({ ...p, consolidated_invoicing: v }))} />
                </label>
                <label className="flex items-center justify-between rounded-md border p-2 text-sm">
                  <span>Allow automatic sending (when a provider is connected)</span>
                  <Switch checked={!!prefs.auto_send_allowed}
                          onCheckedChange={v => setPrefs(p => ({ ...p, auto_send_allowed: v }))} />
                </label>
              </div>
              <Button size="sm" onClick={savePrefs} disabled={saving}>
                <Save className="h-4 w-4 mr-1" /> Save preferences
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <TaxRatesCard />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><RefreshCw className="h-4 w-4" /> QuickBooks</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          QuickBooks stays the accounting ledger. Invoices and payments already carry external ID, sync status,
          synced timestamp and error fields, so a monthly export or live sync can be switched on later without
          reworking Billing. Crew Compass remains the operational source of truth for invoice and payment status.
        </CardContent>
      </Card>
    </div>
  );
};

export default BillingSettingsTab;