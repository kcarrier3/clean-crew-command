import { useEffect, useState } from 'react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { Loader2, MailCheck } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';

interface Props { open: boolean; onOpenChange: (open: boolean) => void }

/** Step 1 of deleting an account: confirm the password, then a confirmation link is emailed. */
export const DeleteAccountDialog = ({ open, onOpenChange }: Props) => {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  useEffect(() => {
    if (!open) { setPassword(''); setError(null); setSentTo(null); setBusy(false); }
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) { setError('Enter your password.'); return; }
    setBusy(true); setError(null);
    const { data, error: fnErr } = await supabase.functions.invoke('request-account-deletion', { body: { password } });
    setBusy(false);
    if (fnErr) {
      let msg = 'Something went wrong. Please try again.';
      if (fnErr instanceof FunctionsHttpError) {
        try { msg = (await fnErr.context.json())?.error ?? msg; } catch { /* keep default */ }
      }
      setError(msg);
      return;
    }
    setPassword('');
    setSentTo(data?.email ?? 'your email');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {sentTo ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><MailCheck className="h-5 w-5" /> Check your email</DialogTitle>
              <DialogDescription>
                We sent a confirmation link to <strong>{sentTo}</strong>. Your account is not deleted until you open
                that link and confirm. The link works once and expires in 60 minutes.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter><Button onClick={() => onOpenChange(false)}>Done</Button></DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Delete your account?</DialogTitle>
              <DialogDescription>
                This is <strong>permanent and cannot be undone</strong>. You will need to be re-invited to get access again.
                Enter your password and we'll email you a link to confirm.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1">
              <Label htmlFor="delete-password">Password</Label>
              <Input id="delete-password" type="password" autoComplete="current-password"
                     value={password} onChange={e => setPassword(e.target.value)} disabled={busy} autoFocus />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
              <Button type="submit" variant="destructive" disabled={busy || !password}>
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Email me a confirmation link
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DeleteAccountDialog;
