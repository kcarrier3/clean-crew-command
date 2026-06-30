import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BodySchema = z.object({
  userId: z.string().uuid(),
  mode: z.enum(['set', 'link']),
  newPassword: z.string().min(8).max(128).optional(),
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json(401, { error: 'Missing auth' });

    // Verify caller
    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await caller.auth.getUser();
    if (userErr || !userData?.user) return json(401, { error: 'Not authenticated' });
    const callerId = userData.user.id;

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Authorize: admin role OR Owner/Administrator job title
    const { data: roleRow } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', callerId)
      .eq('role', 'admin')
      .maybeSingle();
    let authorized = !!roleRow;
    if (!authorized) {
      const { data: prof } = await admin
        .from('profiles')
        .select('job_title')
        .eq('id', callerId)
        .maybeSingle();
      authorized = prof?.job_title === 'Owner' || prof?.job_title === 'Administrator';
    }
    if (!authorized) return json(403, { error: 'Not authorized' });

    let body;
    try { body = await req.json(); } catch { return json(400, { error: 'Invalid JSON' }); }
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) return json(400, { error: 'Invalid input', details: parsed.error.errors });
    const { userId, mode, newPassword } = parsed.data;

    // Look up target user email
    const { data: targetUser, error: getErr } = await admin.auth.admin.getUserById(userId);
    if (getErr || !targetUser?.user) return json(404, { error: 'User not found' });
    const email = targetUser.user.email;
    if (!email) return json(400, { error: 'Target user has no email' });

    // Prevent demoting/resetting Owner unless caller is the owner themselves
    const { data: targetProfile } = await admin
      .from('profiles')
      .select('job_title')
      .eq('id', userId)
      .maybeSingle();
    if (targetProfile?.job_title === 'Owner' && callerId !== userId) {
      return json(403, { error: 'Owner password can only be reset by the Owner themselves.' });
    }

    if (mode === 'set') {
      if (!newPassword) return json(400, { error: 'newPassword required' });
      const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
        password: newPassword,
      });
      if (updErr) return json(400, { error: updErr.message });
      // Mark email as confirmed so they can log in without confirmation
      if (!targetUser.user.email_confirmed_at) {
        await admin.auth.admin.updateUserById(userId, { email_confirm: true });
      }
      return json(200, { ok: true });
    }

    // mode === 'link'
    const siteUrl = Deno.env.get('SITE_URL') || 'https://clean-crew-command.lovable.app';
    const redirectTo = `${siteUrl}/reset-password`;
    const { error: linkErr } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo },
    });
    if (linkErr) return json(400, { error: linkErr.message });
    return json(200, { ok: true });
  } catch (err) {
    console.error('admin-reset-password error', err);
    return json(500, { error: (err as Error).message });
  }
});