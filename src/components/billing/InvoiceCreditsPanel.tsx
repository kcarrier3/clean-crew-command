import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { money, type Invoice } from '@/lib/billing/types';
import {
  applyCustomerCredit, autoApplyCustomerCredits, fetchAvailableCredits,
  reverseCreditApplication, type CustomerCredit,
} from './creditsApi';
import type { InvoiceItem } from '@/lib/billing/types';

interface Props {
  invoice: Invoice;
  items: InvoiceItem[];
  onChanged: () => void;
}

export const InvoiceCreditsPanel = ({ invoice, items, onChanged }: Props) => {
  const { toast } = useToast();
  const [available, setAvailable] = useState<CustomerCredit[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const editable = invoice.status === 'draft' || invoice.status === 'ready';
  const creditLines = items.filter(i => i.line_type === 'credit');

  const load = () => {
    if (!editable) { setAvailable([]); return; }
    fetchAvailableCredits(invoice.crm_company_id, invoice.job_site_id)
      .then(setAvailable)
      .catch(() => setAvailable([]));
  };
  useEffect(() => { load(); }, [invoice.id, invoice.status, invoice.crm_company_id, invoice.job_site_id]);

  const run = async (title: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      toast({ title });
      onChanged();
      load();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Credit update failed';
      toast({ title: 'Credit update failed', description: message, variant: 'destructive' });
    }
  };

  return (
    <div className="rounded-md border p-3 space-y-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">Credits applied {money(invoice.credits_applied)}</p>
        {editable && (
          <Button size="sm" variant="outline" onClick={() => run('Available credits applied', () => autoApplyCustomerCredits(invoice.id))}>
            Apply available credits
          </Button>
        )}
      </div>
      {!creditLines.length && <p className="text-xs text-muted-foreground">No credits on this invoice.</p>}
      {creditLines.map(line => (
        <div key={line.id} className="flex items-center justify-between gap-2 text-xs">
          <span className="min-w-0 truncate">{line.description}</span>
          <span className="tabular-nums">{money(line.line_total)}</span>
          {editable && line.credit_application_id && (
            <Button size="sm" variant="ghost" className="h-7" onClick={() =>
              run('Credit removed', () => reverseCreditApplication(line.credit_application_id!, 'Removed from invoice'))
            }>Remove</Button>
          )}
        </div>
      ))}
      {editable && available.length > 0 && (
        <div className="space-y-1 pt-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Available for this customer</p>
          {available.map(c => (
            <div key={c.id} className="flex flex-wrap items-center gap-2">
              <span className="text-xs flex-1">{c.reason} · remaining {money(c.remaining_amount)}</span>
              <Input className="h-8 w-24" type="number" step="0.01" aria-label="Amount to apply"
                     value={amounts[c.id] ?? ''} placeholder={String(c.remaining_amount)}
                     onChange={e => setAmounts(a => ({ ...a, [c.id]: e.target.value }))} />
              <Button size="sm" variant="outline" className="h-8" onClick={() => run('Credit applied', () =>
                applyCustomerCredit(c.id, invoice.id, amounts[c.id] ? Number(amounts[c.id]) : null)
              )}>Apply</Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
