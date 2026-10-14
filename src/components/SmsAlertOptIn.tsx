import { useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export const normalizePhone = (raw: string): string | null => {
  const t = raw.trim();
  const d = t.replace(/\D/g, '');
  if (t.startsWith('+')) return d.length >= 8 && d.length <= 15 ? `+${d}` : null;
  if (d.length === 10 && /^[2-9]/.test(d)) return `+1${d}`;
  if (d.length === 11 && d.startsWith('1')) return `+${d}`;
  return null;
};

/** Managers opt in to missed punch-in texts on their own phone. */
export default function SmsAlertOptIn() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [phone, setPhone] = useState('');
  const [optIn, setOptIn] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (supabase as any).from('profiles').select('phone, sms_opt_in').eq('id', user.id).maybeSingle()
      .then(({ data }: any) => { setPhone(data?.phone ?? ''); setOptIn(!!data?.sms_opt_in); });
  }, [user]);

  const save = async () => {
    if (!user) return;
    const e164 = phone ? normalizePhone(phone) : null;
    if (optIn && !e164) {
      toast({ title: 'Check the phone number', description: 'Enter a valid mobile number, e.g. (440) 555-0123.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any).from('profiles').update({
      phone: e164 ?? phone, sms_opt_in: optIn, sms_opt_in_at: optIn ? new Date().toISOString() : null,
    }).eq('id', user.id);
    setSaving(false);
    toast(error
      ? { title: 'Could not save', description: error.message, variant: 'destructive' }
      : { title: optIn ? 'Text alerts on' : 'Text alerts off' });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Missed punch text alerts</CardTitle>
        <CardDescription>Get a text when someone you manage hasn't punched in for their shift.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="sms-phone">Mobile number</Label>
          <Input id="sms-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(440) 555-0123" />
        </div>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={optIn} onCheckedChange={(v) => setOptIn(v === true)} className="mt-0.5" />
          <span>I agree to receive automated work alert texts from Crew Compass at this number. Message and data rates may apply. Reply STOP to opt out.</span>
        </label>
        <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
      </CardContent>
    </Card>
  );
}
