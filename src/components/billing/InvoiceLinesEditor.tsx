import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db, type BillingItem } from './billingApi';
import { BillingItemPicker } from './BillingItemPicker';
import { money, type InvoiceItem } from '@/lib/billing/types';

interface Props {
  invoiceId: string;
  editable: boolean;
  items: InvoiceItem[];
  onChanged: () => void;
}

export const InvoiceLinesEditor = ({ invoiceId, editable, items, onChanged }: Props) => {
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ description: '', quantity: '1', unit_price: '0', taxable: true, billing_item_id: null as string | null });

  const saveLine = async (id: string, patch: Record<string, unknown>) => {
    const { error } = await db.from('billing_invoice_items').update(patch).eq('id', id);
    if (error) {
      toast({ title: 'Could not update line', description: error.message, variant: 'destructive' });
      return;
    }
    onChanged();
  };

  const removeLine = async (id: string) => {
    const { error } = await db.from('billing_invoice_items').delete().eq('id', id);
    if (error) {
      toast({ title: 'Could not remove line', description: error.message, variant: 'destructive' });
      return;
    }
    onChanged();
  };

  const addLine = async () => {
    if (!draft.billing_item_id || !draft.description.trim()) {
      toast({ title: 'Pick an item and a description', variant: 'destructive' });
      return;
    }
    const { error } = await db.from('billing_invoice_items').insert({
      invoice_id: invoiceId,
      billing_item_id: draft.billing_item_id,
      description: draft.description.trim(),
      quantity: Number(draft.quantity) || 1,
      unit_price: Number(draft.unit_price) || 0,
      taxable: draft.taxable,
      line_type: 'charge',
      sort_order: items.length,
    });
    if (error) {
      toast({ title: 'Could not add line', description: error.message, variant: 'destructive' });
      return;
    }
    setAdding(false);
    setDraft({ description: '', quantity: '1', unit_price: '0', taxable: true, billing_item_id: null });
    onChanged();
  };

  const pickNew = (item: BillingItem | null) => {
    if (!item) return;
    setDraft(d => ({
      ...d,
      billing_item_id: item.id,
      description: item.name,
      unit_price: String(item.default_unit_price ?? 0),
      taxable: item.taxable !== false,
    }));
  };

  return (
    <div className="rounded-md border">
      <div className="grid grid-cols-12 gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span className="col-span-5">Item</span>
        <span className="col-span-1 text-right">Qty</span>
        <span className="col-span-2 text-right">Price</span>
        <span className="col-span-2 text-center">Taxable</span>
        <span className="col-span-2 text-right">Amount</span>
      </div>
      {items.map(i => {
        const credit = i.line_type === 'credit';
        return (
          <div key={i.id} className="grid grid-cols-12 gap-2 px-3 py-2 text-sm border-b last:border-0 items-center">
            <div className="col-span-5 min-w-0">
              {i.item?.name && <p className="text-xs text-muted-foreground truncate">{i.item.name}{i.item.sku ? ` · ${i.item.sku}` : ''}</p>}
              {editable && !credit ? (
                <Input className="h-8" defaultValue={i.description} key={`${i.id}-${i.description}`}
                       onBlur={e => { if (e.target.value !== i.description) saveLine(i.id, { description: e.target.value }); }} />
              ) : <span>{i.description}</span>}
            </div>
            <div className="col-span-1">
              {editable && !credit ? (
                <Input className="h-8 text-right" type="number" defaultValue={Number(i.quantity)} key={`${i.id}-q-${i.quantity}`}
                       onBlur={e => { const n = Number(e.target.value); if (n !== Number(i.quantity)) saveLine(i.id, { quantity: n }); }} />
              ) : <span className="block text-right tabular-nums">{Number(i.quantity)}</span>}
            </div>
            <div className="col-span-2">
              {editable && !credit ? (
                <Input className="h-8 text-right" type="number" step="0.01" defaultValue={Number(i.unit_price)} key={`${i.id}-p-${i.unit_price}`}
                       onBlur={e => { const n = Number(e.target.value); if (n !== Number(i.unit_price)) saveLine(i.id, { unit_price: n }); }} />
              ) : <span className="block text-right tabular-nums">{money(i.unit_price)}</span>}
            </div>
            <div className="col-span-2 flex justify-center">
              {credit ? <span className="text-xs text-muted-foreground">Credit</span> : (
                <Checkbox checked={i.taxable !== false} disabled={!editable}
                          onCheckedChange={v => saveLine(i.id, { taxable: !!v })} aria-label="Taxable" />
              )}
            </div>
            <div className="col-span-2 flex items-center justify-end gap-1">
              <span className="tabular-nums">{money(i.line_total)}</span>
              {editable && !credit && (
                <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Remove line" onClick={() => removeLine(i.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        );
      })}
      {editable && (
        <div className="p-3 space-y-2">
          {!adding ? (
            <Button size="sm" variant="outline" onClick={() => setAdding(true)}><Plus className="h-4 w-4 mr-1" /> Add line</Button>
          ) : (
            <div className="grid gap-2">
              <BillingItemPicker value={draft.billing_item_id} onChange={pickNew} />
              <div className="grid grid-cols-[1fr_5rem_6rem_auto] gap-2 items-center">
                <Input placeholder="Description" value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} />
                <Input type="number" aria-label="Quantity" value={draft.quantity} onChange={e => setDraft(d => ({ ...d, quantity: e.target.value }))} />
                <Input type="number" step="0.01" aria-label="Unit price" value={draft.unit_price} onChange={e => setDraft(d => ({ ...d, unit_price: e.target.value }))} />
                <label className="flex items-center gap-1 text-xs"><Checkbox checked={draft.taxable} onCheckedChange={v => setDraft(d => ({ ...d, taxable: !!v }))} /> Tax</label>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={addLine}>Save line</Button>
                <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
