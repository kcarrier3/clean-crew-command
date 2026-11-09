import { describe, it, expect } from 'vitest';
import { matchesAccountSearch } from '../accountSearch';

const crocker = {
  name: 'Crocker Park Janitorial',
  client_name: 'City Wide Facility Solutions - Medina',
  address: '29501 Center Ridge Rd',
  city: 'Westlake',
  state: 'OH',
  postal_code: '44145',
  contact_person: 'Greg Maloney',
  contact_phone: '(440) 555-0142',
  contact_email: 'greg@citywide.example',
  job_cost_code: 'CP-JAN',
  location_code: 'WKL-01',
};

describe('Account Management search', () => {
  it('finds an account by name', () => {
    expect(matchesAccountSearch('crocker', crocker)).toBe(true);
  });
  it('finds an account by customer even with squashed spacing', () => {
    expect(matchesAccountSearch('citywide medina', crocker)).toBe(true);
  });
  it('finds an account by city', () => {
    expect(matchesAccountSearch('westlake', crocker)).toBe(true);
  });
  it('finds an account by cost code and location code', () => {
    expect(matchesAccountSearch('CP-JAN', crocker)).toBe(true);
    expect(matchesAccountSearch('wkl01', crocker)).toBe(true);
  });
  it('finds an account by phone digits', () => {
    expect(matchesAccountSearch('5550142', crocker)).toBe(true);
  });
  it('does not match an unrelated account', () => {
    expect(matchesAccountSearch('ganley', crocker)).toBe(false);
  });
  it('empty query matches everything', () => {
    expect(matchesAccountSearch('   ', crocker)).toBe(true);
  });
});
