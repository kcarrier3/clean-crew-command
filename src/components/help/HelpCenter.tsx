import { useMemo, useState } from 'react';
import { BookOpen, RotateCcw, Search } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useModuleSettings } from '@/hooks/useModuleSettings';
import { guidesFor } from '@/lib/guides';
import GuideContent from './GuideContent';

/**
 * Role-filtered help center. Only shows guides for modules that are enabled
 * company-wide and visible to the signed-in user.
 */
export const HelpCenter = () => {
  const { isManager } = useAuth();
  const { isModuleEnabled } = useModuleSettings();
  const { toast } = useToast();
  const [query, setQuery] = useState('');

  const guides = useMemo(
    () => guidesFor(!!isManager?.(), isModuleEnabled),
    [isManager, isModuleEnabled],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return guides;
    return guides.filter((g) =>
      [
        g.title,
        g.summary,
        ...g.tour.flatMap((t) => [t.title, t.body]),
        ...g.sections.flatMap((s) => [s.heading, ...s.items]),
        ...(g.tips ?? []),
      ]
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [guides, query]);

  const replayTours = () => {
    try {
      Object.keys(window.localStorage)
        .filter((k) => k.startsWith('cc.tour.'))
        .forEach((k) => window.localStorage.removeItem(k));
    } catch {
      /* noop */
    }
    toast({ title: 'Walkthroughs reset', description: 'Each module will show its intro again next time you open it.' });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start gap-4">
          <div className="rounded-md bg-primary/10 p-3 text-primary">
            <BookOpen className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-2xl">Help &amp; How-To</CardTitle>
            <CardDescription className="mt-1">
              Step-by-step guides for every module you have access to. Each module page also has a
              “How to use this” button for the same guide in context.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search guides (billing, points, PTO, estimating…)"
              className="pl-9"
              aria-label="Search guides"
            />
          </div>
          <Button variant="outline" onClick={replayTours} className="sm:w-auto">
            <RotateCcw className="mr-2 h-4 w-4" /> Replay walkthroughs
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No guides match “{query}”.
            </p>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {filtered.map((guide) => (
                <AccordionItem key={guide.key} value={guide.key}>
                  <AccordionTrigger className="text-left">
                    <div className="min-w-0 pr-4">
                      <div className="font-medium">{guide.title}</div>
                      <p className="text-sm font-normal text-muted-foreground">{guide.summary}</p>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <GuideContent guide={guide} />
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default HelpCenter;
