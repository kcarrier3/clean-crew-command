import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Camera, Loader2, Upload, AlertTriangle, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { db, recordPayment } from './billingApi';
import { money } from '@/lib/billing/types';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved?: () => void;
}

type StubLine = {
  raw: string;
  amount: string;
  invoice: { id: string; invoice_number: string; balance_due: number; customer_name: string | null; crm_company_id: string | null } | null;
};

const today = () => new Date().toISOString().slice(0, 10);

/** Loose comparison so "INV-1042", "inv1042" and "1042" all match the same invoice. */
const normalize = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^0+/, '');

async function toDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const max = 1800;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85);
}

export const ScanCheckDialog = ({ open, onOpenChange, onSaved }: Props) => {
  const { toast } = useToast();
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scanned, setScanned] = useState(false);

  const [payer, setPayer] = useState('');
  const [checkNumber, setCheckNumber] = useState('');
  const [receivedDate, setReceivedDate] = useState(today());
  const [depositDate, setDepositDate] = useState(today());
  const [amount, setAmount] = useState('');
  const [depositAccount, setDepositAccount] = useState('');
  const [lines, setLines] = useState<StubLine[]>([]);

  const reset = () => {
    setScanned(false); setPayer(''); setCheckNumber('');
    setReceivedDate(today()); setDepositDate(today());
    setAmount(''); setDepositAccount(''); setLines([]);
  };

  const close = (o: boolean) => { if (!o) reset(); onOpenChange(o); };

  const scan = async (file: File) => {
    setScanning(true);
    try {
      const image = await toDataUrl(file);
      const { data, error } = await supabase.functions.invoke('scan-check-stub', { body: { image } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const res = data as {
        payer_name: string; check_number: string; check_date: string; amount: string;
        invoices: { invoice_number: string; amount: string }[];
      };

      setPayer(res.payer_name || '');
      setCheckNumber(res.check_number || '');
      setAmount(res.amount || '');
      // Receipt day defaults to today; deposit day follows it unless the user changes it.
      setReceivedDate(today());
      setDepositDate(today());

      const { data: invoices } = await db
        .from('billing_invoices')
        .select('id, invoice_number, balance_due, customer_name, crm_company_id, status')
        .neq('status', 'void');

      const byNumber = new Map<string, any>();
      (invoices ?? []).forEach(inv => byNumber.set(normalize(inv.invoice_number ?? ''), inv));

      const matched: StubLine[] = (res.invoices ?? []).map(i => {
        const hit = byNumber.get(normalize(i.invoice_number));
        return {
          raw: i.invoice_number,
          amount: i.amount || (hit ? String(Number(hit.balance_due).toFixed(2)) : ''),
          invoice: hit ? {
            id: hit.id, invoice_number: hit.invoice_number,
            balance_due: Number(hit.balance_due), customer_name: hit.customer_name,
            crm_company_id: hit.crm_company_id,
          } : null,
        };
      });
      setLines(matched);
      setScanned(true);

      const unmatched = matched.filter(l => !l.invoice).length;
      toast({
        title: 'Check read',
        description: matched.length
          ? `${matched.length - unmatched} of ${matched.length} invoice numbers matched.`
          : 'No invoice numbers found on the stub — apply the payment manually.',
      });
    } catch (e: any) {
      toast({ title: 'Could not read the check', description: e.message, variant: 'destructive' });
    } finally {
      setScanning(false);
    }
  };

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) scan(file);
  };

  const setLineAmount = (idx: number, value: string) =>
    setLines(prev => prev.map((l, i) => (i === idx ? { ...l, amount: value } : l)));

  const allocated = lines.reduce((s, l) => s + (l.invoice ? Number(l.amount || 0) : 0), 0);
  const total = Number(amount || 0);
  const remainder = total - allocated;

  const save = async () => {
    if (!total || total <= 0) {
      toast({ title: 'Enter the check amount', variant: 'destructive' });
      return;
    }
    if (allocated - total > 0.005) {
      toast({ title: 'Applied amount exceeds the check', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const allocations = lines
        .filter(l => l.invoice && Number(l.amount || 0) > 0)
        .map(l => ({ invoice_id: l.invoice!.id, amount: Number(l.amount) }));

      await recordPayment({
        crm_company_id: lines.find(l => l.invoice?.crm_company_id)?.invoice?.crm_company_id ?? null,
        payer_name: payer.trim() || lines.find(l => l.invoice?.customer_name)?.invoice?.customer_name || null,
        payment_date: receivedDate,
        amount: total,
        method: 'check',
        reference_number: checkNumber.trim() || null,
        deposit_date: depositDate || null,
        deposit_account_label: depositAccount.trim() || null,
        notes: 'Recorded from a scanned check stub',
      }, allocations);

      toast({ title: 'Payment recorded', description: `${money(total)} applied to ${allocations.length} invoice(s).` });
      close(false);
      onSaved?.();
    } catch (e: any) {
      toast({ title: 'Could not record payment', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Scan a check</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Photograph the check and its remittance stub. Invoice numbers on the stub are matched automatically.
        </p>

        <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} />
        <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={pick} />

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" disabled={scanning} onClick={() => cameraInput.current?.click()}>
            {scanning ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Camera className="h-4 w-4 mr-1" />}
            Take photo
          </Button>
          <Button variant="outline" className="flex-1" disabled={scanning} onClick={() => fileInput.current?.click()}>
            <Upload className="h-4 w-4 mr-1" /> Upload image
          </Button>
        </div>

        {scanned && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="chk_payer">Payer</Label>
                <Input id="chk_payer" value={payer} onChange={e => setPayer(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="chk_num">Check #</Label>
                <Input id="chk_num" value={checkNumber} onChange={e => setCheckNumber(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="chk_amt">Check amount</Label>
                <Input id="chk_amt" type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="chk_recv">Date received</Label>
                <Input
                  id="chk_recv" type="date" value={receivedDate}
                  onChange={e => {
                    // Deposit tracks receipt until it is set independently.
                    if (depositDate === receivedDate) setDepositDate(e.target.value);
                    setReceivedDate(e.target.value);
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="chk_dep">Deposit date</Label>
                <Input id="chk_dep" type="date" value={depositDate} onChange={e => setDepositDate(e.target.value)} />
                <p className="text-xs text-muted-foreground">Defaults to the day of receipt — change it if it was deposited later.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="chk_acct">Deposit account</Label>
                <Input id="chk_acct" value={depositAccount} onChange={e => setDepositAccount(e.target.value)} placeholder="Operating" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Invoices on the stub</Label>
              {!lines.length && (
                <p className="text-sm text-muted-foreground rounded-md border border-dashed p-4">
                  No invoice numbers were found. Save the check and apply it from the invoice later.
                </p>
              )}
              {lines.map((l, idx) => (
                <div key={`${l.raw}-${idx}`} className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{l.invoice?.invoice_number ?? l.raw}</span>
                      {l.invoice ? (
                        <Badge variant="secondary" className="gap-1"><Check className="h-3 w-3" /> Matched</Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-900 gap-1"><AlertTriangle className="h-3 w-3" /> Not found</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {l.invoice
                        ? `${l.invoice.customer_name ?? 'Customer'} · balance ${money(l.invoice.balance_due)}`
                        : 'No open invoice with this number'}
                    </p>
                  </div>
                  <Input
                    className="w-32" type="number" step="0.01" value={l.amount}
                    disabled={!l.invoice}
                    onChange={e => setLineAmount(idx, e.target.value)}
                    aria-label={`Amount applied to ${l.invoice?.invoice_number ?? l.raw}`}
                  />
                </div>
              ))}
              {!!lines.length && (
                <p className="text-xs text-muted-foreground">
                  Applied {money(allocated)} of {money(total)}
                  {Math.abs(remainder) > 0.005 && ` · ${remainder > 0 ? `${money(remainder)} unapplied` : 'over-applied'}`}
                </p>
              )}
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>Cancel</Button>
          <Button onClick={save} disabled={!scanned || saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Save payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ScanCheckDialog;
