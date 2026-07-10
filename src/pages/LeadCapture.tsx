import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2 } from 'lucide-react';
import { SEO } from '@/components/SEO';

export default function LeadCapture() {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    company_name: '',
    contact_name: '',
    email: '',
    phone: '',
    notes: '',
    website: '', // honeypot
  });

  const update = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company_name.trim()) {
      toast({ title: 'Company name is required', variant: 'destructive' });
      return;
    }
    if (!form.email.trim() && !form.phone.trim()) {
      toast({ title: 'Please provide an email or phone', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke('submit-lead', {
      body: { ...form, source: 'Website' },
    });
    setSubmitting(false);
    if (error || (data as any)?.error) {
      toast({
        title: 'Submission failed',
        description: (data as any)?.error || error?.message || 'Please try again.',
        variant: 'destructive',
      });
      return;
    }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <SEO
          title="Request Received — Summit Facilities Group"
          description="Thank you — we received your quote request and will be in touch shortly."
          path="/get-a-quote"
        />
        <Card className="max-w-lg w-full">
          <CardContent className="p-8 text-center space-y-4">
            <CheckCircle2 className="mx-auto h-14 w-14 text-primary" />
            <h1 className="text-2xl font-bold">Thanks — we received your request</h1>
            <p className="text-muted-foreground">
              A member of our team will reach out shortly to discuss your project.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <SEO
        title="Request a Quote for Facility Services — Summit Facilities Group"
        description="Get a tailored janitorial and facility services quote for your property. Fast response from Summit Facilities Group."
        path="/get-a-quote"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Service',
          serviceType: 'Janitorial and facility management services',
          provider: {
            '@type': 'Organization',
            name: 'Summit Facilities Group',
            url: 'https://clean-crew-command.lovable.app/',
            contactPoint: {
              '@type': 'ContactPoint',
              contactType: 'sales',
              email: 'privacy@summitfacilitiesgroup.com',
            },
          },
        }}
      />
      <Card className="max-w-xl w-full">
        <CardHeader>
          <h1 className="text-2xl font-semibold leading-none tracking-tight">Request a Quote for Facility Services</h1>
          <CardDescription>
            Tell us about your facility and we'll be in touch with a tailored estimate.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="company_name">Company / Property Name *</Label>
              <Input id="company_name" value={form.company_name}
                onChange={e => update('company_name', e.target.value)} maxLength={200} required />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="contact_name">Your Name</Label>
                <Input id="contact_name" value={form.contact_name}
                  onChange={e => update('contact_name', e.target.value)} maxLength={150} />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" type="tel" value={form.phone}
                  onChange={e => update('phone', e.target.value)} maxLength={40} />
              </div>
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email}
                onChange={e => update('email', e.target.value)} maxLength={255} />
            </div>
            <div>
              <Label htmlFor="notes">How can we help?</Label>
              <Textarea id="notes" rows={4} value={form.notes}
                onChange={e => update('notes', e.target.value)} maxLength={2000} />
            </div>
            {/* Honeypot — hidden from real users */}
            <input
              type="text" name="website" tabIndex={-1} autoComplete="off"
              value={form.website} onChange={e => update('website', e.target.value)}
              style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, opacity: 0 }}
              aria-hidden="true"
            />
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? 'Sending…' : 'Submit Request'}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              By submitting, you agree to be contacted regarding your inquiry.
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}