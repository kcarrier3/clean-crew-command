import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

export default function SearchPicker({ label, value, options, onChange, required = false }: {
  label: string; value: string; options: { id: string; name: string }[]; onChange: (value: string) => void; required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return <div className="space-y-2 min-w-0"><label className="text-sm font-medium">{label}{required ? ' *' : ''}</label>
    <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild>
      <Button type="button" variant="outline" role="combobox" aria-label={label} aria-expanded={open} className="w-full justify-between min-w-0">
        <span className="truncate">{options.find(option => option.id === value)?.name ?? `Choose ${label.toLowerCase()}`}</span><ChevronsUpDown className="h-4 w-4 shrink-0 ml-2" />
      </Button>
    </PopoverTrigger><PopoverContent className="w-[min(380px,calc(100vw-3rem))] p-0" align="start"><Command>
      <CommandInput placeholder={`Search ${label.toLowerCase()}`} /><CommandList><CommandEmpty>No matches.</CommandEmpty><CommandGroup>
        {!required && <CommandItem onSelect={() => { onChange(''); setOpen(false); }}>None</CommandItem>}
        {options.map(option => <CommandItem key={option.id} value={`${option.name} ${option.id}`} onSelect={() => { onChange(option.id); setOpen(false); }}>
          <Check className={`mr-2 h-4 w-4 ${value === option.id ? 'opacity-100' : 'opacity-0'}`} /><span className="break-words">{option.name}</span>
        </CommandItem>)}
      </CommandGroup></CommandList></Command></PopoverContent></Popover>
  </div>;
}