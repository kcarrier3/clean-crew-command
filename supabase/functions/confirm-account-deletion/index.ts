// Step 2 of account deletion: the one-time link from the confirmation email.
// The page posts the token here only after the person clicks the final button,
// so email link scanners opening the page can't delete anyone.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, svix-id, svix-timestamp, svix-signature, idempotency-key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
};
import { z } from 'https://esm.sh/zod@3.23.8';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const Body = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) });

const sha256Hex = async (s: string) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: 'This link is not valid.' }, 400);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    });

    // Claim the link atomically so it can only ever be used once.
    const { data: claimed, error: claimErr } = await admin.from('account_deletion_requests')
      .update({ status: 'processing', used_at: new Date().toISOString() })
      .eq('token_hash', await sha256Hex(parsed.data.token))
      .eq('status', 'pending')
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .select('id, user_id')
      .maybeSingle();
    if (claimErr) {
      console.error('claim failed', claimErr);
      return json({ error: 'Something went wrong. Please try again.' }, 500);
    }
    if (!claimed) {
      return json({ error: 'This link has expired or was already used. Start again from Settings → Danger zone.' }, 410);
    }

    const { error: delErr } = await admin.rpc('delete_account_for_user', { _user_id: claimed.user_id });
    if (delErr) {
      console.error('delete_account_for_user failed', delErr);
      await admin.from('account_deletion_requests')
        .update({ status: 'failed', error_message: delErr.message.slice(0, 400) })
        .eq('id', claimed.id);
      return json({ error: 'Your account could not be deleted. Please contact your manager.' }, 500);
    }

    await admin.from('account_deletion_requests').update({ status: 'deleted' }).eq('id', claimed.id);
    return json({ ok: true });
  } catch (e) {
    console.error('confirm-account-deletion error', e);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
});
