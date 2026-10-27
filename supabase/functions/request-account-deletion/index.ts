// Step 1 of account deletion: re-check the signed-in user's password, then email
// a one-time confirmation link. Nothing is deleted here.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3.23.8';

const APP_URL = (Deno.env.get('APP_URL') || Deno.env.get('SITE_URL') || 'https://app.gosummitfacilities.com').replace(/\/$/, '');
// Auth emails use their own sender — never the billing sender.
const FROM_EMAIL = Deno.env.get('INVITE_FROM_EMAIL') || 'noreply@invites.crewcompass360.com';
const FROM_NAME = Deno.env.get('INVITE_FROM_NAME') || 'Crew Compass';
const LINK_TTL_MINUTES = 60;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const Body = z.object({ password: z.string().min(1).max(200) });

const sha256Hex = async (s: string) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
};

const emailHtml = (name: string, link: string) => `
<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#1f2937">
  <h2 style="color:#b91c1c">Confirm your account deletion</h2>
  <p>Hi${name ? ` ${name}` : ''},</p>
  <p>We received a request to permanently delete your Crew Compass account. If this was you, click the button below to finish.</p>
  <p style="margin:28px 0"><a href="${link}" style="background:#b91c1c;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold">Confirm deletion</a></p>
  <p>This link works once and expires in ${LINK_TTL_MINUTES} minutes. Deleting cannot be undone — you would need to be re-invited to get access again.</p>
  <p><strong>Didn't ask for this?</strong> Ignore this email and your account stays as it is. You may want to change your password.</p>
</div>`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Please sign in again.' }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (userErr || !user?.email) return json({ error: 'Please sign in again.' }, 401);

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: 'Enter your password.' }, 400);

    // Re-check the password with a throwaway client; the session it creates is discarded.
    const checker = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: pwErr } = await checker.auth.signInWithPassword({ email: user.email, password: parsed.data.password });
    if (pwErr) return json({ error: 'That password is not correct.' }, 403);

    if (!RESEND_API_KEY) return json({ error: 'Email sending is not set up, so deletion cannot be confirmed.' }, 503);

    // Only the newest link should work.
    await admin.from('account_deletion_requests')
      .update({ status: 'superseded' })
      .eq('user_id', user.id).eq('status', 'pending');

    const raw = crypto.getRandomValues(new Uint8Array(32));
    const rawToken = [...raw].map(b => b.toString(16).padStart(2, '0')).join('');
    const expiresAt = new Date(Date.now() + LINK_TTL_MINUTES * 60_000).toISOString();

    const { data: row, error: insErr } = await admin.from('account_deletion_requests').insert({
      user_id: user.id, email: user.email, token_hash: await sha256Hex(rawToken), expires_at: expiresAt,
    }).select('id').single();
    if (insErr || !row) {
      console.error('deletion request insert failed', insErr);
      return json({ error: 'Could not start the deletion request.' }, 500);
    }

    const { data: profile } = await admin.from('profiles').select('first_name').eq('id', user.id).maybeSingle();
    const link = `${APP_URL}/confirm-account-deletion?token=${rawToken}`;

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `acct-del-${row.id}` },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [user.email],
        subject: 'Confirm your Crew Compass account deletion',
        html: emailHtml(profile?.first_name ?? '', link),
        text: `Confirm deleting your Crew Compass account: ${link}\n\nThis link works once and expires in ${LINK_TTL_MINUTES} minutes. If you didn't ask for this, ignore this email.`,
        tags: [{ name: 'category', value: 'account_deletion' }],
      }),
    });
    const body = await r.text();
    if (!r.ok) {
      console.error(`Resend deletion email failed [${r.status}]: ${body}`);
      await admin.from('account_deletion_requests')
        .update({ status: 'failed', error_message: `Email provider error ${r.status}: ${body.slice(0, 400)}` })
        .eq('id', row.id);
      return json({ error: `The confirmation email could not be sent (provider error ${r.status}).` }, 502);
    }
    let messageId: string | null = null;
    try { messageId = JSON.parse(body).id ?? null; } catch { /* ignore */ }
    await admin.from('account_deletion_requests').update({ provider_message_id: messageId }).eq('id', row.id);

    return json({ ok: true, email: user.email, expiresInMinutes: LINK_TTL_MINUTES });
  } catch (e) {
    console.error('request-account-deletion error', e);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
});
