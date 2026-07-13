import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Clock, PlayCircle, StopCircle, Loader2 } from 'lucide-react';

type Status = 'loading' | 'need-auth' | 'invalid' | 'ready' | 'success' | 'error';

const PunchClock = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState<string>('');
  const [site, setSite] = useState<{ id: string; name: string } | null>(null);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setStatus('need-auth');
      return;
    }
    if (!token) {
      setStatus('invalid');
      setMessage('No QR token provided.');
      return;
    }

    (async () => {
      const { data: siteRow, error: siteErr } = await supabase
        .from('job_sites')
        .select('id, name, active')
        .eq('qr_code_token', token)
        .maybeSingle();

      if (siteErr || !siteRow) {
        setStatus('invalid');
        setMessage('This QR code is not valid. Ask your manager for a new one.');
        return;
      }
      if (!siteRow.active) {
        setStatus('invalid');
        setMessage(`${siteRow.name} is not currently active.`);
        return;
      }
      setSite({ id: siteRow.id, name: siteRow.name });

      const { data: active } = await supabase
        .from('time_entries')
        .select('id, job_site_id')
        .eq('employee_id', user.id)
        .is('clock_out', null)
        .order('clock_in', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (active) {
        if (active.job_site_id !== siteRow.id) {
          setStatus('error');
          setMessage('You are already clocked in at a different account. Clock out there first.');
          return;
        }
        setActiveEntryId(active.id);
      }
      setStatus('ready');
    })();
  }, [token, user, authLoading]);

  const doPunch = async () => {
    if (!user || !site) return;
    setWorking(true);
    try {
      if (activeEntryId) {
        const { error } = await supabase
          .from('time_entries')
          .update({ clock_out: new Date().toISOString() })
          .eq('id', activeEntryId);
        if (error) throw error;
        setMessage(`Clocked out from ${site.name}.`);
      } else {
        const { error } = await supabase
          .from('time_entries')
          .insert({
            employee_id: user.id,
            job_site_id: site.id,
            clock_in: new Date().toISOString(),
          });
        if (error) throw error;
        setMessage(`Clocked in at ${site.name}.`);
      }
      setStatus('success');
    } catch (err: any) {
      setStatus('error');
      setMessage(err?.message ?? 'Failed to record punch.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" /> QR Punch
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'loading' && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Verifying code…
            </div>
          )}
          {status === 'need-auth' && (
            <>
              <p>Please sign in to clock in with this code.</p>
              <Button onClick={() => navigate(`/auth?redirect=/punch/${token}`)}>Sign in</Button>
            </>
          )}
          {status === 'invalid' && (
            <div className="flex items-start gap-2 text-destructive">
              <XCircle className="h-5 w-5 mt-0.5 shrink-0" />
              <p>{message}</p>
            </div>
          )}
          {status === 'ready' && site && (
            <>
              <p className="text-sm text-muted-foreground">Account</p>
              <p className="text-lg font-semibold">{site.name}</p>
              <p className="text-sm">
                Signed in as {profile?.first_name} {profile?.last_name}
              </p>
              <Button
                className="w-full h-14 text-lg"
                onClick={doPunch}
                disabled={working}
                variant={activeEntryId ? 'destructive' : 'default'}
              >
                {working ? (
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                ) : activeEntryId ? (
                  <StopCircle className="h-6 w-6 mr-2" />
                ) : (
                  <PlayCircle className="h-6 w-6 mr-2" />
                )}
                {activeEntryId ? 'Clock Out' : 'Clock In'}
              </Button>
            </>
          )}
          {status === 'success' && (
            <>
              <div className="flex items-start gap-2 text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0" />
                <p>{message}</p>
              </div>
              <Button asChild variant="outline" className="w-full">
                <Link to="/">Back to app</Link>
              </Button>
            </>
          )}
          {status === 'error' && (
            <>
              <div className="flex items-start gap-2 text-destructive">
                <XCircle className="h-5 w-5 mt-0.5 shrink-0" />
                <p>{message}</p>
              </div>
              <Button asChild variant="outline" className="w-full">
                <Link to="/">Back to app</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PunchClock;