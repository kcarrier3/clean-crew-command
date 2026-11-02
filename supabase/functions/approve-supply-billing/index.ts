// Weekly supply billing: preview last week's supply drop-offs per account, hold/remove items,
// and on Approve create one invoice per account and email it to the billing address on file.
// Callers need the approve_supply_billing permission or full billing access. Everything here
// is limited to supply drop-off items; no other billing data is read or changed for the caller.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'npm:zod@3';
import { COMPANY_NAME } from '../_shared/company.ts';
import {
  DEFAULT_INVOICE_BODY, DEFAULT_INVOICE_SUBJECT, INVOICE_PDF_BUCKET,
  deliverInvoiceEmail, isEmail, renderTemplate,
} from '../_shared/invoiceEmail.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => new Date(`${s}T12:00:00Z`).getUTCDay() === 0, 'Week must start on a Sunday');
const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('preview'), weekStart: day }),
  z.object({ action: z.literal('approve'), weekStart: day, eventIds: z.array(z.string().uuid()).min(1).max(1000) }),
  z.object({ action: z.literal('send'), invoiceId: z.string().uuid(), pdfBase64: z.string().min(100).max(12_000_000) }),
  z.object({ action: z.literal('hold'), eventId: z.string().uuid(), reason: z.string().trim().min(1).max(500) }),
  z.object({ action: z.literal('release'), eventId: z.string().uuid() }),
  z.object({ action: z.literal('remove'), eventId: z.string().uuid() }),
]);

