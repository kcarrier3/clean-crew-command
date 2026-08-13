import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Loader2, Receipt, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { db } from './billingApi';

interface Props { companyId: string }

const csv = (v: string[] | undefined | null) => (v ?? []).join(', ');
const parseCsv = (s: string) => s.split(',').map(x => x.trim()).filter(Boolean);

/** Billing contact + delivery preferences, editable straight from the account. */
export const AccountBillingPreferencesCard = ({ companyId }: Props) => {
  const { toast } = useToast();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [prefs, setPrefs] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: user } = await supabase.auth.getUser();
      const { data: can } = await (supabase as any)
        .rpc('can_manage_billing', { _user_id: user?.user?.id });
      setAllowed(!!can);
      if (!can) return;
      const { data } = await db.from('billing_account_preferences')
        .select('*').eq('crm_company_id', companyId).maybeSingle();
      setPrefs(data ?? {
        crm_company_id: companyId, primary_billing_email: '', additional_recipients: [],
        cc_recipients: [], po_required: false, consolidated_invoicing: false,
        auto_send_allowed: false, default_terms: 'Net 30', delivery_method: 'email',
      });
    })();
  }, [companyId]);

  const save = async () => {
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
      default_terms: prefs.default_terms || 'Net 30',
    }, { onConflict: 'crm_company_id' });
    setSaving(false);
    toast(error
      ? { title: 'Error', description: error.message, variant: 'destructive' }
      : { title: 'Billing preferences saved' });
  };

  if (allowed === null) return <p className="text-sm text-muted-foreground">Loading billing preferences…</p>;
  if (!allowed) {
    return <p className="text-sm text-muted-foreground">You do not have permission to manage billing for this account.</p>;
  }
  if (!prefs) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Receipt className="h-4 w-4" /> Billing contact & invoice delivery
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ab_contact">Billing contact name</Label>
            <Input id="ab_contact" value={prefs.billing_contact_name ?? ''}
                   onChange={e => setPrefs((p: any) => ({ ...p, billing_contact_name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ab_email">Billing email</Label>
            <Input id="ab_email" type="email" value={prefs.primary_billing_email ?? ''}
                   onChange={e => setPrefs((p: any) => ({ ...p, primary_billing_email: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ab_cc">CC emails</Label>
            <Input id="ab_cc" value={csv(prefs.cc_recipients)}
                   onChange={e => setPrefs((p: any) => ({ ...p, cc_recipients: parseCsv(e.target.value) }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ab_phone">Billing phone</Label>
            <Input id="ab_phone" value={prefs.billing_phone ?? ''}
                   onChange={e => setPrefs((p: any) => ({ ...p, billing_phone: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ab_terms">Payment terms</Label>
            <Input id="ab_terms" value={prefs.default_terms ?? ''}
                   onChange={e => setPrefs((p: any) => ({ ...p, default_terms: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ab_po">Default PO number</Label>
            <Input id="ab_po" value={prefs.default_po_number ?? ''}
                   onChange={e => setPrefs((p: any) => ({ ...p, default_po_number: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ab_delivery">Invoice delivery method</Label>
            <select
              id="ab_delivery"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={prefs.delivery_method ?? 'email'}
              onChange={e => setPrefs((p: any) => ({ ...p, delivery_method: e.target.value }))}
            >
              <option value="email">Email</option>
              <option value="portal">Customer portal upload</option>
              <option value="mail">Postal mail</option>
              <option value="none">Do not send</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ab_reply">Reply-to email</Label>
            <Input id="ab_reply" value={prefs.reply_to_email ?? ''}
                   onChange={e => setPrefs((p: any) => ({ ...p, reply_to_email: e.target.value }))} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ab_notes">Special billing instructions</Label>
          <Textarea id="ab_notes" rows={3} value={prefs.special_instructions ?? ''}
                    onChange={e => setPrefs((p: any) => ({ ...p, special_instructions: e.target.value }))} />
        </div>

        <label className="flex items-center justify-between rounded-md border p-2 text-sm">
          <span>PO number required on invoices</span>
          <Switch checked={!!prefs.po_required}
                  onCheckedChange={v => setPrefs((p: any) => ({ ...p, po_required: v }))} />
        </label>

        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
          Save billing preferences
        </Button>
      </CardContent>
    </Card>
  );
};

export default AccountBillingPreferencesCard;