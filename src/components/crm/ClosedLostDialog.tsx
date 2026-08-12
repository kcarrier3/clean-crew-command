import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LOST_REASONS, type LostDetails } from './types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** How many opportunities are being closed (for bulk close-out). */
  count?: number;
  saving?: boolean;
  onConfirm: (details: LostDetails) => void;
}

export function ClosedLostDialog({ open, onOpenChange, count = 1, saving = false, onConfirm }: Props) {
  const [reason, setReason] = useState('');
  const [competitor, setCompetitor] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) { setReason(''); setCompetitor(''); setNotes(''); }
  }, [open]);

  const needsCompetitor = reason === 'Lost to competitor';
  const canSubmit = !!reason && (!needsCompetitor || competitor.trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Why did we lose {count > 1 ? `these ${count} opportunities` : 'this opportunity'}?</DialogTitle>
          <DialogDescription>
            A loss reason is required before an opportunity can be marked Closed Lost.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Reason lost <span className="text-destructive">*</span></Label>
            <Select value={reason || undefined} onValueChange={setReason}>
              <SelectTrigger><SelectValue placeholder="Select a reason" /></SelectTrigger>
              <SelectContent>
                {LOST_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {needsCompetitor && (
            <div className="space-y-1.5">
              <Label>Competitor <span className="text-destructive">*</span></Label>
              <Input value={competitor} onChange={e => setCompetitor(e.target.value)} placeholder="Who won the work?" />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Details</Label>
            <Textarea
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="What happened? Pricing gap, timing, scope, etc."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button
            variant="destructive"
            disabled={!canSubmit || saving}
            onClick={() => onConfirm({
              lost_reason: reason,
              lost_competitor: needsCompetitor ? competitor.trim() : null,
              lost_notes: notes.trim() || null,
            })}
          >
            {saving ? 'Saving…' : 'Mark Closed Lost'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}