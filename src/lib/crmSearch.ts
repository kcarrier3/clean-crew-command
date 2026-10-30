// Waypoint search matching. Lowercases, ignores spaces/punctuation, and
// requires every typed word to appear somewhere in the record's fields, so
// "Citywide Medina" matches "City Wide Facility Solutions - Medina".
export const normalizeSearch = (s: string | null | undefined): string =>
  (s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');

export const matchesSearch = (query: string, fields: Array<string | null | undefined>): boolean => {
  const tokens = query.toLowerCase().split(/\s+/).map(normalizeSearch).filter(Boolean);
  if (tokens.length === 0) return true;
  const haystack = fields.map(normalizeSearch).join('|');
  return tokens.every(t => haystack.includes(t));
};
