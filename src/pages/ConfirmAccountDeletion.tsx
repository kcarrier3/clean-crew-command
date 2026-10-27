import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

/** Step 2 of deleting an account: opened from the confirmation email. Nothing happens until the button is clicked. */
const ConfirmAccountDeletion = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const validLink = /^[a-f0-9]{64}$/.test(token);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(validLink ? null : 'This link is not valid. Start again from Settings → Danger zone.');

  const confirm = async () => {
    setBusy(true); setError(null);
    const { error: fnErr } = await supabase.functions.invoke('confirm-account-deletion', { body: { token } });
    if (fnErr) {
      let msg = 'Something went wrong. Please try again.';
      if (fnErr instanceof FunctionsHttpError) {
        try { msg = (await fnErr.context.json())?.error ?? msg; } catch { /* keep default */ }
      }
      setError(msg); setBusy(false);
      return;
    }
    await supabase.auth.signOut().catch(() => undefined);
    setBusy(false); setDone(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {done ? <CheckCircle className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5 text-destructive" />}
            {done ? 'Account deleted' : 'Confirm account deletion'}
          </CardTitle>
          <CardDescription>
            {done
              ? 'Your Crew Compass account has been deleted. If you need access again, ask your manager to re-invite you.'
              : 'This permanently deletes your Crew Compass account. It cannot be undone.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {done ? (
            <Button className="w-full" onClick={() => navigate('/auth')}>Go to sign in</Button>
          ) : (
            <>
              <Button variant="destructive" className="w-full" onClick={confirm} disabled={busy || !validLink}>
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Permanently delete my account
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate('/')} disabled={busy}>
                Keep my account
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ConfirmAccountDeletion;
