import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ExternalLink, Receipt } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { INVOICE_PDF_BUCKET } from '@/lib/billing/emailService';
import { TAX_EXEMPT_REASONS, certificateWarning, type CompanyTaxFields } from './companyTax';

interface Props {
  company: CompanyTaxFields & { name?: string };
  onSaved?: () => void;
}

export const CompanySalesTaxCard = ({ company, onSaved }: Props) => {
  const { toast } = useToast();
  const [exempt, setExempt] = useState(false);
  const [reasonChoice, setReasonChoice] = useState('');
  const [reasonCustom, setReasonCustom] = useState('');
  const [onFile, setOnFile] = useState(false);
  const [expires, setExpires] = useState('');
  const [path, setPath] = useState<string | null>(null);
  const [qbId, setQbId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const reason = company.tax_exemption_reason || '';
    const known = TAX_EXEMPT_REASONS.includes(reason as typeof TAX_EXEMPT_REASONS[number]);
    setExempt(!!company.tax_exempt);
    setReasonChoice(known ? reason : (reason ? 'Other' : ''));
    setReasonCustom(known || !reason ? '' : reason);
    setOnFile(!!company.tax_exempt_certificate_on_file);
    setExpires(company.tax_exempt_certificate_expires || '');
    setPath(company.tax_exempt_certificate_path || null);
    setQbId(company.qb_customer_id || null);
  }, [company]);

  const reason = reasonChoice === 'Other' ? (reasonCustom.trim() || 'Other') : (reasonChoice || null);
  const warning = certificateWarning({
    id: company.id,
    tax_exempt: exempt,
    tax_exempt_certificate_on_file: onFile,
    tax_exempt_certificate_expires: expires || null,
  });

  const save = async (patch?: {
    tax_exempt_certificate_path?: string | null;
    tax_exempt_certificate_on_file?: boolean;
  }) => {
    setSaving(true);
    const payload = {
      tax_exempt: exempt,
      tax_exemption_reason: exempt ? reason : null,
      tax_exempt_certificate_on_file: onFile,
      tax_exempt_certificate_expires: expires || null,
      tax_exempt_certificate_path: path,
      ...patch,
    };
    const { error } = await supabase.from('crm_companies').update(payload).eq('id', company.id);
    setSaving(false);
    if (error) {
      toast({ title: 'Could not save sales tax', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Sales tax saved' });
    onSaved?.();
  };

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const safe = file.name.replace(/[^\w.-]+/g, '_');
      const next = `tax-exempt-certificates/${company.id}/${Date.now()}-${safe}`;
      const { error } = await supabase.storage.from(INVOICE_PDF_BUCKET).upload(next, file, {
        upsert: false,
        contentType: file.type || undefined,
      });
      if (error) throw error;
      setPath(next);
      setOnFile(true);
      await save({ tax_exempt_certificate_path: next, tax_exempt_certificate_on_file: true });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Upload failed';
      toast({ title: 'Could not upload certificate', description: message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const view = async () => {
    if (!path) return;
    const { data, error } = await supabase.storage.from(INVOICE_PDF_BUCKET).createSignedUrl(path, 120);
    if (error || !data?.signedUrl) {
      toast({ title: 'Could not open certificate', description: error?.message, variant: 'destructive' });
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Receipt className="h-4 w-4" /> Sales tax
          {exempt && <Badge variant="secondary">Exempt</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {warning && (
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{warning}</span>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <div>
            <Label htmlFor="co_exempt">Tax exempt</Label>
            <p className="text-xs text-muted-foreground">Applies to every invoice for this customer unless a job site is taxed separately.</p>
          </div>
          <Switch id="co_exempt" checked={exempt} onCheckedChange={setExempt} />
        </div>

        {exempt && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="co_reason">Exemption reason</Label>
              <select
                id="co_reason"
                value={reasonChoice}
                onChange={e => setReasonChoice(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select a reason…</option>
                {TAX_EXEMPT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            {reasonChoice === 'Other' && (
              <div className="space-y-1.5">
                <Label htmlFor="co_reason_custom">Reason detail</Label>
                <Input id="co_reason_custom" value={reasonCustom} onChange={e => setReasonCustom(e.target.value)} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="co_expires">Certificate expires</Label>
              <Input id="co_expires" type="date" value={expires} onChange={e => setExpires(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm sm:mt-6">
              <Checkbox checked={onFile} onCheckedChange={v => setOnFile(!!v)} />
              Certificate on file
            </label>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => save()} disabled={saving || uploading}>
            {saving ? 'Saving…' : 'Save sales tax'}
          </Button>
          <label className="inline-flex">
            <input
              type="file"
              accept="application/pdf,image/*"
              className="sr-only"
              onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }}
            />
            <span className="inline-flex h-9 cursor-pointer items-center rounded-md border px-3 text-sm">
              {uploading ? 'Uploading…' : path ? 'Replace certificate' : 'Upload certificate'}
            </span>
          </label>
          {path && (
            <Button size="sm" variant="outline" type="button" onClick={view}>
              <ExternalLink className="h-4 w-4 mr-1" /> View certificate
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          QuickBooks customer id: {qbId || '—'} (from QuickBooks, read-only)
        </p>
      </CardContent>
    </Card>
  );
};
