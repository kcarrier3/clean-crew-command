import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import { CrmLinkPicker } from './CrmLinkPicker';
import { db } from './billingApi';
import { describeRate, fetchOhioCounties, fetchTaxRates, type TaxRateRow } from '@/lib/billing/taxRates';

export interface JobSiteTaxForm {
  county: string;
  county_needs_review: boolean;
  county_source: string | null;
  tax_exempt: boolean;
  tax_exemption_reason: string;
  tax_rate_id: string;
  crm_company_id: string | null;
}

export const emptyJobSiteTax = (): JobSiteTaxForm => ({
  county: '',
  county_needs_review: false,
  county_source: null,
  tax_exempt: false,
  tax_exemption_reason: '',
  tax_rate_id: '',
  crm_company_id: null,
});

export const jobSiteTaxFromRow = (row: Partial<JobSiteTaxForm> | null | undefined): JobSiteTaxForm => ({
  county: row?.county || '',
  county_needs_review: !!row?.county_needs_review,
  county_source: row?.county_source || null,
  tax_exempt: !!row?.tax_exempt,
  tax_exemption_reason: row?.tax_exemption_reason || '',
  tax_rate_id: row?.tax_rate_id || '',
  crm_company_id: row?.crm_company_id || null,
});

/** Columns written with a job site. Choosing a county clears the unconfirmed flag. */
export const jobSiteTaxPayload = (form: JobSiteTaxForm, original: JobSiteTaxForm) => {
  const county = form.county.trim();
  const countyChanged = county !== original.county.trim();
  return {
    county: county || null,
    county_needs_review: countyChanged ? false : form.county_needs_review,
    county_source: countyChanged ? 'manual' : (form.county_source || null),
    tax_exempt: form.tax_exempt,
    tax_exemption_reason: form.tax_exempt ? (form.tax_exemption_reason.trim() || null) : null,
    tax_rate_id: form.tax_rate_id || null,
    crm_company_id: form.crm_company_id,
  };
};

interface Props {
  idPrefix?: string;
  value: JobSiteTaxForm;
  onChange: (patch: Partial<JobSiteTaxForm>) => void;
}

export const JobSiteSalesTaxFields = ({ idPrefix = 'site', value, onChange }: Props) => {
  const [counties, setCounties] = useState<string[]>([]);
  const [rates, setRates] = useState<TaxRateRow[]>([]);

  useEffect(() => {
    fetchOhioCounties().then(setCounties).catch(() => setCounties([]));
    fetchTaxRates().then(setRates).catch(() => setRates([]));
  }, []);

  const countyOptions = value.county && !counties.includes(value.county)
    ? [value.county, ...counties]
    : counties;

  const rateOptions = rates.filter(r => r.active && !r.is_default);
  const selectedMissing = value.tax_rate_id && !rateOptions.some(r => r.id === value.tax_rate_id)
    ? rates.find(r => r.id === value.tax_rate_id)
    : null;

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div>
        <p className="text-sm font-medium">Sales tax</p>
        <p className="text-xs text-muted-foreground">
          Invoices use this county’s Ohio rate. Customer-level exemption is preferred over marking a site exempt.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Linked customer</Label>
        <CrmLinkPicker
          kind="company"
          value={value.crm_company_id}
          onChange={id => onChange({ crm_company_id: id })}
          placeholder="Link the customer this site bills"
        />
        <p className="text-[11px] text-muted-foreground">
          Tax exemption follows the invoice customer, then this job site’s customer.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}_county`}>Tax county</Label>
        <select
          id={`${idPrefix}_county`}
          value={value.county}
          onChange={e => onChange({
            county: e.target.value,
            county_needs_review: false,
            county_source: 'manual',
          })}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Select an Ohio county…</option>
          {countyOptions.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {value.county_needs_review && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">
            County unconfirmed — verify at{' '}
            <a className="underline" href="https://thefinder.tax.ohio.gov/" target="_blank" rel="noreferrer">
              tax.ohio.gov The Finder
            </a>
          </span>
          <Button type="button" size="sm" variant="outline" onClick={() => onChange({ county_needs_review: false })}>
            Confirm
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div>
          <Label htmlFor={`${idPrefix}_exempt`}>Tax exempt site</Label>
          <p className="text-[11px] text-muted-foreground">Rare. Prefer the customer’s exemption certificate.</p>
        </div>
        <Switch
          id={`${idPrefix}_exempt`}
          checked={value.tax_exempt}
          onCheckedChange={v => onChange({ tax_exempt: v })}
        />
      </div>
      {value.tax_exempt && (
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}_reason`}>Exemption reason</Label>
          <Input
            id={`${idPrefix}_reason`}
            value={value.tax_exemption_reason}
            onChange={e => onChange({ tax_exemption_reason: e.target.value })}
            placeholder="Local government"
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}_rate`}>Rate override</Label>
        <select
          id={`${idPrefix}_rate`}
          value={value.tax_rate_id}
          onChange={e => onChange({ tax_rate_id: e.target.value })}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Automatic (by county)</option>
          {selectedMissing && (
            <option value={selectedMissing.id}>{describeRate(selectedMissing)} — {Number(selectedMissing.rate).toFixed(2)}%</option>
          )}
          {rateOptions.map(r => (
            <option key={r.id} value={r.id}>{describeRate(r)} — {Number(r.rate).toFixed(2)}%</option>
          ))}
        </select>
      </div>
      {value.county_source === 'manual' && <Badge variant="outline" className="text-[10px]">County set manually</Badge>}
    </div>
  );
};

export const saveJobSiteTax = async (jobSiteId: string, form: JobSiteTaxForm, original: JobSiteTaxForm) => {
  const { error } = await db.from('job_sites').update(jobSiteTaxPayload(form, original)).eq('id', jobSiteId);
  if (error) throw error;
};
