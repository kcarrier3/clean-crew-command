// Crew Compass — external assistant intake API.
// Authenticated server-side endpoint used by an authorized external assistant
// (e.g. a ChatGPT action) to search Waypoint opportunities and create estimates
// using the same production tables as the in-app estimator.
//
// See docs/assistant-api.md for the request/response contract.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const JSON_HEADERS = { ...corsHeaders, 'Content-Type': 'application/json' };
const SOURCE = 'chatgpt_assistant';

type Json = Record<string, unknown>;

function json(body: Json, status = 200) {
  return new Response(JSON.stringify(body), { headers: JSON_HEADERS, status });
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const num = (v: unknown, fallback = 0) => {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : fallback;
};

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

const SERVICE_TYPES = [
  'janitorial', 'construction_cleaning', 'carpet_cleaning', 'floor_scrubbing', 'vct_strip_wax',
];

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

/** Resolve the caller: either an assistant API key, or a signed-in staff JWT. */
async function authenticate(req: Request) {
  const header = req.headers.get('authorization') ?? '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) return { error: 'Missing Authorization bearer token' };

  // 1) Assistant API key (opaque secret issued per integration).
  const hash = await sha256Hex(token);
  const { data: client } = await admin
    .from('assistant_api_clients')
    .select('id,label,actor_user_id,enabled')
    .eq('key_hash', hash)
    .maybeSingle();

  if (client) {
    if (!client.enabled) return { error: 'Assistant client is disabled' };
    return { clientId: client.id as string, actorUserId: client.actor_user_id as string, label: client.label as string };
  }

  // 2) Fall back to a staff Supabase JWT (useful for testing from the app).
  const { data: userData } = await admin.auth.getUser(token);
  if (!userData?.user) return { error: 'Invalid credentials' };
  return { clientId: null, actorUserId: userData.user.id, label: 'staff-jwt' };
}

/** Only staff who may estimate can act as the assistant's actor. */
async function assertActorAllowed(actorUserId: string) {
  const { data, error } = await admin.rpc('can_estimate', { _user_id: actorUserId });
  if (error) return `Permission check failed: ${error.message}`;
  if (!data) return 'The configured actor user is not allowed to create estimates';
  return null;
}

async function searchOpportunities(body: Json) {
  const name = str(body.opportunity_name) ?? str(body.account_name) ?? str(body.name);
  const city = str(body.city);
  const state = str(body.state);
  const id = str(body.opportunity_id);
  const limit = Math.min(Math.max(num(body.limit, 10), 1), 25);

  let query = admin
    .from('crm_leads')
    .select('id,name,company_name,city:company_id,status,stage_id,company_id,amount,created_at')
    .limit(limit);

  if (id) query = query.eq('id', id);
  else if (name) query = query.or(`name.ilike.%${name}%,company_name.ilike.%${name}%`);
  else return { error: 'Provide opportunity_id, opportunity_name or account_name' };

  const { data, error } = await query;
  if (error) return { error: error.message };

  let rows = (data ?? []) as any[];

  // Location filter resolves through the linked account record.
  if ((city || state) && rows.length) {
    const companyIds = [...new Set(rows.map(r => r.company_id).filter(Boolean))];
    const { data: companies } = companyIds.length
      ? await admin.from('crm_companies').select('id,name,city,state').in('id', companyIds)
      : { data: [] as any[] };
    const byId = new Map((companies ?? []).map(c => [c.id, c]));
    rows = rows.filter(r => {
      const c = byId.get(r.company_id);
      if (!c) return false;
      if (city && (c.city ?? '').toLowerCase() !== city.toLowerCase()) return false;
      if (state && (c.state ?? '').toLowerCase() !== state.toLowerCase()) return false;
      return true;
    });
    return {
      matches: rows.map(r => ({
        opportunity_id: r.id,
        opportunity_name: r.name ?? r.company_name,
        account_id: r.company_id,
        account_name: byId.get(r.company_id)?.name ?? r.company_name,
        city: byId.get(r.company_id)?.city ?? null,
        state: byId.get(r.company_id)?.state ?? null,
        status: r.status,
        amount: r.amount,
      })),
    };
  }

  const companyIds = [...new Set(rows.map(r => r.company_id).filter(Boolean))];
  const { data: companies } = companyIds.length
    ? await admin.from('crm_companies').select('id,name,city,state').in('id', companyIds)
    : { data: [] as any[] };
  const byId = new Map((companies ?? []).map(c => [c.id, c]));

  return {
    matches: rows.map(r => ({
      opportunity_id: r.id,
      opportunity_name: r.name ?? r.company_name,
      account_id: r.company_id,
      account_name: byId.get(r.company_id)?.name ?? r.company_name,
      city: byId.get(r.company_id)?.city ?? null,
      state: byId.get(r.company_id)?.state ?? null,
      status: r.status,
      amount: r.amount,
    })),
  };
}

async function createEstimate(body: Json, actorUserId: string, clientLabel: string) {
  const serviceTypeRaw = str(body.service_type) ?? 'janitorial';
  const serviceType = SERVICE_TYPES.includes(serviceTypeRaw) ? serviceTypeRaw : 'janitorial';

  // --- Resolve exactly one opportunity -------------------------------------
  const lookup = await searchOpportunities({
    opportunity_id: body.opportunity_id,
    opportunity_name: body.opportunity_name,
    account_name: body.account_name,
    city: body.city,
    state: body.state,
    limit: 25,
  });
  if ('error' in lookup) return { status: 400, payload: { error: lookup.error } };
  const matches = lookup.matches!;
  if (matches.length === 0) {
    return { status: 404, payload: { error: 'no_match', message: 'No opportunity matched the provided criteria', matches: [] } };
  }
  if (matches.length > 1) {
    return {
      status: 409,
      payload: {
        error: 'ambiguous_match',
        message: `${matches.length} opportunities matched; pass opportunity_id to disambiguate`,
        matches,
      },
    };
  }
  const opp = matches[0];

  // --- Create estimate ------------------------------------------------------
  const title = str(body.title) ?? `${opp.account_name ?? opp.opportunity_name} — Estimate`;
  const notes = str(body.notes) ?? str(body.description);

  const { data: est, error: estErr } = await admin
    .from('estimates')
    .insert({
      name: title,
      lead_id: opp.opportunity_id,
      company_id: opp.account_id ?? null,
      status: 'draft',
      service_type: serviceType,
      created_by: actorUserId,
      owner_id: actorUserId,
      source: SOURCE,
      source_metadata: {
        client: clientLabel,
        description: str(body.description),
        source_file: body.source_file ?? null,
      },
    })
    .select('id,name')
    .single();
  if (estErr || !est) return { status: 500, payload: { error: estErr?.message ?? 'Failed to create estimate' } };

  const revisionPayload: Json = {
    estimate_id: est.id,
    revision_number: 1,
    status: 'draft',
    service_type: serviceType,
    created_by: actorUserId,
    notes,
  };
  if (body.square_feet !== undefined) revisionPayload.square_feet = num(body.square_feet);
  if (body.specialty_inputs && typeof body.specialty_inputs === 'object') {
    revisionPayload.specialty_inputs = body.specialty_inputs;
  }

  const { data: rev, error: revErr } = await admin
    .from('estimate_revisions')
    .insert(revisionPayload)
    .select('id')
    .single();
  if (revErr || !rev) {
    await admin.from('estimates').delete().eq('id', est.id);
    return { status: 500, payload: { error: revErr?.message ?? 'Failed to create estimate revision' } };
  }

  await admin.from('estimates').update({ current_revision_id: rev.id }).eq('id', est.id);

  // --- Line items -----------------------------------------------------------
  const rawItems = Array.isArray(body.line_items) ? body.line_items : [];
  const lineItems = rawItems.map((raw: any, i: number) => {
    const quantity = num(raw?.quantity, 1);
    const rate = num(raw?.rate ?? raw?.unit_price, 0);
    const hours = num(raw?.hours, 0);
    const amount = raw?.amount !== undefined ? num(raw.amount) : quantity * rate;
    return {
      revision_id: rev.id,
      kind: str(raw?.kind) ?? 'other',
      description: str(raw?.description) ?? `Line ${i + 1}`,
      hours,
      cost: num(raw?.cost, 0),
      price: amount,
      frequency: str(raw?.frequency) ?? 'monthly',
      sort_order: i,
    };
  });

  let insertedItems: any[] = [];
  if (lineItems.length) {
    const { data, error } = await admin.from('estimate_line_adders').insert(lineItems).select('id,description,price');
    if (error) return { status: 500, payload: { error: `Estimate created but line items failed: ${error.message}`, estimate_id: est.id } };
    insertedItems = data ?? [];
  }

  const total = insertedItems.reduce((s, l) => s + Number(l.price ?? 0), 0);

  return {
    status: 201,
    payload: {
      ok: true,
      estimate_id: est.id,
      revision_id: rev.id,
      line_item_ids: insertedItems.map(l => l.id),
      opportunity_id: opp.opportunity_id,
      account_id: opp.account_id,
      source: SOURCE,
      summary: `Created draft ${serviceType.replace(/_/g, ' ')} estimate "${est.name}" on opportunity "${opp.opportunity_name}" with ${insertedItems.length} line item(s) totaling $${total.toFixed(2)}.`,
      url_path: `/estimating/${est.id}`,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const auth = await authenticate(req);
  if ('error' in auth) return json({ error: auth.error }, 401);
  const { clientId, actorUserId, label } = auth as { clientId: string | null; actorUserId: string; label: string };

  const permError = await assertActorAllowed(actorUserId);
  if (permError) return json({ error: permError }, 403);

  let body: Json;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const action = str(body.action);
  if (!action || !['search_opportunities', 'create_estimate'].includes(action)) {
    return json({ error: "action must be 'search_opportunities' or 'create_estimate'" }, 400);
  }

  if (clientId) {
    await admin.from('assistant_api_clients').update({ last_used_at: new Date().toISOString() }).eq('id', clientId);
  }

  // Read action: no idempotency bookkeeping needed.
  if (action === 'search_opportunities') {
    const result = await searchOpportunities(body);
    if ('error' in result) return json({ error: result.error }, 400);
    return json({ ok: true, count: result.matches!.length, matches: result.matches });
  }

  // Write action: idempotency + audit.
  const idempotencyKey = req.headers.get('x-idempotency-key') ?? str(body.idempotency_key);

  if (idempotencyKey) {
    const { error: reserveErr } = await admin.from('assistant_request_log').insert({
      client_id: clientId,
      actor_user_id: actorUserId,
      source: SOURCE,
      action,
      idempotency_key: idempotencyKey,
      status: 'in_progress',
      request_payload: body,
    });
    if (reserveErr) {
      if (reserveErr.code === '23505') {
        const { data: prior } = await admin
          .from('assistant_request_log')
          .select('status,response_payload')
          .eq('action', action)
          .eq('idempotency_key', idempotencyKey)
          .maybeSingle();
        if (prior?.status === 'succeeded') {
          return json({ ...(prior.response_payload as Json), idempotent_replay: true }, 200);
        }
        return json({ error: 'A request with this idempotency key is already in progress' }, 409);
      }
      return json({ error: reserveErr.message }, 500);
    }
  }

  const result = await createEstimate(body, actorUserId, label);
  const ok = result.status < 400;

  const logRow = {
    client_id: clientId,
    actor_user_id: actorUserId,
    source: SOURCE,
    action,
    idempotency_key: idempotencyKey,
    status: ok ? 'succeeded' : 'failed',
    request_payload: body,
    response_payload: result.payload,
    created_record_ids: ok
      ? {
          estimate_id: (result.payload as any).estimate_id,
          revision_id: (result.payload as any).revision_id,
          line_item_ids: (result.payload as any).line_item_ids,
        }
      : null,
    error_message: ok ? null : String((result.payload as any).error ?? ''),
  };

  if (idempotencyKey) {
    if (ok) {
      await admin.from('assistant_request_log').update(logRow)
        .eq('action', action).eq('idempotency_key', idempotencyKey);
    } else {
      // Failures release the key so the assistant can retry cleanly.
      await admin.from('assistant_request_log').delete()
        .eq('action', action).eq('idempotency_key', idempotencyKey);
      await admin.from('assistant_request_log').insert({ ...logRow, idempotency_key: null });
    }
  } else {
    await admin.from('assistant_request_log').insert(logRow);
  }

  return json(result.payload as Json, result.status);
});
