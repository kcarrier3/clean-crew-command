import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';

/** Desktop content stays open; secondary phone content is revealed on demand. */
export function MobileDisclosure({ title, children, summary }: {
  title: string;
  children: ReactNode;
  summary?: string;
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const id = useId();
  if (!isMobile) return <>{children}</>;
  return (
    <section className="border-t border-border py-2">
      <Button variant="ghost" className="h-auto min-h-11 w-full justify-between gap-3 px-0 text-left" aria-expanded={open} aria-controls={id} onClick={() => setOpen(current => !current)}>
        <span className="min-w-0">
          <span className="block font-medium">{title}</span>
          {summary && <span className="block text-xs font-normal text-muted-foreground">{summary}</span>}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} />
      </Button>
      <div id={id} hidden={!open} className="pt-2">{open && children}</div>
    </section>
  );
}