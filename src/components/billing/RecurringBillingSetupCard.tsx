import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, Repeat } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { db } from './billingApi';
import { CrmLinkPicker } from './CrmLinkPicker';
import { saveRecurringSchedule } from './recurringApi';
import {
  FREQUENCIES, currentPeriodStart, invoiceDateForPeriod, periodLabel,
  type RecurringFrequency,
} from '@/lib/billing/recurring';
import { money } from '@/lib/billing/types';

interface Props { jobSiteId: string; jobSiteName: string }

const TERMS = ['Due on receipt', 'Net 15', 'Net 30', 'Net 45', 'Net 60'];

/** Recurring janitorial billing schedule for a monthly account. */
export const RecurringBillingSetupCard = ({ jobSiteId, jobSiteName }: Props) => {
  const { isManager } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    active: true,
    amount: '',
    frequency: 'monthly' as RecurringFrequency,
    billing_day_rule: 'day_of_month' as 'day_of_month' | 'last_day',
    billing_day: 1,
    service_period: 'current' as 'current' | 'prior',
    payment_terms: 'Net 30',
    po_number: '',
    po_required: false,
    billing_contact_name: '',
    billing_email: '',
    tax_rate: '0',
    invoice_description: 'Janitorial Services — {{period}}',
    notes: '',
    crm_company_id: null as string | null,
    crm_deal_id: null as string | null,
  });

  const load = async () => {
    setLoading(true);
    const { data } = await db.from('recurring_billing_schedules')
      .select('*').eq('job_site_id', jobSiteId).maybeSingle();
    if (data) {
      setF({
        active: data.active,
        amount: data.amount == null ? '' : String(data.amount),
        frequency: data.frequency,
        billing_day_rule: data.billing_day_rule,
        billing_day: data.billing_day ?? 1,
        service_period: data.service_period,
        payment_terms: data.payment_terms ?? 'Net 30',
        po_number: data.po_number ?? '',
        po_required: data.po_required,
        billing_contact_name: data.billing_contact_name ?? '',
        billing_email: data.billing_email ?? '',
        tax_rate: String(data.tax_rate ?? 0),
        invoice_description: data.invoice_description ?? 'Janitorial Services — {{period}}',
        notes: data.notes ?? '',
        crm_company_id: data.crm_company_id,
        crm_deal_id: data.crm_deal_id,
      });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [jobSiteId]);

  const period = currentPeriodStart();
  const nextInvoiceDate = invoiceDateForPeriod(period, f);

  const save = async () => {
    setSaving(true);
    try {
      await saveRecurringSchedule(jobSiteId, {
        active: f.active,
        amount: Number(f.amount || 0),
        frequency: f.frequency,
        billing_day_rule: f.billing_day_rule,
        billing_day: Number(f.billing_day) || 1,
        service_period: f.service_period,
        payment_terms: f.payment_terms || null,
        po_number: f.po_number || null,
        po_required: f.po_required,
        billing_contact_name: f.billing_contact_name || null,
        billing_email: f.billing_email || null,
        tax_rate: Number(f.tax_rate || 0),
        invoice_description: f.invoice_description || null,
        notes: f.notes || null,
        crm_company_id: f.crm_company_id,
        crm_deal_id: f.crm_deal_id,
        next_invoice_date: nextInvoiceDate,
      } as any);
      toast({ title: 'Recurring billing saved' });
      load();
    } catch (e: any) {
      toast({ title: 'Could not save', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!isManager() || loading) return null;

  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm flex items-center gap-2">
          <Repeat className="h-4 w-4" /> Recurring Billing
        </CardTitle>
        <label className="flex items-center gap-2 text-xs">
          <Switch checked={f.active} onCheckedChange={v => setF(s => ({ ...s, active: v }))} />
          {f.active ? 'Active' : 'Inactive'}
        </label>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="rb_amount">Recurring amount ($ per invoice)</Label>
            <Input id="rb_amount" type="number" step="0.01" value={f.amount}
                   onChange={e => setF(s => ({ ...s, amount: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Frequency</Label>
            <Select value={f.frequency} onValueChange={v => setF(s => ({ ...s, frequency: v as RecurringFrequency }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FREQUENCIES.map(x => <SelectItem key={x.value} value={x.value}>{x.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Invoice date rule</Label>
            <Select value={f.billing_day_rule}
                    onValueChange={v => setF(s => ({ ...s, billing_day_rule: v as any }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="day_of_month">Specific day of month</SelectItem>
                <SelectItem value="last_day">Last day of month</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rb_day">Billing day (1–28)</Label>
            <Input id="rb_day" type="number" min={1} max={28} disabled={f.billing_day_rule === 'last_day'}
                   value={f.billing_day}
                   onChange={e => setF(s => ({ ...s, billing_day: Number(e.target.value) || 1 }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Service period billed</Label>
            <Select value={f.service_period} onValueChange={v => setF(s => ({ ...s, service_period: v as any }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Current month (bill in the month of service)</SelectItem>
                <SelectItem value="prior">Prior month (bill in arrears)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Payment terms</Label>
            <Select value={f.payment_terms} onValueChange={v => setF(s => ({ ...s, payment_terms: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TERMS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rb_po">PO number</Label>
            <Input id="rb_po" value={f.po_number} onChange={e => setF(s => ({ ...s, po_number: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="block">PO required on invoices</Label>
            <label className="flex h-10 items-center gap-2 text-sm">
              <Switch checked={f.po_required} onCheckedChange={v => setF(s => ({ ...s, po_required: v }))} />
              {f.po_required ? 'Required — blocks generation without a PO' : 'Not required'}
            </label>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rb_contact">Billing contact</Label>
            <Input id="rb_contact" value={f.billing_contact_name}
                   onChange={e => setF(s => ({ ...s, billing_contact_name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rb_email">Billing email</Label>
            <Input id="rb_email" type="email" value={f.billing_email}
                   onChange={e => setF(s => ({ ...s, billing_email: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rb_tax">Tax rate (%)</Label>
            <Input id="rb_tax" type="number" step="0.01" value={f.tax_rate}
                   onChange={e => setF(s => ({ ...s, tax_rate: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rb_desc">Invoice line description</Label>
            <Input id="rb_desc" value={f.invoice_description}
                   onChange={e => setF(s => ({ ...s, invoice_description: e.target.value }))} />
            <p className="text-xs text-muted-foreground">
              Preview: {f.invoice_description.replace('{{period}}', periodLabel(period, f.frequency))
                .replace('{{account}}', jobSiteName)}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Waypoint account</Label>
            <CrmLinkPicker kind="company" value={f.crm_company_id}
                           onChange={id => setF(s => ({ ...s, crm_company_id: id }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Waypoint opportunity</Label>
            <CrmLinkPicker kind="deal" value={f.crm_deal_id} companyId={f.crm_company_id}
                           onChange={id => setF(s => ({ ...s, crm_deal_id: id }))} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="rb_notes">Internal notes</Label>
            <Textarea id="rb_notes" rows={2} value={f.notes}
                      onChange={e => setF(s => ({ ...s, notes: e.target.value }))} />
          </div>
        </div>

        <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
          Next invoice for {periodLabel(period, f.frequency)} would be dated {nextInvoiceDate} for{' '}
          {money(Number(f.amount || 0))}. Invoices are never created automatically — office staff review and
          generate them from Billing → Recurring Invoicing.
        </div>

        <div className="flex justify-end">
          <Button size="sm" onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Save recurring billing
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default RecurringBillingSetupCard;
