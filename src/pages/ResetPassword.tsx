import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock, CheckCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const ResetPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const markReady = () => {
      if (!mounted) return;
      setLinkError(null);
      setSessionReady(true);
    };

    const markError = (message: string) => {
      if (!mounted) return;
      setSessionReady(false);
      setLinkError(message);
    };

    const parseUrlParams = () => {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const searchParams = new URLSearchParams(window.location.search);

      return {
        accessToken: hashParams.get('access_token'),
        refreshToken: hashParams.get('refresh_token'),
        code: searchParams.get('code') || hashParams.get('code'),
        error: searchParams.get('error_description') || hashParams.get('error_description') || searchParams.get('error') || hashParams.get('error'),
      };
    };

    const verifyLink = async () => {
      const { accessToken, refreshToken, code, error } = parseUrlParams();

      if (error) {
        markError('This account setup link is invalid or has expired. Please ask your manager to resend your invite.');
        return;
      }

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (sessionError) {
          markError(sessionError.message || 'This account setup link could not be verified. Please ask your manager to resend your invite.');
          return;
        }

        markReady();
        return;
      }

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError) {
          markError(exchangeError.message || 'This account setup link could not be verified. Please ask your manager to resend your invite.');
          return;
        }

        markReady();
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        markReady();
      }
    };

    // Accept both PASSWORD_RECOVERY (forgot password) and SIGNED_IN (invite acceptance)
    // since invited users land here to set their initial password.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'USER_UPDATED') && session) {
        markReady();
      }
    });

    verifyLink();

    const timeout = window.setTimeout(() => {
      if (!sessionReady) {
        markError('This account setup link could not be verified. Please ask your manager to resend your invite.');
      }
    }, 8000);

    return () => {
      mounted = false;
      window.clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [sessionReady]);

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const password = formData.get('password') as string;
    const confirm = formData.get('confirm') as string;

    if (password !== confirm) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are the same.",
        variant: "destructive"
      });
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      toast({
        title: "Password too short",
        description: "Password must be at least 8 characters.",
        variant: "destructive"
      });
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } else {
      setDone(true);
      setTimeout(() => navigate('/'), 2000);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <img
            src="/crew-compass-logo.png?v=3"
            alt="Crew Compass"
            className="mx-auto mb-4 h-64 w-auto"
          />
        </div>

        {done ? (
          <Card className="backdrop-blur-sm bg-card/90">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                Password Updated!
              </CardTitle>
              <CardDescription>
                Your password has been successfully updated. Redirecting you to the app...
              </CardDescription>
            </CardHeader>
          </Card>
        ) : linkError ? (
          <Card className="backdrop-blur-sm bg-card/90">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Link Needs Resent
              </CardTitle>
              <CardDescription>{linkError}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button type="button" className="w-full" onClick={() => navigate('/auth')}>
                Back to Sign In
              </Button>
            </CardContent>
          </Card>
        ) : !sessionReady ? (
          <Card className="backdrop-blur-sm bg-card/90">
            <CardHeader>
              <CardTitle>Verifying Account Link...</CardTitle>
              <CardDescription>
                Please wait while we verify your account setup link.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center py-4">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : (
          <Card className="backdrop-blur-sm bg-card/90">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Set New Password
              </CardTitle>
              <CardDescription>
                Choose a strong new password for your account.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <Label htmlFor="password">New Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    placeholder="At least 8 characters"
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <Label htmlFor="confirm">Confirm New Password</Label>
                  <Input
                    id="confirm"
                    name="confirm"
                    type="password"
                    required
                    placeholder="Repeat your new password"
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Update Password
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
