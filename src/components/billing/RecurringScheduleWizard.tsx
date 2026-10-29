import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from './billingApi';
import { CrmLinkPicker } from './CrmLinkPicker';
import { saveRecurringSchedule, type ScheduleDraft } from './recurringApi';
import {
  FREQUENCIES, invoiceDateForPeriod, type RecurringFrequency, type RecurringLine, type RecurringScheduleStatus,
} from '@/lib/billing/recurring';
import { scheduleAmount } from '@/lib/billing/recurringPlan';
import { money } from '@/lib/billing/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobSiteId: string;
  jobSiteName: string;
  scheduleId?: string | null;
  onSaved?: () => void;
}

const TERMS = ['Due on receipt', 'Net 15', 'Net 30', 'Net 45', 'Net 60'];

const blankLine = (): RecurringLine => ({
  billing_item_id: null, description: 'Janitorial Services', quantity: 1, rate: 0, taxable: true,
});

/** Set up or edit one recurring schedule. Billing roles only; the caller hides it otherwise. */
export const RecurringScheduleWizard = ({ open, onOpenChange, jobSiteId, jobSiteName, scheduleId, onSaved }: Props) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<{ id: string; name: string; default_unit_price: number }[]>([]);
  const [tax, setTax] = useState<{ rate: number; jurisdiction: string | null; exempt: boolean; exempt_reason: string | null } | null>(null);
  const [companyLabel, setCompanyLabel] = useState<string | null>(null);
  const [f, setF] = useState<ScheduleDraft>({
    label: 'Monthly service',
    status: 'inactive',
    frequency: 'monthly',
    billing_day_rule: 'day_of_month',
    billing_day: 1,
    service_period: 'current',
    payment_terms: 'Net 30',
    po_number: null,
    po_required: false,
    billing_contact_name: null,
    billing_email: '',
    cc_recipients: [],
    reply_to_email: '',
    memo: '',
    start_date: null,
    consolidated: false,
    invoice_description: null,
    notes: null,
    crm_company_id: null,
    crm_deal_id: null,
    next_invoice_date: null,
    lines: [blankLine()],
  });

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      const [{ data: catalog }, siteRes, schedRes] = await Promise.all([
        db.from('billing_items').select('id, name, default_unit_price').eq('active', true).order('name'),
        db.from('job_sites').select('id, county, state, tax_exempt, tax_exemption_reason, crm_company_id').eq('id', jobSiteId).maybeSingle(),
        scheduleId
          ? db.from('recurring_billing_schedules').select('*').eq('id', scheduleId).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      setItems(catalog ?? []);
      const janitorial = (catalog ?? []).find((i: { name: string }) => i.name.toLowerCase() === 'janitorial services');
      let lines = [blankLine()];
      if (janitorial) lines = [{ ...blankLine(), billing_item_id: janitorial.id, description: janitorial.name, rate: Number(janitorial.default_unit_price || 0) }];
      if (schedRes.data) {
        const s = schedRes.data;
        const { data: existingLines } = await db.from('recurring_billing_lines').select('*').eq('schedule_id', s.id).order('sort_order');
        if (existingLines?.length) lines = existingLines;
        setF({
          id: s.id,
          label: s.label || 'Monthly service',
          status: s.status || (s.active ? 'active' : 'inactive'),
          frequency: s.frequency,
          billing_day_rule: s.billing_day_rule,
          billing_day: s.billing_day ?? 1,
          service_period: s.service_period,
          payment_terms: s.payment_terms ?? 'Net 30',
          po_number: s.po_number,
          po_required: !!s.po_required,
          billing_contact_name: s.billing_contact_name,
          billing_email: s.billing_email ?? '',
          cc_recipients: s.cc_recipients ?? [],
          reply_to_email: s.reply_to_email ?? '',
          memo: s.memo ?? '',
          start_date: s.start_date,
          consolidated: !!s.consolidated,
          invoice_description: s.invoice_description,
          notes: s.notes,
          crm_company_id: s.crm_company_id,
          crm_deal_id: s.crm_deal_id,
          next_invoice_date: s.next_invoice_date,
          lines,
        });
      } else {
        setF(prev => ({ ...prev, id: undefined, crm_company_id: siteRes.data?.crm_company_id ?? null, lines }));
      }
      const companyId = schedRes.data?.crm_company_id ?? siteRes.data?.crm_company_id ?? null;
      const { data: resolved } = await db.rpc('billing_resolve_tax', {
        _job_site_id: jobSiteId,
        _crm_company_id: companyId,
        _on: new Date().toISOString().slice(0, 10),
      });
      const row = Array.isArray(resolved) ? resolved[0] : resolved;
      setTax(row ? { rate: Number(row.rate || 0), jurisdiction: row.jurisdiction, exempt: !!row.exempt, exempt_reason: row.exempt_reason } : null);
      setLoading(false);
    })().catch((e: Error) => {
      toast({ title: 'Could not open billing setup', description: e.message, variant: 'destructive' });
      setLoading(false);
    });
  }, [open, jobSiteId, scheduleId]);

  const previewDate = invoiceDateForPeriod(new Date().toISOString().slice(0, 7) + '-01', f);

  const save = async () => {
    if (!f.label.trim()) {
      toast({ title: 'Add a schedule name', description: 'Use a label such as Clubhouse or Elevator cleaning.', variant: 'destructive' });
      return;
    }
    if (!f.lines.some(l => l.description.trim() && Number(l.rate) >= 0 && Number(l.quantity) > 0)) {
      toast({ title: 'Add at least one line', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await saveRecurringSchedule(jobSiteId, {
        ...f,
        billing_email: f.billing_email?.trim() || null,
        reply_to_email: (f.reply_to_email || '').trim() || null,
        memo: (f.memo || '').trim() || null,
        cc_recipients: (f.cc_recipients || []).map(e => e.trim()).filter(Boolean),
        lines: f.lines.filter(l => l.description.trim()),
      });
      toast({ title: f.status === 'active' ? 'Schedule saved and active' : 'Schedule saved' });
      onOpenChange(false);
      onSaved?.();
    } catch (e: any) {
      toast({ title: 'Could not save schedule', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Set up billing — {jobSiteName}</DialogTitle>
        </DialogHeader>
        {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Schedule name</Label>
                <Input value={f.label} onChange={e => setF({ ...f, label: e.target.value })} placeholder="Clubhouse" />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={f.status} onValueChange={v => setF({ ...f, status: v as RecurringScheduleStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="hold">Hold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Bill-to customer</Label>
                <CrmLinkPicker kind="company" value={f.crm_company_id} onChange={(id, label) => { setF({ ...f, crm_company_id: id }); setCompanyLabel(label); }} placeholder="Choose a company" />
                {companyLabel && <p className="text-xs text-muted-foreground">{companyLabel}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Billing email</Label>
                <Input value={f.billing_email ?? ''} onChange={e => setF({ ...f, billing_email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>CC</Label>
                <Input value={(f.cc_recipients || []).join(', ')} onChange={e => setF({ ...f, cc_recipients: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} placeholder="comma-separated" />
              </div>
              <div className="space-y-1.5">
                <Label>Reply-to</Label>
                <Input value={f.reply_to_email ?? ''} onChange={e => setF({ ...f, reply_to_email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Start date</Label>
                <Input type="date" value={f.start_date ?? ''} onChange={e => setF({ ...f, start_date: e.target.value || null })} />
              </div>
              <div className="space-y-1.5">
                <Label>Frequency</Label>
                <Select value={f.frequency} onValueChange={v => setF({ ...f, frequency: v as RecurringFrequency })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FREQUENCIES.map(x => <SelectItem key={x.value} value={x.value}>{x.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Billing day</Label>
                <Input type="number" min={1} max={28} value={f.billing_day} onChange={e => setF({ ...f, billing_day: Number(e.target.value) || 1 })} />
              </div>
              <div className="space-y-1.5">
                <Label>When to bill</Label>
                <Select value={f.service_period} onValueChange={v => setF({ ...f, service_period: v as 'current' | 'prior' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">Bill the current month</SelectItem>
                    <SelectItem value="prior">Bill in arrears (prior month)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Terms</Label>
                <Select value={f.payment_terms ?? 'Net 30'} onValueChange={v => setF({ ...f, payment_terms: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TERMS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 text-sm sm:mt-6">
                <Checkbox checked={f.po_required} onCheckedChange={v => setF({ ...f, po_required: !!v })} /> PO required
              </label>
              <div className="space-y-1.5">
                <Label>PO number</Label>
                <Input value={f.po_number ?? ''} onChange={e => setF({ ...f, po_number: e.target.value || null })} />
              </div>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <Checkbox checked={f.consolidated} onCheckedChange={v => setF({ ...f, consolidated: !!v })} />
                Combine with other sites billed to this customer into one invoice
              </label>
            </div>

            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <p>Next invoice date for this month’s service: {previewDate}</p>
              <p className="text-muted-foreground">
                Sales tax {tax?.exempt ? `exempt${tax.exempt_reason ? ` — ${tax.exempt_reason}` : ''}` : tax ? `${tax.rate}% ${tax.jurisdiction ?? ''}`.trim() : 'is calculated when the invoice is saved.'}
                {' '}The rate is not typed in here.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Lines</Label>
                <Button type="button" size="sm" variant="outline" onClick={() => setF({ ...f, lines: [...f.lines, blankLine()] })}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Line
                </Button>
              </div>
              {f.lines.map((l, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-12 items-end">
                  <div className="sm:col-span-4 space-y-1">
                    <Label className="text-xs">Item</Label>
                    <Select value={l.billing_item_id ?? 'none'} onValueChange={v => {
                      const item = items.find(it => it.id === v);
                      const next = [...f.lines];
                      next[i] = { ...l, billing_item_id: v === 'none' ? null : v, description: item?.name ?? l.description, rate: item ? Number(item.default_unit_price || l.rate) : l.rate };
                      setF({ ...f, lines: next });
                    }}>
                      <SelectTrigger><SelectValue placeholder="Item" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No catalog item</SelectItem>
                        {items.map(it => <SelectItem key={it.id} value={it.id}>{it.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-3 space-y-1">
                    <Label className="text-xs">Description</Label>
                    <Input value={l.description} onChange={e => { const next = [...f.lines]; next[i] = { ...l, description: e.target.value }; setF({ ...f, lines: next }); }} />
                  </div>
                  <div className="sm:col-span-1 space-y-1">
                    <Label className="text-xs">Qty</Label>
                    <Input type="number" value={l.quantity} onChange={e => { const next = [...f.lines]; next[i] = { ...l, quantity: Number(e.target.value) }; setF({ ...f, lines: next }); }} />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-xs">Rate</Label>
                    <Input type="number" step="0.01" value={l.rate} onChange={e => { const next = [...f.lines]; next[i] = { ...l, rate: Number(e.target.value) }; setF({ ...f, lines: next }); }} />
                  </div>
                  <label className="sm:col-span-1 flex items-center gap-1 text-xs pb-2">
                    <Checkbox checked={l.taxable !== false} onCheckedChange={v => { const next = [...f.lines]; next[i] = { ...l, taxable: !!v }; setF({ ...f, lines: next }); }} /> Tax
                  </label>
                  <Button type="button" size="icon" variant="ghost" className="sm:col-span-1" aria-label="Remove line" onClick={() => setF({ ...f, lines: f.lines.filter((_, j) => j !== i) })}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <p className="text-sm font-medium">Schedule total {money(scheduleAmount(f.lines))}</p>
            </div>

            <div className="space-y-1.5">
              <Label>Invoice memo</Label>
              <Textarea value={f.memo ?? ''} onChange={e => setF({ ...f, memo: e.target.value })} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || loading}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Save schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RecurringScheduleWizard;
