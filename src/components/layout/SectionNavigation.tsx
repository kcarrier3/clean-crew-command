import type { ReactNode } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface SectionOption {
  value: string;
  label: string;
}

/** One controlled section value powers the phone picker and existing desktop tabs. */
export function SectionNavigation({ label, value, onValueChange, options, children }: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: SectionOption[];
  children: ReactNode;
}) {
  return (
    <>
      <div className="md:hidden">
        <Select value={value} onValueChange={onValueChange}>
          <SelectTrigger aria-label={`${label} section`} className="h-11 min-w-0">
            <span className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 text-muted-foreground">{label}</span>
              <span className="text-muted-foreground" aria-hidden="true">/</span>
              <SelectValue placeholder="Choose report" />
            </span>
          </SelectTrigger>
          <SelectContent>
            {options.map(option => (
              <SelectItem key={option.value} value={option.value} className="min-h-11">{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="hidden md:block">{children}</div>
    </>
  );
}