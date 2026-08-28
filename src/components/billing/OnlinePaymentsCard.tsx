import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  DEFAULT_ONLINE_PAYMENT_CONFIG, PROCESSOR_LABEL, fetchOnlinePaymentConfig,
  isCollectionReady, saveOnlinePaymentConfig,
  type OnlinePaymentConfig, type PaymentProcessor,
} from '@/lib/billing/onlinePayments';

/** Settings for collecting invoice payments online, ready for a processor. */
export const OnlinePaymentsCard = () => {
  const { toast } = useToast();
  const [cfg, setCfg] = useState<OnlinePaymentConfig>(DEFAULT_ONLINE_PAYMENT_CONFIG);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchOnlinePaymentConfig().then(setCfg).catch(() => {}); }, []);

  const set = <K extends keyof OnlinePaymentConfig>(k: K, v: OnlinePaymentConfig[K]) =>
    setCfg(c => ({ ...c, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await saveOnlinePaymentConfig(cfg);
      toast({ title: 'Online payment settings saved' });
    } catch (e: any) {
      toast({ title: 'Could not save', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const ready = isCollectionReady(cfg);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CreditCard className="h-4 w-4" /> Online payment collection
          <Badge variant={ready ? 'secondary' : 'outline'}>
            {ready ? 'Pay links active' : 'Processor not connected'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          This is the plumbing for customer self-service payments. Invoices can carry a pay link, and each
          invoice tracks whether it was paid online. Connect a card processor when you are ready — nothing
          here charges a card on its own, and no processor keys are stored in the browser.
        </p>

        <label className="flex items-center justify-between rounded-md border p-2">
          <span>Offer online payment on invoices</span>
          <Switch checked={cfg.enabled} onCheckedChange={v => set('enabled', v)} />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="op_processor">Card processor</Label>
            <select
              id="op_processor"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={cfg.processor}
              onChange={e => set('processor', e.target.value as PaymentProcessor)}
            >
              {(Object.keys(PROCESSOR_LABEL) as PaymentProcessor[]).map(p => (
                <option key={p} value={p}>{PROCESSOR_LABEL[p]}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="op_url">Checkout / pay page base URL</Label>
            <Input id="op_url" placeholder="https://pay.summitfacilitiesgroup.com/invoice"
                   value={cfg.checkout_base_url}
                   onChange={e => set('checkout_base_url', e.target.value)} />
            <p className="text-xs text-muted-foreground">
              The invoice number, balance and reference are appended automatically.
            </p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <label className="flex items-center justify-between rounded-md border p-2">
            <span>Accept cards</span>
            <Switch checked={cfg.accept_card} onCheckedChange={v => set('accept_card', v)} />
          </label>
          <label className="flex items-center justify-between rounded-md border p-2">
            <span>Accept ACH</span>
            <Switch checked={cfg.accept_ach} onCheckedChange={v => set('accept_ach', v)} />
          </label>
          <div className="space-y-1.5">
            <Label htmlFor="op_fee">Convenience fee shown (%)</Label>
            <Input id="op_fee" type="number" min={0} step="0.1" value={cfg.surcharge_percent}
                   onChange={e => set('surcharge_percent', Number(e.target.value) || 0)} />
          </div>
        </div>

        <label className="flex items-center justify-between rounded-md border p-2">
          <span>Turn online payment on for every new invoice</span>
          <Switch checked={cfg.default_on_new_invoices}
                  onCheckedChange={v => set('default_on_new_invoices', v)} />
        </label>

        <div className="space-y-1.5">
          <Label htmlFor="op_note">Line shown to the customer</Label>
          <Input id="op_note" value={cfg.instructions} onChange={e => set('instructions', e.target.value)} />
        </div>

        <Button size="sm" onClick={save} disabled={saving}>
          <Save className="h-4 w-4 mr-1" /> {saving ? 'Saving…' : 'Save payment settings'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default OnlinePaymentsCard;
