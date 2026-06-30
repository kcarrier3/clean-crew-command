import type { PdfField, FieldValues } from './types';

interface ProfileLike {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  date_of_birth?: string | null;
}

export function buildAutofillValues(fields: PdfField[], profile: ProfileLike | null | undefined, existing: FieldValues = {}): FieldValues {
  const out: FieldValues = { ...existing };
  if (!profile) return out;
  const addressParts = [
    profile.address_line1,
    profile.address_line2,
    [profile.city, profile.state].filter(Boolean).join(', '),
    profile.postal_code,
  ].filter(Boolean).join(' ');
  for (const f of fields) {
    if (out[f.id] !== undefined && out[f.id] !== '') continue;
    switch (f.autofill) {
      case 'full_name':     out[f.id] = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim(); break;
      case 'first_name':    out[f.id] = profile.first_name ?? ''; break;
      case 'last_name':     out[f.id] = profile.last_name ?? ''; break;
      case 'email':         out[f.id] = profile.email ?? ''; break;
      case 'phone':         out[f.id] = profile.phone ?? ''; break;
      case 'address':       out[f.id] = addressParts; break;
      case 'date_of_birth': out[f.id] = profile.date_of_birth ?? ''; break;
      case 'today':         out[f.id] = new Date().toISOString().slice(0, 10); break;
      default: break;
    }
  }
  return out;
}