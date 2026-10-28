import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { fetchBillingItems, type BillingItem } from './billingApi';
import { money } from '@/lib/billing/types';

interface Props {
  value: string | null;
  onChange: (item: BillingItem | null) => void;
  placeholder?: string;
}

/** Searchable catalog picker. Credit and adjustment items stay out of invoice lines. */
export const BillingItemPicker = ({ value, onChange, placeholder }: Props) => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<BillingItem[]>([]);

  useEffect(() => {
    fetchBillingItems(false, { linePicker: true }).then(setItems).catch(() => setItems([]));
  }, []);

  const selected = items.find(i => i.id === value) ?? null;
  const groups = useMemo(() => {
    const map = new Map<string, BillingItem[]>();
    for (const item of items) {
      const key = item.category?.trim() || 'Uncategorized';
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
          <span className="truncate text-left">
            {selected
              ? `${selected.name}${selected.sku ? ` · ${selected.sku}` : ''}`
              : (placeholder ?? 'Select an item…')}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search name, SKU, or category" />
          <CommandList>
            <CommandEmpty>No matching items.</CommandEmpty>
            {groups.map(([category, rows]) => (
              <CommandGroup key={category} heading={category}>
                {rows.map(item => (
                  <CommandItem
                    key={item.id}
                    value={`${item.name} ${item.sku ?? ''} ${item.category ?? ''}`}
                    onSelect={() => { onChange(item); setOpen(false); }}
                  >
                    <Check className={`mr-2 h-4 w-4 ${value === item.id ? 'opacity-100' : 'opacity-0'}`} />
                    <span className="min-w-0 flex-1 truncate">
                      {item.name}
                      {item.sku ? <span className="text-muted-foreground"> · {item.sku}</span> : null}
                    </span>
                    {!item.taxable && <Badge variant="outline" className="ml-2 text-[10px]">Non-taxable</Badge>}
                    <span className="ml-2 text-xs tabular-nums text-muted-foreground">{money(item.default_unit_price)}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
