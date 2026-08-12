const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MODELS = ['google/gemini-2.5-flash', 'google/gemini-2.0-flash-001', 'openai/gpt-4o-mini'];

const PROMPT = `You read scanned business checks and their remittance stubs.
Extract the payment details and reply with ONLY a JSON object, no markdown, using exactly these keys:
{"payer_name":"","check_number":"","check_date":"","amount":"","memo":"","invoices":[{"invoice_number":"","amount":""}]}
Rules:
- "check_date" must be YYYY-MM-DD if a date is visible, otherwise "".
- "amount" is the total check amount as a plain number string, e.g. "1250.00". Prefer the numeric courtesy amount; use the written line to disambiguate.
- "invoices" lists every invoice number found on the stub with the amount paid against it (plain number string, "" if unknown).
- Keep invoice numbers exactly as printed, including prefixes and leading zeros.
- Use empty strings for anything not present. Never invent data.`;

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
      return new Response(JSON.stringify({ error: 'A photo of the check is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let lastError = 'Could not read the check';
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
          : 'AI credits exhausted — add credits to keep scanning checks.';
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

      const str = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
      const invoices = Array.isArray(parsed.invoices)
        ? (parsed.invoices as Record<string, unknown>[])
            .map(i => ({ invoice_number: str(i?.invoice_number), amount: str(i?.amount) }))
            .filter(i => i.invoice_number)
        : [];

      return new Response(JSON.stringify({
        payer_name: str(parsed.payer_name),
        check_number: str(parsed.check_number),
        check_date: str(parsed.check_date),
        amount: str(parsed.amount),
        memo: str(parsed.memo),
        invoices,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: lastError }), {
      status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('scan-check-stub failed', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
