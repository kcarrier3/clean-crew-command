import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Camera, Loader2, Upload, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from './fetchAllRows';
import { findAccountMatches, normalizeAccountName, type AccountMatch } from './accountMatching';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { CrmCompany } from './types';

type Fields = {
  first_name: string; last_name: string; title: string; company_name: string;
  email: string; phone: string; website: string; address: string;
  city: string; state: string; zip: string; notes: string;
};

const empty: Fields = {
  first_name: '', last_name: '', title: '', company_name: '', email: '', phone: '',
  website: '', address: '', city: '', state: '', zip: '', notes: '',
};

/** Downscale to keep the upload small and the model fast. */
async function toDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const max = 1600;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85);
}

export function BusinessCardScanDialog({
  open, onOpenChange, onSaved, defaultCompanyId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved?: () => void;
  defaultCompanyId?: string | null;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [createAccount, setCreateAccount] = useState(true);
  const [form, setForm] = useState<Fields>(empty);
  const [matches, setMatches] = useState<AccountMatch<CrmCompany>[]>([]);
  const [linkToId, setLinkToId] = useState<string | null>(null);
  const [checkingMatches, setCheckingMatches] = useState(false);

  const reset = () => {
    setForm(empty); setScanned(false); setCreateAccount(true);
    setMatches([]); setLinkToId(null);
  };

  // Look for accounts that already represent this company before we create another one.
  useEffect(() => {
    if (defaultCompanyId) return;
    const name = form.company_name.trim();
    if (!name && !form.website.trim() && !form.email.trim()) { setMatches([]); setLinkToId(null); return; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setCheckingMatches(true);
      try {
        const companies = await fetchAllRows<CrmCompany>('crm_companies', 'id, name, website, phone', { column: 'name' });
        const found = findAccountMatches(companies, {
          name, website: form.website, email: form.email, phone: form.phone,
        });
        if (cancelled) return;
        setMatches(found);
        setLinkToId(found[0]?.account.id ?? null);
      } finally {
        if (!cancelled) setCheckingMatches(false);
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [form.company_name, form.website, form.email, form.phone, defaultCompanyId]);

  const scan = async (file: File) => {
    setScanning(true);
    try {
      const image = await toDataUrl(file);
      const { data, error } = await supabase.functions.invoke('scan-business-card', { body: { image } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setForm({ ...empty, ...(data as Fields) });
      setScanned(true);
    } catch (e: any) {
      toast({ title: 'Could not read the card', description: e.message, variant: 'destructive' });
    } finally {
      setScanning(false);
    }
  };

  const save = async () => {
    if (!form.first_name.trim() && !form.company_name.trim()) {
      toast({ title: 'Enter at least a name or account', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      let companyId: string | null = defaultCompanyId ?? null;
      const name = form.company_name.trim();

      // Prefer the account the user picked from the possible-duplicate list.
      if (!companyId && linkToId) companyId = linkToId;

      if (!companyId && name) {
        const companies = await fetchAllRows<CrmCompany>('crm_companies', 'id, name, website, phone', { column: 'name' });
        const normalized = normalizeAccountName(name);
        // Re-check at save time in case the list changed since the scan.
        const existing = companies.find(c => normalizeAccountName(c.name) === normalized)
          ?? findAccountMatches(companies, { name, website: form.website, email: form.email, phone: form.phone })
              .find(m => m.score >= 100)?.account;
        if (existing) companyId = existing.id;
        else if (createAccount) {
          const { data, error } = await (supabase as any).from('crm_companies').insert({
            name, website: form.website || null, phone: form.phone || null,
            address: form.address || null, city: form.city || null,
            state: form.state || null, zip: form.zip || null,
            created_by: user?.id, owner_id: user?.id,
          }).select('id').single();
          if (error) throw error;
          companyId = data.id;
        }
      }

      if (form.first_name.trim() || form.last_name.trim() || form.email.trim()) {
        // Skip if this exact person is already on file (same email, or same name at the same account).
        const email = form.email.trim().toLowerCase();
        let dupe: any = null;
        if (email) {
          const { data } = await (supabase as any).from('crm_contacts')
            .select('id').ilike('email', email).limit(1).maybeSingle();
          dupe = data;
        }
        if (!dupe && companyId && form.last_name.trim()) {
          const { data } = await (supabase as any).from('crm_contacts')
            .select('id').eq('company_id', companyId)
            .ilike('first_name', form.first_name.trim())
            .ilike('last_name', form.last_name.trim())
            .limit(1).maybeSingle();
          dupe = data;
        }
        if (dupe) {
          toast({ title: 'Contact already exists', description: 'Linked to the existing record instead of creating a duplicate.' });
          reset();
          onOpenChange(false);
          onSaved?.();
          return;
        }

        const { error } = await (supabase as any).from('crm_contacts').insert({
          first_name: form.first_name.trim() || form.company_name.trim(),
          last_name: form.last_name || null,
          email: form.email || null,
          phone: form.phone || null,
          title: form.title || null,
          company_id: companyId,
          notes: form.notes || null,
          created_by: user?.id, owner_id: user?.id,
        });
        if (error) throw error;
      }

      toast({ title: 'Saved from business card' });
      reset();
      onOpenChange(false);
      onSaved?.();
    } catch (e: any) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, key: keyof Fields) => (
    <div>
      <Label>{label}</Label>
      <Input value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Scan business card</DialogTitle></DialogHeader>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" disabled={scanning} onClick={() => cameraInput.current?.click()}>
            {scanning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Camera className="h-4 w-4 mr-2" />}
            Take photo
          </Button>
          <Button variant="outline" className="flex-1" disabled={scanning} onClick={() => fileInput.current?.click()}>
            <Upload className="h-4 w-4 mr-2" /> Upload image
          </Button>
          <input
            ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) scan(f); e.target.value = ''; }}
          />
          <input
            ref={fileInput} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) scan(f); e.target.value = ''; }}
          />
        </div>

        {scanning && <p className="text-sm text-muted-foreground text-center py-4">Reading the card…</p>}

        {(scanned || form.first_name || form.company_name) && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Check the details before saving.</p>
            <div className="grid grid-cols-2 gap-3">
              {field('First name', 'first_name')}
              {field('Last name', 'last_name')}
            </div>
            {field('Title', 'title')}
            {!defaultCompanyId && field('Account / company', 'company_name')}
            <div className="grid grid-cols-2 gap-3">
              {field('Email', 'email')}
              {field('Phone', 'phone')}
            </div>
            {field('Website', 'website')}
            {field('Address', 'address')}
            <div className="grid grid-cols-3 gap-3">
              {field('City', 'city')}
              {field('State', 'state')}
              {field('Zip', 'zip')}
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
            {!defaultCompanyId && (
              <>
                {checkingMatches && (
                  <p className="text-xs text-muted-foreground">Checking for existing accounts…</p>
                )}
                {matches.length > 0 && (
                  <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      This account may already exist
                    </p>
                    {matches.map(m => (
                      <label key={m.account.id} className="flex items-start gap-2 text-sm">
                        <input
                          type="radio"
                          className="mt-1"
                          checked={linkToId === m.account.id}
                          onChange={() => setLinkToId(m.account.id)}
                        />
                        <span>
                          <span className="font-medium">{m.account.name}</span>
                          <span className="block text-xs text-muted-foreground">{m.reason}</span>
                        </span>
                      </label>
                    ))}
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="radio"
                        className="mt-1"
                        checked={linkToId === null}
                        onChange={() => setLinkToId(null)}
                      />
                      <span>None of these — create "{form.company_name.trim()}" as a new account</span>
                    </label>
                  </div>
                )}
                {matches.length === 0 && (
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={createAccount} onCheckedChange={v => setCreateAccount(!!v)} />
                    Create the account if it doesn't exist yet
                  </label>
                )}
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving || scanning || !scanned}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
