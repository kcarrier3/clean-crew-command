import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Radio, Volume2, VolumeX, Loader2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface Transmission {
  id: string;
  job_site_id: string;
  sender_id: string;
  audio_path: string;
  duration_seconds: number;
  created_at: string;
  senderName?: string;
}

const MAX_SECONDS = 60;

/**
 * Push-to-talk radio channel for the job site the current user is punched in to.
 * Hold the button to record, release to transmit. Incoming clips auto-play.
 */
export default function RadioChannel() {
  const { profile } = useAuth();
  const { toast } = useToast();

  const [siteId, setSiteId] = useState<string | null>(null);
  const [siteName, setSiteName] = useState<string>('');
  const [crew, setCrew] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Transmission[]>([]);
  const [recording, setRecording] = useState(false);
  const [sending, setSending] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useState(false);
  const [nowPlaying, setNowPlaying] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);
  const playedRef = useRef<Set<string>>(new Set());
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  // ---- find the site the user is currently punched in to -------------------
  const loadChannel = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('time_entries')
      .select('job_site_id, job_sites(name)')
      .eq('employee_id', profile.id)
      .is('clock_out', null)
      .order('clock_in', { ascending: false })
      .limit(1);
    const entry = data?.[0] as { job_site_id: string | null; job_sites?: { name: string } | null } | undefined;
    setSiteId(entry?.job_site_id ?? null);
    setSiteName(entry?.job_sites?.name ?? '');
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => { loadChannel(); }, [loadChannel]);

  // ---- who else is on the channel -----------------------------------------
  const loadCrew = useCallback(async (id: string) => {
    const { data } = await supabase
      .from('time_entries')
      .select('employee_id, profiles!time_entries_employee_id_fkey(id, first_name, last_name)')
      .eq('job_site_id', id)
      .is('clock_out', null);
    const rows = (data ?? []) as unknown as { profiles: { id: string; first_name: string; last_name: string } | null }[];
    const unique = new Map<string, string>();
    rows.forEach((r) => { if (r.profiles) unique.set(r.profiles.id, `${r.profiles.first_name} ${r.profiles.last_name}`); });
    setCrew([...unique].map(([id2, name]) => ({ id: id2, name })));
  }, []);

  // ---- transmissions -------------------------------------------------------
  const hydrateNames = useCallback(async (rows: Transmission[]) => {
    const ids = [...new Set(rows.map((r) => r.sender_id))];
    if (!ids.length) return rows;
    const { data } = await supabase.from('profiles').select('id, first_name, last_name').in('id', ids);
    const map = new Map((data ?? []).map((p) => [p.id, `${p.first_name} ${p.last_name}`]));
    return rows.map((r) => ({ ...r, senderName: map.get(r.sender_id) ?? 'Crew' }));
  }, []);

  const playClip = useCallback(async (t: Transmission) => {
    const { data, error } = await supabase.storage.from('radio').createSignedUrl(t.audio_path, 3600);
    if (error || !data?.signedUrl) return;
    const audio = new Audio(data.signedUrl);
    setNowPlaying(t.id);
    audio.onended = () => setNowPlaying((p) => (p === t.id ? null : p));
    try { await audio.play(); } catch { setNowPlaying(null); }
  }, []);

  const loadTransmissions = useCallback(async (id: string) => {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('radio_transmissions')
      .select('*')
      .eq('job_site_id', id)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(50);
    const rows = await hydrateNames((data ?? []) as Transmission[]);
    rows.forEach((r) => playedRef.current.add(r.id));
    setItems(rows);
  }, [hydrateNames]);

  useEffect(() => {
    if (!siteId) { setItems([]); setCrew([]); return; }
    loadTransmissions(siteId);
    loadCrew(siteId);

    const channel = supabase
      .channel(`radio-${siteId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'radio_transmissions', filter: `job_site_id=eq.${siteId}` },
        async (payload) => {
          const row = payload.new as Transmission;
          const [withName] = await hydrateNames([row]);
          setItems((prev) => (prev.some((p) => p.id === row.id) ? prev : [withName, ...prev]));
          if (!playedRef.current.has(row.id)) {
            playedRef.current.add(row.id);
            if (!mutedRef.current && row.sender_id !== profile?.id) playClip(withName);
          }
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [siteId, loadTransmissions, loadCrew, hydrateNames, playClip, profile?.id]);

  // ---- recording -----------------------------------------------------------
  const stopTimer = () => {
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
  };

  const upload = useCallback(async (blob: Blob, seconds: number) => {
    if (!siteId || !profile?.id) return;
    setSending(true);
    const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
    const path = `${siteId}/${profile.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('radio').upload(path, blob, { contentType: blob.type });
    if (upErr) {
      setSending(false);
      toast({ title: 'Transmission failed', description: upErr.message, variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('radio_transmissions').insert({
      job_site_id: siteId,
      sender_id: profile.id,
      audio_path: path,
      duration_seconds: seconds,
    });
    setSending(false);
    if (error) toast({ title: 'Transmission failed', description: error.message, variant: 'destructive' });
    else loadTransmissions(siteId);
  }, [siteId, profile?.id, toast, loadTransmissions]);

  const startRecording = useCallback(async () => {
    if (recording || sending || !siteId) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const seconds = Math.round((Date.now() - startedAtRef.current) / 100) / 10;
        const blob = new Blob(chunksRef.current, { type: mime });
        if (seconds >= 0.6 && blob.size > 0) upload(blob, seconds);
      };
      recorderRef.current = rec;
      startedAtRef.current = Date.now();
      rec.start();
      setRecording(true);
      setElapsed(0);
      timerRef.current = window.setInterval(() => {
        const s = (Date.now() - startedAtRef.current) / 1000;
        setElapsed(s);
        if (s >= MAX_SECONDS) stopRecording();
      }, 100);
    } catch {
      toast({ title: 'Microphone blocked', description: 'Allow microphone access to use the radio.', variant: 'destructive' });
    }
  }, [recording, sending, siteId, upload, toast]);

  const stopRecording = useCallback(() => {
    stopTimer();
    setRecording(false);
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
    recorderRef.current = null;
  }, []);

  useEffect(() => () => { stopTimer(); }, []);

  if (loading) {
    return (
      <Card><CardContent className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></CardContent></Card>
    );
  }

  if (!siteId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Radio className="h-5 w-5" /> Radio</CardTitle>
          <CardDescription>Clock in to an account or project to join its radio channel.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Radio className="h-5 w-5" /> {siteName || 'Job site'} channel
          </CardTitle>
          <CardDescription>
            {crew.length} {crew.length === 1 ? 'person' : 'people'} on the channel
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {crew.map((c) => (
              <Badge key={c.id} variant={c.id === profile?.id ? 'default' : 'secondary'}>{c.name}</Badge>
            ))}
          </div>

          <div className="flex flex-col items-center gap-3 pt-2">
            <button
              type="button"
              disabled={sending}
              onPointerDown={startRecording}
              onPointerUp={stopRecording}
              onPointerLeave={() => recording && stopRecording()}
              onContextMenu={(e) => e.preventDefault()}
              className={`select-none touch-none h-32 w-32 rounded-full border-4 flex flex-col items-center justify-center transition-transform ${
                recording
                  ? 'bg-destructive text-destructive-foreground border-destructive scale-105 animate-pulse'
                  : 'bg-primary text-primary-foreground border-primary/40 active:scale-95'
              } disabled:opacity-60`}
              aria-label="Hold to talk"
            >
              {sending ? <Loader2 className="h-8 w-8 animate-spin" /> : <Mic className="h-8 w-8" />}
              <span className="mt-1 text-xs font-semibold">
                {sending ? 'Sending' : recording ? `${elapsed.toFixed(1)}s` : 'Hold to talk'}
              </span>
            </button>
            <Button variant="ghost" size="sm" onClick={() => setMuted((m) => !m)}>
              {muted ? <VolumeX className="h-4 w-4 mr-2" /> : <Volume2 className="h-4 w-4 mr-2" />}
              {muted ? 'Speaker off' : 'Speaker on'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent transmissions</CardTitle>
          <CardDescription>Kept for 30 days</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.length === 0 && <p className="text-sm text-muted-foreground">No transmissions yet.</p>}
          {items.map((t) => (
            <div key={t.id} className="flex items-center gap-3 rounded-md border p-2">
              <Button size="icon" variant={nowPlaying === t.id ? 'default' : 'outline'} onClick={() => playClip(t)} aria-label="Play transmission">
                <Play className="h-4 w-4" />
              </Button>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{t.senderName ?? 'Crew'}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(t.created_at).toLocaleString()} · {Number(t.duration_seconds).toFixed(1)}s
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
