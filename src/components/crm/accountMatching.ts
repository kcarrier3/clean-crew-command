/** Names too short or meaningless to match on (avoids "N/A" matching everything). */
const JUNK_NAMES = new Set(['', 'n a', 'na', 'none', 'unknown', 'test', 'tbd', 'x']);

/** Whole-word containment, so "n a" never matches "guardia[n a]larm". */
function containsWords(haystack: string, needle: string): boolean {
  return (' ' + haystack + ' ').includes(' ' + needle + ' ');
}

/** Fuzzy matching helpers so scanned cards link to an existing account instead of duplicating it. */

const LEGAL_SUFFIXES = [
  'inc', 'incorporated', 'llc', 'l l c', 'llp', 'lp', 'ltd', 'limited', 'co', 'company',
  'corp', 'corporation', 'plc', 'pllc', 'pc', 'group', 'holdings', 'enterprises',
];

/** Lowercase, strip punctuation, "the", and trailing legal suffixes. */
export function normalizeAccountName(raw: string): string {
  let s = (raw || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  s = s.replace(/^the /, '');
  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of LEGAL_SUFFIXES) {
      if (s.endsWith(' ' + suffix)) {
        s = s.slice(0, -(suffix.length + 1)).trim();
        changed = true;
      }
    }
  }
  return s.replace(/\s+/g, ' ').trim();
}

/** Bare registrable domain from a URL or email. */
export function normalizeDomain(raw?: string | null): string {
  if (!raw) return '';
  let s = raw.trim().toLowerCase();
  if (s.includes('@')) s = s.split('@').pop() || '';
  s = s.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  return s;
}

/** Last 10 digits of a phone number, so formatting differences still match. */
export function normalizePhone(raw?: string | null): string {
  const digits = (raw || '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : '';
}

export type AccountLike = { id: string; name: string; website?: string | null; phone?: string | null };

export type AccountMatch<T extends AccountLike> = { account: T; reason: string; score: number };

/** Rank existing accounts that likely represent the same company. */
export function findAccountMatches<T extends AccountLike>(
  accounts: T[],
  candidate: { name?: string; website?: string; email?: string; phone?: string },
): AccountMatch<T>[] {
  const name = normalizeAccountName(candidate.name || '');
  const domain = normalizeDomain(candidate.website) || normalizeDomain(candidate.email);
  const phone = normalizePhone(candidate.phone);
  if (!name && !domain && !phone) return [];
  const nameUsable = name.length >= 4 && !JUNK_NAMES.has(name);

  const matches: AccountMatch<T>[] = [];
  for (const account of accounts) {
    const accountName = normalizeAccountName(account.name);
    const accountDomain = normalizeDomain(account.website);
    const accountPhone = normalizePhone(account.phone);

    let score = 0;
    const reasons: string[] = [];

    if (nameUsable && accountName.length >= 4 && !JUNK_NAMES.has(accountName)) {
      if (accountName === name) { score += 100; reasons.push('same name'); }
      else if (accountName.startsWith(name + ' ') || name.startsWith(accountName + ' ')) { score += 70; reasons.push('similar name'); }
      else if (containsWords(accountName, name) || containsWords(name, accountName)) { score += 50; reasons.push('similar name'); }
    }
    if (domain && accountDomain && domain === accountDomain) { score += 80; reasons.push('same website'); }
    if (phone && accountPhone && phone === accountPhone) { score += 80; reasons.push('same phone'); }

    if (score >= 50) matches.push({ account, reason: reasons.join(' · '), score });
  }

  return matches.sort((a, b) => b.score - a.score).slice(0, 5);
}
