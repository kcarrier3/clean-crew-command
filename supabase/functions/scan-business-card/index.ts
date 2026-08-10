const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MODELS = ['google/gemini-2.5-flash', 'google/gemini-2.0-flash-001', 'openai/gpt-4o-mini'];

const PROMPT = `You read business cards. Extract the details from this business card image and reply with ONLY a JSON object, no markdown, using exactly these keys:
{"first_name":"","last_name":"","title":"","company_name":"","email":"","phone":"","mobile":"","website":"","address":"","city":"","state":"","zip":"","notes":""}
Use empty strings for anything not present. Never invent data. "notes" may hold extra text printed on the card.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const key = Deno.env.get('LOVABLE_API_KEY');
    if (!key) {
      return new Response(JSON.stringify({ error: 'AI is not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { image } = await req.json();
    if (!image || typeof image !== 'string' || !image.startsWith('data:image/')) {
      return new Response(JSON.stringify({ error: 'A business card image is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let lastError = 'Could not read the card';
    for (const model of MODELS) {
      const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Lovable-API-Key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: PROMPT },
              { type: 'image_url', image_url: { url: image } },
            ],
          }],
        }),
      });

      if (res.status === 429 || res.status === 402) {
        const msg = res.status === 429
          ? 'AI rate limit reached — please try again in a moment.'
          : 'AI credits exhausted — add credits to keep scanning cards.';
        return new Response(JSON.stringify({ error: msg }), {
          status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!res.ok) {
        lastError = await res.text();
        console.error('gateway error', model, res.status, lastError);
        continue;
      }

      const json = await res.json();
      const text: string = json?.choices?.[0]?.message?.content ?? '';
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) { lastError = 'Model returned no JSON'; continue; }

      let parsed: Record<string, unknown>;
      try { parsed = JSON.parse(match[0]); } catch { lastError = 'Model returned invalid JSON'; continue; }

      const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
      return new Response(JSON.stringify({
        first_name: str(parsed.first_name), last_name: str(parsed.last_name), title: str(parsed.title),
        company_name: str(parsed.company_name), email: str(parsed.email),
        phone: str(parsed.phone) || str(parsed.mobile), website: str(parsed.website),
        address: str(parsed.address), city: str(parsed.city), state: str(parsed.state),
        zip: str(parsed.zip), notes: str(parsed.notes),
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: lastError }), {
      status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('scan-business-card failed', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});