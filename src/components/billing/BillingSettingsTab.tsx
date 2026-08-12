import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Mail, Save, Settings2, Building2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from './billingApi';
import { EMAIL_TEMPLATE_VARIABLES, FUTURE_EMAIL_HOOKS, isEmailConfigured, getEmailProvider } from '@/lib/billing/emailService';

export const BillingSettingsTab = () => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [prefs, setPrefs] = useState<Record<string, any>>({});
  const [companyId, setCompanyId] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [{ data: t }, { data: c }] = await Promise.all([
      db.from('billing_email_templates').select('*').order('name'),
      db.from('crm_companies').select('id, name').order('name').limit(500),
    ]);
    setTemplates(t ?? []);
    setCompanies(c ?? []);
  };
  useEffect(() => { load(); }, []);

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
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Mail className="h-4 w-4" /> Email delivery</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span>Provider:</span>
            <Badge variant={isEmailConfigured() ? 'secondary' : 'destructive'}>
              {isEmailConfigured() ? getEmailProvider().name : 'Not configured'}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Billing talks to one provider-agnostic email service. Connect Resend, Postmark, SendGrid or SES later and
            sending turns on everywhere — invoices, reminders, statements, overdue notices, receipts and credit memos.
            Until then, messages can be drafted and previewed but never sent, and every attempt is stored for audit.
          </p>
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
                  <Label htmlFor="pref_terms">Default terms</Label>
                  <Input id="pref_terms" value={prefs.default_terms ?? ''}
                         onChange={e => setPrefs(p => ({ ...p, default_terms: e.target.value }))} />
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