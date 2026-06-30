import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_SUBMISSIONS_PER_HOUR = 5;

async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip + (Deno.env.get('SUPABASE_JWKS') ?? 'salt'));
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 255;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return new Response(JSON.stringify({ error: 'Invalid body' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Honeypot - bots fill hidden fields
    if (body.website || body.fax) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const company_name = String(body.company_name ?? '').trim().slice(0, 200);
    const contact_name = body.contact_name ? String(body.contact_name).trim().slice(0, 150) : null;
    const email = body.email ? String(body.email).trim().toLowerCase().slice(0, 255) : null;
    const phone = body.phone ? String(body.phone).trim().slice(0, 40) : null;
    const notes = body.notes ? String(body.notes).trim().slice(0, 2000) : null;
    const source = body.source ? String(body.source).trim().slice(0, 80) : 'Website';

    if (!company_name) {
      return new Response(JSON.stringify({ error: 'Company name is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!email && !phone) {
      return new Response(JSON.stringify({ error: 'Provide an email or phone number' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (email && !isEmail(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const ip_hash = await hashIp(ip);
    const ua = req.headers.get('user-agent')?.slice(0, 300) ?? null;
    const referrer = req.headers.get('referer')?.slice(0, 500) ?? null;

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Rate limit: count submissions in the last hour for this ip hash
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await admin
      .from('crm_lead_submission_log')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', ip_hash)
      .gte('created_at', oneHourAgo);

    if ((count ?? 0) >= MAX_SUBMISSIONS_PER_HOUR) {
      return new Response(JSON.stringify({ error: 'Too many submissions, please try again later.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: insertError } = await admin.from('crm_leads').insert({
      company_name,
      contact_name,
      email,
      phone,
      source,
      status: 'new',
      notes,
      source_metadata: { ip_hash, user_agent: ua, referrer, submitted_at: new Date().toISOString() },
    });

    if (insertError) {
      console.error('Insert failed', insertError);
      return new Response(JSON.stringify({ error: 'Could not save submission' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await admin.from('crm_lead_submission_log').insert({ ip_hash });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('submit-lead error', err);
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});