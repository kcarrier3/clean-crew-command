import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { recordPayment } from './billingApi';
import { money, PAYMENT_METHODS, type Invoice } from '@/lib/billing/types';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Optional pre-selected invoice; payments can also be entered standalone. */
  invoice: Invoice | null;
  onSaved?: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

export const RecordPaymentDialog = ({ open, onOpenChange, invoice, onSaved }: Props) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('check');
  const [reference, setReference] = useState('');
  const [depositDate, setDepositDate] = useState('');
  const [account, setAccount] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    setDate(today());
    setAmount(invoice ? String(Number(invoice.balance_due).toFixed(2)) : '');
    setMethod('check'); setReference(''); setDepositDate(''); setAccount(''); setNotes('');
  }, [open, invoice]);

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      toast({ title: 'Enter an amount', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await recordPayment({
        crm_company_id: invoice?.crm_company_id ?? null,
        payer_name: invoice?.customer_name ?? null,
        payment_date: date,
        amount: amt,
        method,
        reference_number: reference.trim() || null,
        deposit_date: depositDate || null,
        deposit_account_label: account.trim() || null,
        notes: notes.trim() || null,
      }, invoice ? [{ invoice_id: invoice.id, amount: Math.min(amt, Number(invoice.balance_due)) }] : []);
      toast({ title: 'Payment recorded', description: money(amt) });
      onOpenChange(false);
      onSaved?.();
    } catch (e: any) {
      toast({ title: 'Could not record payment', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record payment{invoice ? ` — ${invoice.invoice_number}` : ''}</DialogTitle>
        </DialogHeader>
        {invoice && (
          <p className="text-sm text-muted-foreground">
            Balance due {money(invoice.balance_due)} of {money(invoice.total)}. Partial payments are fine.
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pay_date">Payment date</Label>
            <Input id="pay_date" type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay_amount">Amount</Label>
            <Input id="pay_amount" type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay_method">Method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger id="pay_method"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay_ref">Check / reference #</Label>
            <Input id="pay_ref" value={reference} onChange={e => setReference(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay_dep">Deposit date</Label>
            <Input id="pay_dep" type="date" value={depositDate} onChange={e => setDepositDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay_acct">Deposit account</Label>
            <Input id="pay_acct" value={account} onChange={e => setAccount(e.target.value)} placeholder="Operating" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pay_notes">Notes</Label>
          <Textarea id="pay_notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Save payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RecordPaymentDialog;