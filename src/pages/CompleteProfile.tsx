import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const CompleteProfile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    phone: '',
    date_of_birth: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    emergency_contact_name: '',
    emergency_contact_relationship: '',
    emergency_contact_phone: '',
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/auth');
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('phone, date_of_birth, address_line1, address_line2, city, state, postal_code, emergency_contact_name, emergency_contact_relationship, emergency_contact_phone, profile_completed_at')
        .eq('id', user.id)
        .maybeSingle();
      const p: any = data ?? {};
      if (p.profile_completed_at) {
        navigate('/');
        return;
      }
      setForm({
        phone: p.phone ?? '',
        date_of_birth: p.date_of_birth ?? '',
        address_line1: p.address_line1 ?? '',
        address_line2: p.address_line2 ?? '',
        city: p.city ?? '',
        state: p.state ?? '',
        postal_code: p.postal_code ?? '',
        emergency_contact_name: p.emergency_contact_name ?? '',
        emergency_contact_relationship: p.emergency_contact_relationship ?? '',
        emergency_contact_phone: p.emergency_contact_phone ?? '',
      });
      setChecking(false);
    })();
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const required: Array<[keyof typeof form, string]> = [
      ['phone', 'Phone number'],
      ['date_of_birth', 'Date of birth'],
      ['address_line1', 'Street address'],
      ['city', 'City'],
      ['state', 'State'],
      ['postal_code', 'ZIP'],
      ['emergency_contact_name', 'Emergency contact name'],
      ['emergency_contact_relationship', 'Emergency contact relationship'],
      ['emergency_contact_phone', 'Emergency contact phone'],
    ];
    for (const [k, label] of required) {
      if (!String(form[k] ?? '').trim()) {
        toast({ title: 'Missing info', description: `${label} is required.`, variant: 'destructive' });
        return;
      }
    }
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        phone: form.phone.trim(),
        date_of_birth: form.date_of_birth,
        address_line1: form.address_line1.trim(),
        address_line2: form.address_line2.trim() || null,
        city: form.city.trim(),
        state: form.state.trim(),
        postal_code: form.postal_code.trim(),
        emergency_contact_name: form.emergency_contact_name.trim(),
        emergency_contact_relationship: form.emergency_contact_relationship.trim(),
        emergency_contact_phone: form.emergency_contact_phone.trim(),
        profile_completed_at: new Date().toISOString(),
      } as any)
      .eq('id', user.id);
    setSaving(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Welcome!', description: 'Your profile is set up.' });
    navigate('/');
  };

  if (authLoading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const upd = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-6">
          <img src="/crew-compass-logo.png?v=3" alt="Crew Compass" className="mx-auto mb-3 h-40 w-auto" />
        </div>
        <Card className="backdrop-blur-sm bg-card/90">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" /> Complete Your Profile
            </CardTitle>
            <CardDescription>
              Please provide this information before you start using Crew Compass. All fields are required unless marked optional.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Personal</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="cp-phone">Phone number</Label>
                    <Input id="cp-phone" type="tel" value={form.phone} onChange={upd('phone')} />
                  </div>
                  <div>
                    <Label htmlFor="cp-dob">Date of birth</Label>
                    <Input id="cp-dob" type="date" value={form.date_of_birth} onChange={upd('date_of_birth')} />
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Home Address</h3>
                <div>
                  <Label htmlFor="cp-addr1">Street address</Label>
                  <Input id="cp-addr1" value={form.address_line1} onChange={upd('address_line1')} />
                </div>
                <div>
                  <Label htmlFor="cp-addr2">Apt / Suite (optional)</Label>
                  <Input id="cp-addr2" value={form.address_line2} onChange={upd('address_line2')} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="cp-city">City</Label>
                    <Input id="cp-city" value={form.city} onChange={upd('city')} />
                  </div>
                  <div>
                    <Label htmlFor="cp-state">State</Label>
                    <Input id="cp-state" value={form.state} onChange={upd('state')} />
                  </div>
                  <div>
                    <Label htmlFor="cp-zip">ZIP</Label>
                    <Input id="cp-zip" value={form.postal_code} onChange={upd('postal_code')} />
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Emergency Contact</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="cp-ec-name">Name</Label>
                    <Input id="cp-ec-name" value={form.emergency_contact_name} onChange={upd('emergency_contact_name')} />
                  </div>
                  <div>
                    <Label htmlFor="cp-ec-rel">Relationship</Label>
                    <Input id="cp-ec-rel" value={form.emergency_contact_relationship} onChange={upd('emergency_contact_relationship')} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="cp-ec-phone">Phone</Label>
                  <Input id="cp-ec-phone" type="tel" value={form.emergency_contact_phone} onChange={upd('emergency_contact_phone')} />
                </div>
              </section>

              <Button type="submit" className="w-full" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save & Continue
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CompleteProfile;