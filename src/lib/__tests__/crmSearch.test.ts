import { describe, it, expect } from 'vitest';
import { matchesSearch } from '../crmSearch';

const crocker = ['Westlake - Crocker Park', 'City Wide Facility Solutions - Medina', null, null];
const pointe = ['Westlake, OH | Crocker Pointe Final Cleaning', 'Buckeye Construction', null, null];

describe('Waypoint search', () => {
  it('"Citywide Medina" finds the City Wide – Medina opportunity', () => {
    expect(matchesSearch('Citywide Medina', crocker)).toBe(true);
  });
  it('"crocker" finds both Crocker Park and Crocker Pointe', () => {
    expect(matchesSearch('crocker', crocker)).toBe(true);
    expect(matchesSearch('crocker', pointe)).toBe(true);
  });
  it('"crocker park" does not match Crocker Pointe', () => {
    expect(matchesSearch('crocker park', pointe)).toBe(false);
    expect(matchesSearch('crocker park', crocker)).toBe(true);
  });
  it('account name alone matches', () => {
    expect(matchesSearch('medina', crocker)).toBe(true);
  });
  it('unrelated words do not match', () => {
    expect(matchesSearch('avon', crocker)).toBe(false);
  });
  it('empty search matches everything', () => {
    expect(matchesSearch('  ', crocker)).toBe(true);
  });
});
