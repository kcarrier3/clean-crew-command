import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { db } from './billingApi';

interface Props {
  kind: 'company' | 'deal';
  value: string | null;
  onChange: (id: string | null, label: string | null) => void;
  /** Restrict deals to a company when known. */
  companyId?: string | null;
  placeholder?: string;
}

/** Type-ahead picker over the real Waypoint accounts / opportunities. */
export const CrmLinkPicker = ({ kind, value, onChange, companyId, placeholder }: Props) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<{ id: string; label: string }[]>([]);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);

  const table = kind === 'company' ? 'crm_companies' : 'crm_deals';

  useEffect(() => {
    let cancel = false;
    const run = async () => {
      let query = db.from(table).select('id, name').order('name').limit(25);
      if (q.trim()) query = query.ilike('name', `%${q.trim()}%`);
      if (kind === 'deal' && companyId) query = query.eq('company_id', companyId);
      const { data } = await query;
      if (!cancel) setRows((data ?? []).map((r: any) => ({ id: r.id, label: r.name })));
    };
    const t = setTimeout(run, 200);
    return () => { cancel = true; clearTimeout(t); };
  }, [q, table, kind, companyId]);

  useEffect(() => {
    if (!value) { setSelectedLabel(null); return; }
    let cancel = false;
    db.from(table).select('name').eq('id', value).maybeSingle()
      .then(({ data }: any) => { if (!cancel) setSelectedLabel(data?.name ?? null); });
    return () => { cancel = true; };
  }, [value, table]);

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="flex-1 justify-between font-normal">
            <span className="truncate">
              {selectedLabel ?? placeholder ?? (kind === 'company' ? 'Link Waypoint account' : 'Link opportunity')}
            </span>
            <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput value={q} onValueChange={setQ} placeholder="Search…" />
            <CommandList>
              <CommandEmpty>No matches.</CommandEmpty>
              <CommandGroup>
                {rows.map(r => (
                  <CommandItem key={r.id} value={r.id} onSelect={() => {
                    onChange(r.id, r.label); setSelectedLabel(r.label); setOpen(false);
                  }}>
                    <Check className={`mr-2 h-4 w-4 ${value === r.id ? 'opacity-100' : 'opacity-0'}`} />
                    <span className="truncate">{r.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value && (
        <Button variant="ghost" size="icon" aria-label="Clear link"
                onClick={() => { onChange(null, null); setSelectedLabel(null); }}>
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};
