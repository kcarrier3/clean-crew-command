import { supabase } from '@/integrations/supabase/client';
import { db, recordPayment } from '@/components/billing/billingApi';

/** Untyped handle — the check-intake tables are new and joined ad hoc. */
export const CHECK_BUCKET = 'check-images';

export type IntakeStatus = 'review_needed' | 'applied' | 'voided';

/** How an intake was posted. */
export type ApplyMode = 'auto_applied' | 'manually_applied';

/**
 * Strict, non-adjustable confidence floor for automatic posting.
 * Anything below this routes to review — accounting safety is not a tunable.
 */
export const AUTO_CONFIDENCE_THRESHOLD = 0.9;

/** Global billing setting key: automatically apply high-confidence scanned checks. */
export const AUTO_APPLY_SETTING_KEY = 'billing_auto_apply_checks';

export const INTAKE_STATUS_LABEL: Record<string, string> = {
  review_needed: 'Review needed',
  applied: 'Applied',
  voided: 'Voided',
};

export const INTAKE_STATUS_CLASS: Record<string, string> = {
  review_needed: 'bg-amber-100 text-amber-900',
  applied: 'bg-green-100 text-green-800',
  voided: 'bg-muted text-muted-foreground line-through',
};

/** Reads the "auto apply high-confidence checks" setting (defaults to ON). */
export async function fetchAutoApplyEnabled(): Promise<boolean> {
  const { data } = await db.from('app_settings')
    .select('value').eq('key', AUTO_APPLY_SETTING_KEY).maybeSingle();
  if (!data) return true;
  return String((data as any).value) !== 'false';
}

export async function setAutoApplyEnabled(enabled: boolean) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await db.from('app_settings').upsert({
    key: AUTO_APPLY_SETTING_KEY,
    value: enabled ? 'true' : 'false',
    description: 'Automatically apply high-confidence scanned checks without manual review',
    updated_by: userData?.user?.id ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'key' });
  if (error) throw error;
}

export interface OpenInvoice {
  id: string;
  invoice_number: string;
  customer_name: string | null;
  crm_company_id: string | null;
  total: number;
  balance_due: number;
  status: string;
}

export interface MatchLine {
  /** Invoice number exactly as printed on the stub (blank for manual adds). */
  raw: string;
  invoice: OpenInvoice | null;
  amount: string;
  /** matched = number resolved to an open invoice; unresolved = printed but not found. */
  source: 'stub' | 'manual';
}

/** Loose comparison so "INV-1042", "inv1042" and "1042" all match the same invoice. */
export const normalizeInvoiceNumber = (v: string) =>
  (v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^0+/, '');

/** Downscales a captured photo so uploads and AI calls stay small. */
export async function imageToDataUrl(file: File, max = 1800): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85);
}

const dataUrlToBlob = (dataUrl: string) => {
  const [head, body] = dataUrl.split(',');
  const mime = head.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
  const bytes = Uint8Array.from(atob(body), c => c.charCodeAt(0));
  return new Blob([bytes], { type: mime });
};

