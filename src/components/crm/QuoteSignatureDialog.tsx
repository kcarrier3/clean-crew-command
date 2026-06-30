import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { SignaturePad } from '@/components/SignaturePad';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { CrmQuote } from './types';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  quote: CrmQuote;
  onSigned?: () => void;
}

export function QuoteSignatureDialog({ open, onOpenChange, quote, onSigned }: Props) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [title, setTitle] = useState('');
  const [sigData, setSigData] = useState('');
  const [sigType, setSigType] = useState<'drawn' | 'typed'>('drawn');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim() || !sigData) {
      toast({ title: 'Name and signature are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const ua = navigator.userAgent.slice(0, 200);
    const { error } = await (supabase as any).from('crm_quote_signatures').insert({
      quote_id: quote.id,
      signer_name: name.trim(),
      signer_email: email.trim() || null,
      signer_title: title.trim() || null,
      signature_data: sigData,
      signature_type: sigType,
      user_agent: ua,
    });
    if (error) {
      toast({ title: 'Failed to save signature', description: error.message, variant: 'destructive' });
      setSaving(false); return;
    }
    await (supabase as any).from('crm_quotes').update({ status: 'accepted' }).eq('id', quote.id);
    toast({ title: 'Signature captured', description: `Quote ${quote.quote_number} marked accepted.` });
    setSaving(false);
    onOpenChange(false);
    onSigned?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Sign Quote {quote.quote_number}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Signer Name *</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
            <div><Label>Title</Label><Input value={title} onChange={e => setTitle(e.target.value)} /></div>
          </div>
          <div><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
          <SignaturePad onSignature={(d, t) => { setSigData(d); setSigType(t); }} />
          <p className="text-xs text-muted-foreground">
            By signing, the signer agrees to the terms of this quote. Signature, IP, and timestamp will be stored.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Submit Signature'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}