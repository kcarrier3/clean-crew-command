import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { guideForModule } from '@/lib/guides';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const seenKey = (moduleKey: string) => `cc.tour.${moduleKey}.v1`;

const hasSeenLocal = (moduleKey: string) => {
  try {
    return window.localStorage.getItem(seenKey(moduleKey)) === '1';
  } catch {
    return true;
  }
};

const markSeenLocal = (moduleKey: string) => {
  try {
    window.localStorage.setItem(seenKey(moduleKey), '1');
  } catch {
    /* noop */
  }
};

/**
 * First-time walkthrough for a module. Shown once per user per module. The
 * "seen" flag is stored on the user's account (so it survives sign-outs, new
 * browsers and new devices) with a local fallback for offline use. It can be
 * re-opened any time from the "How to use this" panel.
 */
export const ModuleTour = ({ moduleKey }: { moduleKey: string }) => {
  const { isManager, user } = useAuth();
  const guide = guideForModule(moduleKey);
  const managerOnly = guide?.audience === 'manager' && !isManager?.();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const checkedRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStep(0);
    setOpen(false);

    if (!guide || managerOnly || !user?.id) return;

    // Only evaluate once per module per mount-session to avoid re-prompting.
    const checkToken = `${user.id}:${moduleKey}`;
    if (checkedRef.current === checkToken) return;
    checkedRef.current = checkToken;

    (async () => {
      try {
        const { data, error } = await supabase
          .from('user_tour_progress')
          .select('id')
          .eq('user_id', user.id)
          .eq('module_key', moduleKey)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          // Fall back to the local flag if the lookup fails.
          if (!hasSeenLocal(moduleKey)) setOpen(true);
          return;
        }

        if (data) {
          markSeenLocal(moduleKey);
          return;
        }

        if (!hasSeenLocal(moduleKey)) {
          setOpen(true);
        } else {
          // Seen previously on this device: record it on the account so other
          // devices don't show it again either.
          void supabase
            .from('user_tour_progress')
            .upsert({ user_id: user.id, module_key: moduleKey }, { onConflict: 'user_id,module_key' });
        }
      } catch {
        if (!cancelled && !hasSeenLocal(moduleKey)) setOpen(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [moduleKey, guide, managerOnly, user?.id]);

  if (!guide || managerOnly) return null;

  const steps = guide.tour;
  const current = steps[Math.min(step, steps.length - 1)];
  const isLast = step >= steps.length - 1;

  const close = () => {
    markSeenLocal(moduleKey);
    setOpen(false);
    if (user?.id) {
      void supabase
        .from('user_tour_progress')
        .upsert({ user_id: user.id, module_key: moduleKey }, { onConflict: 'user_id,module_key' });
    }
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