/** Uploads a check or stub photo to the private bucket and returns its path. */
export async function uploadCheckImage(intakeId: string, kind: 'check' | 'stub', dataUrl: string) {
  const path = `${intakeId}/${kind}.jpg`;
  const { error } = await supabase.storage
    .from(CHECK_BUCKET)
    .upload(path, dataUrlToBlob(dataUrl), { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  return path;
}

export async function signedCheckImageUrl(path: string, seconds = 600) {
  const { data, error } = await supabase.storage.from(CHECK_BUCKET).createSignedUrl(path, seconds);
  if (error) throw error;
  return data.signedUrl;
}

export async function fetchOpenInvoices(): Promise<OpenInvoice[]> {
  const { data, error } = await db
    .from('billing_invoices')
    .select('id, invoice_number, customer_name, crm_company_id, total, balance_due, status')
    .not('status', 'in', '("void","paid")')
    .order('invoice_date', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((i: any) => ({
    ...i, total: Number(i.total ?? 0), balance_due: Number(i.balance_due ?? 0),
  }));
}

/** Resolves stub invoice numbers against open invoices; unmatched lines stay flagged. */
export function matchStubInvoices(
  stubInvoices: { invoice_number: string; amount: string }[],
  invoices: OpenInvoice[],
): MatchLine[] {
  const byNumber = new Map<string, OpenInvoice>();
  invoices.forEach(i => byNumber.set(normalizeInvoiceNumber(i.invoice_number), i));
  return stubInvoices.map(s => {
    const hit = byNumber.get(normalizeInvoiceNumber(s.invoice_number)) ?? null;
    const amount = s.amount || (hit ? hit.balance_due.toFixed(2) : '');
    return { raw: s.invoice_number, invoice: hit, amount, source: 'stub' as const };
  });
}

/** Likely duplicate checks: same check number and amount, payer used as context. */
export async function findDuplicateChecks(checkNumber: string, amount: number) {
  if (!checkNumber.trim() || !amount) return [] as any[];
  const { data } = await db
    .from('billing_payments')
    .select('id, payer_name, amount, payment_date, reference_number')
    .eq('reference_number', checkNumber.trim());
  return (data ?? []).filter((p: any) => Math.abs(Number(p.amount) - amount) < 0.005);
}

export async function logIntakeEvent(intakeId: string, event: string, detail: Record<string, unknown> = {}) {
  const { data: userData } = await supabase.auth.getUser();
  await db.from('billing_check_intake_events').insert({
    intake_id: intakeId, event, detail, actor: userData?.user?.id ?? null,
  });
}

export interface IntakeDraft {
  id?: string;
  payer_name: string;
  crm_company_id: string | null;
  check_number: string;
  check_date: string | null;
  received_date: string;
  deposit_date: string | null;
  deposit_account_label: string | null;
  amount: number;
  check_image_path: string | null;
  stub_image_path: string | null;
  extraction: Record<string, unknown>;
  warnings: string[];
  proposed_allocations: { invoice_id: string | null; invoice_number: string; amount: number }[];
  notes: string | null;
}

/** Creates or updates a check intake row without touching invoice balances. */
export async function saveIntake(draft: IntakeDraft, status: IntakeStatus = 'review_needed') {
  const { data: userData } = await supabase.auth.getUser();
  const payload = {
    status,
    payer_name: draft.payer_name || null,
    crm_company_id: draft.crm_company_id,
    check_number: draft.check_number || null,
    check_date: draft.check_date || null,
    received_date: draft.received_date,
    deposit_date: draft.deposit_date,
    deposit_account_label: draft.deposit_account_label,
    amount: draft.amount,
    check_image_path: draft.check_image_path,
    stub_image_path: draft.stub_image_path,
    extraction: draft.extraction,
    warnings: draft.warnings,
    proposed_allocations: draft.proposed_allocations,
    notes: draft.notes,
  };

  if (draft.id) {
    const { data, error } = await db.from('billing_check_intakes')
      .upsert({ id: draft.id, ...payload, created_by: userData?.user?.id ?? null })
      .select().single();
    if (error) throw error;
    await logIntakeEvent(data.id, 'updated');
    return data;
  }
  const { data, error } = await db.from('billing_check_intakes')
    .insert({ ...payload, created_by: userData?.user?.id ?? null })
    .select().single();
  if (error) throw error;
  await logIntakeEvent(data.id, 'created');
  return data;
}

/** Posts the reviewed check: one payment plus allocations, then marks the intake applied. */
export async function applyIntake(draft: IntakeDraft) {
  const intake = await saveIntake(draft, 'review_needed');
  const allocations = draft.proposed_allocations
    .filter(a => a.invoice_id && a.amount > 0)
    .map(a => ({ invoice_id: a.invoice_id as string, amount: a.amount }));

  const payment = await recordPayment({
    crm_company_id: draft.crm_company_id,
    payer_name: draft.payer_name || null,
    payment_date: draft.received_date,
    amount: draft.amount,
    method: 'check',
    reference_number: draft.check_number || null,
    deposit_date: draft.deposit_date,
    deposit_account_label: draft.deposit_account_label,
    notes: draft.notes ?? 'Received through check intake',
  }, allocations);

  const { data: userData } = await supabase.auth.getUser();
  const { error } = await db.from('billing_check_intakes').update({
    status: 'applied',
    payment_id: payment.id,
    processed_by: userData?.user?.id ?? null,
    processed_at: new Date().toISOString(),
  }).eq('id', intake.id);
  if (error) throw error;

  await logIntakeEvent(intake.id, 'applied', {
    payment_id: payment.id, amount: draft.amount, allocations: allocations.length,
  });
  return { intake, payment };
}

export async function voidIntake(id: string, reason: string) {
  const { error } = await db.from('billing_check_intakes').update({ status: 'voided' }).eq('id', id);
  if (error) throw error;
  await logIntakeEvent(id, 'voided', { reason });
}
