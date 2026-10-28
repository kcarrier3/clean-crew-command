import { supabase } from '@/integrations/supabase/client';

const db = supabase as any;

export interface TaxRateRow {
  id: string;
  country: string;
  state: string;
  county: string | null;
  city: string | null;
  zip: string | null;
  rate: number;
  label: string | null;
  is_default: boolean;
  active: boolean;
  effective_from?: string | null;
  effective_to?: string | null;
  ust_code?: string | null;
  transit_area?: string | null;
  source_url?: string | null;
}

export interface AddressLike {
  name?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

export interface ResolvedTax {
  rate: number;
  jurisdiction: string | null;
  /** How the rate was found — useful for showing the user why. */
  match: 'zip' | 'city' | 'county' | 'state' | 'default' | 'none';
}

const norm = (v?: string | null) => (v ?? '').trim().toLowerCase();

export const fetchTaxRates = async (): Promise<TaxRateRow[]> => {
  const { data, error } = await db.from('tax_rates').select('*')
    .order('state')
    .order('county')
    .order('effective_from', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ ...r, rate: Number(r.rate || 0) }));
};

/** County-wide Ohio rows the sales-tax resolver actually uses (city, ZIP, and transit blank). */
export const isCountyWideRate = (r: TaxRateRow) =>
  r.state === 'OH' && !r.city && !r.zip && !r.transit_area && !!r.county;

export const fetchOhioCounties = async (): Promise<string[]> => {
  const rates = await fetchTaxRates();
  return [...new Set(rates.filter(r => r.active && isCountyWideRate(r)).map(r => r.county as string))]
    .sort((a, b) => a.localeCompare(b));
};

/** Rate effective on a date for one Ohio county. Null when the county has no open row. */
export const rateForCounty = (rates: TaxRateRow[], county: string | null | undefined, onDate: string): TaxRateRow | null => {
  if (!county) return null;
  const key = county.trim().toLowerCase();
  const matches = rates.filter(r =>
    r.active && isCountyWideRate(r) && (r.county ?? '').trim().toLowerCase() === key
    && (r.effective_from ?? '0001-01-01') <= onDate
    && (!r.effective_to || r.effective_to >= onDate)
  );
  matches.sort((a, b) => (b.effective_from ?? '').localeCompare(a.effective_from ?? ''));
  return matches[0] ?? null;
};

export const describeRate = (r: TaxRateRow) =>
  r.label || [r.city, r.county && `${r.county} County`, r.state === '*' ? null : r.state]
    .filter(Boolean).join(', ') || 'Default';

/** Picks the most specific active rate for an address: ZIP, then city, then county, then state, then default. */
export const resolveTaxRate = (addr: AddressLike | null | undefined, rates: TaxRateRow[]): ResolvedTax => {
  const active = rates.filter(r => r.active);
  if (!addr) {
    const d = active.find(r => r.is_default);
    return d ? { rate: d.rate, jurisdiction: describeRate(d), match: 'default' } : { rate: 0, jurisdiction: null, match: 'none' };
  }
  const city = norm(addr.city);
  const state = norm(addr.state);
  const zip = (addr.zip ?? '').trim().slice(0, 5);

  const byZip = zip ? active.find(r => (r.zip ?? '').trim().slice(0, 5) === zip) : undefined;
  if (byZip) return { rate: byZip.rate, jurisdiction: describeRate(byZip), match: 'zip' };

  const byCity = city
    ? active.find(r => norm(r.city) === city && (!state || norm(r.state) === state || r.state === '*'))
    : undefined;
  if (byCity) return { rate: byCity.rate, jurisdiction: describeRate(byCity), match: 'city' };

  // No city match — fall back to a state-wide row, then the default.
  const byState = state
    ? active.find(r => norm(r.state) === state && !r.city && !r.county && !r.zip)
    : undefined;
  if (byState) return { rate: byState.rate, jurisdiction: describeRate(byState), match: 'state' };

  const d = active.find(r => r.is_default);
  return d ? { rate: d.rate, jurisdiction: describeRate(d), match: 'default' } : { rate: 0, jurisdiction: null, match: 'none' };
};

/** Convenience: load rates and resolve in one call. */
export const lookupTaxRate = async (addr: AddressLike | null | undefined): Promise<ResolvedTax> =>
  resolveTaxRate(addr, await fetchTaxRates());

export const fetchCompanyAddress = async (companyId?: string | null): Promise<AddressLike | null> => {
  if (!companyId) return null;
  const { data } = await db.from('crm_companies').select('name, address, city, state, zip').eq('id', companyId).maybeSingle();
  return data ?? null;
};

export const fetchJobSiteAddress = async (jobSiteId?: string | null): Promise<AddressLike | null> => {
  if (!jobSiteId) return null;
  const { data } = await db.from('job_sites').select('name, address, city, state').eq('id', jobSiteId).maybeSingle();
  return data ? { ...data, zip: null } : null;
};

export const formatAddress = (a: AddressLike | null | undefined) => {
  if (!a) return '';
  const l2 = [a.city, a.state].filter(Boolean).join(', ');
  return [a.address, [l2, a.zip].filter(Boolean).join(' ')].filter(Boolean).join('\n');
};

export const emptyAddress = (): Required<Pick<AddressLike, 'name' | 'address' | 'city' | 'state' | 'zip'>> =>
  ({ name: '', address: '', city: '', state: '', zip: '' });
