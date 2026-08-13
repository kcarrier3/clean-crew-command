const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MODELS = ['google/gemini-2.5-flash', 'google/gemini-2.0-flash-001', 'openai/gpt-4o-mini'];

const CHECK_PROMPT = `You read photos of business checks for accounts-receivable posting.
Reply with ONLY a JSON object, no markdown, using exactly these keys:
{"payer_name":"","check_number":"","check_date":"","amount":"","memo":"","confidence":{"payer_name":0,"check_number":0,"check_date":0,"amount":0},"warnings":[]}
Rules:
- "check_date" must be YYYY-MM-DD if a date is visible, otherwise "".
- "amount" is the total check amount as a plain number string, e.g. "1250.00". Prefer the numeric courtesy amount; use the written line to disambiguate, and add a warning if they disagree.
- Each confidence value is a number from 0 to 1.
- NEVER return the MICR line, bank routing number, or bank account number. Ignore them entirely.
- "warnings" lists short plain-English notes about anything unclear or unreadable.
- Use empty strings for anything not present. Never invent data.`;

const STUB_PROMPT = `You read remittance advice / check stubs for accounts-receivable posting.
Reply with ONLY a JSON object, no markdown, using exactly these keys:
{"payer_name":"","reference_text":"","invoices":[{"invoice_number":"","amount":""}],"confidence":{"invoices":0},"warnings":[]}
Rules:
- "invoices" lists every invoice number found with the amount paid against it (plain number string, "" if unknown).
- Keep invoice numbers exactly as printed, including prefixes and leading zeros.
- "reference_text" is any other remittance/reference note printed on the stub.
- NEVER return bank routing or account numbers.
- Use empty strings for anything not present. Never invent data.`;

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
const num = (v: unknown) => (typeof v === 'number' && v >= 0 && v <= 1 ? v : 0);

async function readImage(key: string, image: string, prompt: string) {
  let lastError = 'Could not read the image';
  for (const model of MODELS) {
    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Lovable-API-Key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: image } },
          ],
        }],
      }),
    });

    if (res.status === 429 || res.status === 402) {
      throw Object.assign(new Error(res.status === 429
        ? 'AI rate limit reached — please try again in a moment.'
        : 'AI credits exhausted — add credits to keep scanning checks.'), { status: res.status });
    }
    if (!res.ok) { lastError = await res.text(); console.error('gateway error', model, res.status, lastError); continue; }

    const json = await res.json();
    const text: string = json?.choices?.[0]?.message?.content ?? '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) { lastError = 'Model returned no JSON'; continue; }
    try { return JSON.parse(match[0]) as Record<string, unknown>; }
    catch { lastError = 'Model returned invalid JSON'; }
  }
  throw Object.assign(new Error(lastError), { status: 502 });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const key = Deno.env.get('LOVABLE_API_KEY');
    if (!key) {
      return new Response(JSON.stringify({ error: 'Automatic extraction is not configured yet — enter the check details manually.' }), {
        status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { checkImage, stubImage } = await req.json();
    const valid = (v: unknown) => typeof v === 'string' && v.startsWith('data:image/');
    if (!valid(checkImage) && !valid(stubImage)) {
      return new Response(JSON.stringify({ error: 'At least one image is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const warnings: string[] = [];
    let check = { payer_name: '', check_number: '', check_date: '', amount: '', memo: '', confidence: {} as Record<string, number> };
    let stub = { payer_name: '', reference_text: '', invoices: [] as { invoice_number: string; amount: string }[], confidence: 0 };

    if (valid(checkImage)) {
      const p = await readImage(key, checkImage, CHECK_PROMPT);
      const c = (p.confidence ?? {}) as Record<string, unknown>;
      check = {
        payer_name: str(p.payer_name),
        check_number: str(p.check_number),
        check_date: str(p.check_date),
        amount: str(p.amount),
        memo: str(p.memo),
        confidence: {
          payer_name: num(c.payer_name), check_number: num(c.check_number),
          check_date: num(c.check_date), amount: num(c.amount),
        },
      };
      if (Array.isArray(p.warnings)) warnings.push(...(p.warnings as unknown[]).map(str).filter(Boolean));
      if (!check.amount) warnings.push('The check amount could not be read — enter it manually.');
    }

    if (valid(stubImage)) {
      const p = await readImage(key, stubImage, STUB_PROMPT);
      stub = {
        payer_name: str(p.payer_name),
        reference_text: str(p.reference_text),
        invoices: Array.isArray(p.invoices)
          ? (p.invoices as Record<string, unknown>[])
              .map(i => ({ invoice_number: str(i?.invoice_number), amount: str(i?.amount) }))
              .filter(i => i.invoice_number)
          : [],
        confidence: num((p.confidence as Record<string, unknown>)?.invoices),
      };
      if (Array.isArray(p.warnings)) warnings.push(...(p.warnings as unknown[]).map(str).filter(Boolean));
      if (!stub.invoices.length) warnings.push('No invoice numbers were found on the stub.');
    } else {
      warnings.push('No stub image was provided — match invoices manually.');
    }

    return new Response(JSON.stringify({ check, stub, warnings }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    console.error('scan-check-intake failed', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