const money = (n: unknown) =>
  `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const todayNY = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

const addDays = (d: string, n: number) => {
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

const prettyDay = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

// deno-lint-ignore no-explicit-any
type Admin = any;

interface Group {
  job_site_id: string;
  account_name: string;
  billing_email: string | null;
  crm_company_id: string | null;
  skip_reason: string | null;
  tax_note: string | null;
  // deno-lint-ignore no-explicit-any
  events: any[];
}

const buildPreview = async (admin: Admin, weekStart: string): Promise<Group[]> => {
  const { data: events, error } = await admin.rpc('supply_billing_week_events', { _week_start: weekStart });
  if (error) throw new Error(error.message);
  // deno-lint-ignore no-explicit-any
  const rows = (events ?? []) as any[];
  const siteIds = [...new Set(rows.map(r => r.job_site_id).filter(Boolean))] as string[];
  if (!siteIds.length) return [];

  const { data: sites } = await admin.from('job_sites')
    .select('id, name, client_name, billing_email, crm_company_id').in('id', siteIds);
  // deno-lint-ignore no-explicit-any
  const siteMap = new Map<string, any>((sites ?? []).map((s: any) => [s.id, s]));
  const companyIds = [...new Set((sites ?? []).map((s: { crm_company_id: string | null }) => s.crm_company_id).filter(Boolean))];
  const prefsMap = new Map<string, string>();
  if (companyIds.length) {
    const { data: prefs } = await admin.from('billing_account_preferences')
      .select('crm_company_id, primary_billing_email').in('crm_company_id', companyIds);
    for (const p of prefs ?? []) if (p.primary_billing_email) prefsMap.set(p.crm_company_id, p.primary_billing_email);
  }

  const invoiceDate = todayNY();
  const groups: Group[] = [];
  for (const siteId of siteIds) {
    const site = siteMap.get(siteId);
    const evs = rows.filter(r => r.job_site_id === siteId);
    const ready = evs.filter(e => e.status === 'ready');
    const email = (site?.crm_company_id && prefsMap.get(site.crm_company_id))
      || ready.find(e => e.billing_email)?.billing_email || site?.billing_email || null;

    let skip: string | null = null;
    let taxNote: string | null = null;
    if (!email || !isEmail(String(email).trim())) {
      skip = 'No billing email on file';
    } else {
      const { data: tax } = await admin.rpc('billing_resolve_tax', {
        _job_site_id: siteId, _crm_company_id: site?.crm_company_id ?? null, _on: invoiceDate,
      });
      const t = Array.isArray(tax) ? tax[0] : tax;
      if (t?.needs_review) skip = `Sales tax needs review: ${t.review_reason ?? 'check the account county'}`;
      else if (t?.exempt) taxNote = 'Tax exempt';
      else if (t) taxNote = `${t.jurisdiction ?? 'Sales tax'} ${Number(t.rate || 0).toFixed(2)}%`;
    }
    groups.push({
      job_site_id: siteId,
      account_name: site?.client_name || site?.name || 'Account',
      billing_email: email,
      crm_company_id: site?.crm_company_id ?? null,
      skip_reason: skip,
      tax_note: taxNote,
      events: evs.map(e => ({
        id: e.id, label: e.label, description: e.description, amount: Number(e.amount || 0),
        status: e.status, hold_reason: e.hold_reason, completed_at: e.completed_at,
      })),
    });
  }
  return groups.sort((a, b) => a.account_name.localeCompare(b.account_name));
};

/** Returns an editable supply event, or null. Never touches other billing items. */
const supplyEvent = async (admin: Admin, id: string) => {
  const { data } = await admin.from('billing_events')
    .select('id, status, source, invoice_id').eq('id', id).maybeSingle();
  if (!data || data.source !== 'supply_usage' || data.invoice_id || data.status === 'invoiced') return null;
  return data;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: 'Not signed in' }, 401);

    const [{ data: perm }, { data: billing }] = await Promise.all([
      userClient.rpc('has_permission', { _user_id: user.id, _permission: 'approve_supply_billing' }),
      userClient.rpc('can_manage_billing', { _user_id: user.id }),
    ]);
    if (!perm && !billing) return json({ error: 'You do not have permission to approve supply billing' }, 403);

    let raw: unknown = {};
    try { raw = await req.json(); } catch { raw = {}; }
    const parsed = Body.safeParse(raw);
    if (!parsed.success) return json({ error: 'Invalid request', details: parsed.error.flatten() }, 400);
    const input = parsed.data;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    if (input.action === 'preview') {
      return json({ weekStart: input.weekStart, weekEnd: addDays(input.weekStart, 6), groups: await buildPreview(admin, input.weekStart) });
    }

    if (input.action === 'hold' || input.action === 'release' || input.action === 'remove') {
      const ev = await supplyEvent(admin, input.eventId);
      if (!ev) return json({ error: 'That item is not an open supply drop-off' }, 404);
      const patch = input.action === 'hold'
        ? { status: 'hold', hold_reason: input.reason, hold_at: new Date().toISOString(), hold_by: user.id }
        : input.action === 'release'
          ? { status: 'ready', hold_reason: null, hold_at: null, hold_by: null }
          : { status: 'cancelled' };
      const { error } = await admin.from('billing_events').update(patch).eq('id', ev.id).is('invoice_id', null);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (input.action === 'approve') {
      const groups = await buildPreview(admin, input.weekStart);
      const wanted = new Set(input.eventIds);
      const note = `Supplies delivered ${prettyDay(input.weekStart)} – ${prettyDay(addDays(input.weekStart, 6))}`;
      const created: unknown[] = [];
      const skipped: { account_name: string; reason: string }[] = [];
      for (const g of groups) {
        const ids = g.events.filter(e => e.status === 'ready' && wanted.has(e.id)).map(e => e.id);
        if (!ids.length) continue;
        if (g.skip_reason) { skipped.push({ account_name: g.account_name, reason: g.skip_reason }); continue; }
        const { data: invoiceId, error } = await admin.rpc('create_supply_week_invoice', {
          _job_site_id: g.job_site_id, _event_ids: ids, _invoice_date: todayNY(), _note: note, _created_by: user.id,
        });
        if (error) { skipped.push({ account_name: g.account_name, reason: error.message }); continue; }
        if (!invoiceId) { skipped.push({ account_name: g.account_name, reason: 'Already billed' }); continue; }
        const [{ data: inv }, { data: items }] = await Promise.all([
          admin.from('billing_invoices').select('*').eq('id', invoiceId).single(),
          admin.from('billing_invoice_items').select('description, quantity, unit_price, line_total, sort_order')
            .eq('invoice_id', invoiceId).order('sort_order'),
        ]);
        created.push({ invoice: inv, items: items ?? [], account_name: g.account_name });
      }
      return json({ created, skipped });
    }

    // ---- send ---------------------------------------------------------------
    const { data: invoice } = await admin.from('billing_invoices').select('*').eq('id', input.invoiceId).maybeSingle();
    if (!invoice || invoice.created_via !== 'supply_week') return json({ error: 'Not a weekly supply invoice' }, 404);
    if (invoice.tax_status === 'needs_review') {
      return json({ ok: false, error: `Sales tax needs review: ${invoice.tax_review_reason ?? ''}`.trim() }, 409);
    }
    const { data: prior } = await admin.from('billing_email_messages')
      .select('id, status').eq('invoice_id', invoice.id).in('status', ['queued', 'sent', 'delivered', 'opened', 'clicked']).limit(1);
    if (prior?.length || invoice.status === 'sent') return json({ ok: true, duplicate: true });
    if (invoice.status !== 'ready') return json({ ok: false, error: `Invoice is ${invoice.status}` }, 409);

    let prefs: { primary_billing_email?: string; additional_recipients?: string[]; cc_recipients?: string[]; billing_contact_name?: string } | null = null;
    if (invoice.crm_company_id) {
      const { data } = await admin.from('billing_account_preferences')
        .select('primary_billing_email, additional_recipients, cc_recipients, billing_contact_name')
        .eq('crm_company_id', invoice.crm_company_id).maybeSingle();
      prefs = data ?? null;
    }
    const to = [...new Set([prefs?.primary_billing_email || invoice.billing_email || '', ...(prefs?.additional_recipients ?? [])]
      .map(s => String(s).trim()).filter(isEmail))];
    const cc = (prefs?.cc_recipients ?? []).map(s => String(s).trim()).filter(isEmail);
    if (!to.length) return json({ ok: false, error: 'No billing email on file' }, 409);

    // Store the PDF the browser generated, so the email can attach and link it.
    let bytes: Uint8Array;
    try {
      const bin = atob(input.pdfBase64);
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } catch {
      return json({ error: 'Invalid PDF data' }, 400);
    }
    if (String.fromCharCode(...bytes.slice(0, 4)) !== '%PDF') return json({ error: 'Invalid PDF data' }, 400);
    const path = `${invoice.id}/Invoice-${invoice.invoice_number}.pdf`;
    const { error: upErr } = await admin.storage.from(INVOICE_PDF_BUCKET)
      .upload(path, bytes, { contentType: 'application/pdf', upsert: true });
    if (upErr) return json({ ok: false, error: `Could not store the invoice PDF: ${upErr.message}` }, 500);
    await admin.from('billing_invoices').update({ pdf_path: path, generated_at: new Date().toISOString() }).eq('id', invoice.id);

    let siteName: string | null = null;
    if (invoice.job_site_id) {
      const { data } = await admin.from('job_sites').select('name').eq('id', invoice.job_site_id).maybeSingle();
      siteName = data?.name ?? null;
    }
    const { data: tpl } = await admin.from('billing_email_templates')
      .select('subject, body').eq('key', 'invoice_default').maybeSingle();
    const contact = prefs?.billing_contact_name || invoice.billing_contact_name || '';
    const vars: Record<string, string> = {
      invoice_number: invoice.invoice_number ?? '',
      customer_name: invoice.customer_name ?? siteName ?? '',
      billing_contact_first_name: contact.split(' ')[0] || 'there',
      invoice_total: money(invoice.total),
      invoice_date: invoice.invoice_date ?? '',
      due_date: invoice.due_date ?? '',
      po_number: invoice.po_number?.trim() || '',
      project_name: siteName ?? '',
      company_name: COMPANY_NAME,
      company_contact: COMPANY_NAME,
      amount: money(invoice.total),
    };
    const subject = renderTemplate(tpl?.subject || DEFAULT_INVOICE_SUBJECT, vars);
    const body = renderTemplate(tpl?.body || DEFAULT_INVOICE_BODY, vars);

    const result = await deliverInvoiceEmail(admin, {
      invoice, to, cc, subject, body, attachmentPath: path,
      idempotencyKey: `supply-week-${invoice.id}-${Date.now()}`,
      templateKey: 'invoice_default',
      createdBy: user.id,
    });
    return json({ ...result.body, to }, result.status);
  } catch (e) {
    console.error('approve-supply-billing failed:', (e as Error).message);
    return json({ error: (e as Error).message }, 500);
  }
});
