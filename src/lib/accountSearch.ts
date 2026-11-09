import { matchesSearch } from './crmSearch';

/**
 * Account / project search matching. Reuses Waypoint's normalization so typing
 * "citywide medina" or "crocker park" still finds the right account regardless
 * of spaces, dashes or capitalization.
 */
export interface SearchableAccount {
  name: string | null | undefined;
  client_name?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  contact_person?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  job_cost_code?: string | null;
  location_code?: string | null;
}

/** Every field an account search looks at. */
export const accountSearchFields = (site: SearchableAccount): Array<string | null | undefined> => [
  site.name,
  site.client_name,
  site.address,
  site.city,
  site.state,
  site.postal_code,
  site.contact_person,
  site.contact_phone,
  site.contact_email,
  site.job_cost_code,
  site.location_code,
];

export const matchesAccountSearch = (query: string, site: SearchableAccount): boolean =>
  matchesSearch(query, accountSearchFields(site));
