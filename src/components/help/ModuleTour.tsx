import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { guideForModule } from '@/lib/guides';
import { useAuth } from '@/hooks/useAuth';

const seenKey = (moduleKey: string) => `cc.tour.${moduleKey}.v1`;

const hasSeen = (moduleKey: string) => {
  try {
    return window.localStorage.getItem(seenKey(moduleKey)) === '1';
  } catch {
    return true;
  }
};

const markSeen = (moduleKey: string) => {
  try {
    window.localStorage.setItem(seenKey(moduleKey), '1');
  } catch {
    /* noop */
  }
};

/**
 * First-time walkthrough for a module. Shows once per user per module (stored
 * locally), and can be re-opened any time from the "How to use this" panel.
 */
export const ModuleTour = ({ moduleKey }: { moduleKey: string }) => {
  const { isManager } = useAuth();
  const guide = guideForModule(moduleKey);
  const managerOnly = guide?.audience === 'manager' && !isManager?.();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    setStep(0);
    if (!guide || managerOnly || hasSeen(moduleKey)) {
      setOpen(false);
      return;
    }
    setOpen(true);
  }, [moduleKey, guide, managerOnly]);

  if (!guide || managerOnly) return null;

  const steps = guide.tour;
  const current = steps[Math.min(step, steps.length - 1)];
  const isLast = step >= steps.length - 1;

  const close = () => {
    markSeen(moduleKey);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogDescription className="text-xs uppercase tracking-wide">
            {guide.title} · Step {Math.min(step + 1, steps.length)} of {steps.length}
          </DialogDescription>
          <DialogTitle>{current.title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{current.body}</p>
        <div className="flex justify-center gap-1.5 pt-2">
          {steps.map((s, i) => (
            <span
              key={s.title}
              className={`h-1.5 w-1.5 rounded-full ${i === step ? 'bg-primary' : 'bg-muted-foreground/30'}`}
            />
          ))}
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" size="sm" onClick={close}>
            Skip
          </Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            )}
            <Button size="sm" onClick={() => (isLast ? close() : setStep((s) => s + 1))}>
              {isLast ? 'Got it' : 'Next'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ModuleTour;
