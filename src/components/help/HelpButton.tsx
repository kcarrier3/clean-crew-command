import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { guideForModule } from '@/lib/guides';
import { useAuth } from '@/hooks/useAuth';
import GuideContent from './GuideContent';

/**
 * Contextual "?" button. Opens the how-to guide for the module the user is
 * currently looking at. Renders nothing when no guide exists or the guide is
 * manager-only and the viewer is not a manager.
 */
export const HelpButton = ({ moduleKey, className }: { moduleKey: string; className?: string }) => {
  const { isManager } = useAuth();
  const guide = guideForModule(moduleKey);
  if (!guide) return null;
  if (guide.audience === 'manager' && !isManager?.()) return null;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className={className} aria-label={`How to use ${guide.title}`}>
          <HelpCircle className="h-4 w-4 mr-1.5" />
          How to use this
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto pb-safe">
        <SheetHeader>
          <SheetTitle>{guide.title} — how to use it</SheetTitle>
        </SheetHeader>
        <div className="mt-6">
          <GuideContent guide={guide} />
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default HelpButton;
