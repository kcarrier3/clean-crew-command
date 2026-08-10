import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

export interface MergeCandidate {
  id: string;
  label: string;
  sub?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  candidates: MergeCandidate[];
  onConfirm: (winnerId: string) => Promise<void>;
}

export function MergeDialog({ open, onOpenChange, title, description, candidates, onConfirm }: Props) {
  const [winner, setWinner] = useState<string>('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) setWinner(candidates[0]?.id || ''); }, [open, candidates]);

  const run = async () => {
    if (!winner) return;
    setBusy(true);
    try { await onConfirm(winner); onOpenChange(false); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <RadioGroup value={winner} onValueChange={setWinner} className="max-h-[45vh] overflow-y-auto space-y-1">
          {candidates.map(c => (
            <label
              key={c.id}
              htmlFor={`merge-${c.id}`}
              className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent/50"
            >
              <RadioGroupItem value={c.id} id={`merge-${c.id}`} className="mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-medium break-words">{c.label}</p>
                {c.sub && <p className="text-xs text-muted-foreground break-words">{c.sub}</p>}
              </div>
            </label>
          ))}
        </RadioGroup>
        <p className="text-xs text-muted-foreground">
          The records you don’t keep are deleted after their related data is moved to the record you keep.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={run} disabled={busy || !winner}>{busy ? 'Merging…' : 'Merge'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
