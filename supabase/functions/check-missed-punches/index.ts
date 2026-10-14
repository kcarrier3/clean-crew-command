// Missed punch-in SMS alerts for managers (temporary until push is live).
// Runs on a schedule. Idempotent: one alert per shift/day/manager, ever.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const TWILIO_API_KEY = Deno.env.get('TWILIO_API_KEY');
const TWILIO_FROM_NUMBER = Deno.env.get('TWILIO_FROM_NUMBER');
const GATEWAY_URL = 'https://connector-gateway.lovable.dev/twilio';
const LOOKBACK_MIN = 180; // never alert on shifts that started more than 3h ago
const MAX_ATTEMPTS = 3;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const smsConfigured = () => !!(LOVABLE_API_KEY && TWILIO_API_KEY && TWILIO_FROM_NUMBER);

export const normalizePhone = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (trimmed.startsWith('+')) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  if (digits.length === 10 && /^[2-9]/.test(digits)) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
};

const tzOffsetMs = (at: Date, tz: string) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(at).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - at.getTime();
};

/** Local wall-clock date+time in `tz` → UTC instant (DST-safe). */
const zonedToUtc = (date: string, time: string, tz: string) => {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm, ss] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm, ss || 0);
  let ts = guess - tzOffsetMs(new Date(guess), tz);
  ts = guess - tzOffsetMs(new Date(ts), tz);
  return new Date(ts);
};

const localDate = (at: Date, tz: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);

const isoDow = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return w === 0 ? 7 : w;
};

const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

const sendSms = async (to: string, body: string) => {
  const r = await fetch(`${GATEWAY_URL}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      'X-Connection-Api-Key': TWILIO_API_KEY!,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: TWILIO_FROM_NUMBER!, Body: body }),
  });
  const text = await r.text();
  if (!r.ok) return { ok: false, error: `[${r.status}] ${text.slice(0, 400)}` };
  try { return { ok: true, sid: JSON.parse(text).sid as string }; } catch { return { ok: true, sid: null }; }
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  let input: { dryRun?: boolean; action?: string } = {};
  try { input = await req.json(); } catch { /* scheduled call with empty body */ }

  // Status and dry runs reveal names, so they need a signed-in admin.
  if (input.dryRun || input.action === 'status') {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: u } = await admin.auth.getUser(token);
    const { data: isAdmin } = u?.user ? await admin.rpc('has_role', { _user_id: u.user.id, _role: 'admin' }) : { data: false };
    if (!isAdmin) return json({ error: 'Admins only' }, 403);
    if (input.action === 'status') return json({ smsConfigured: smsConfigured(), hasFromNumber: !!TWILIO_FROM_NUMBER, hasTwilioKey: !!TWILIO_API_KEY });
  }

  const { data: settings } = await admin.from('app_settings').select('key, value')
    .in('key', ['sms_missed_punch_enabled', 'missed_punch_grace_minutes', 'company_timezone']);
  const s = Object.fromEntries((settings ?? []).map((r) => [r.key, r.value]));
  const enabled = s.sms_missed_punch_enabled === 'true';
  const grace = Math.min(Math.max(parseInt(s.missed_punch_grace_minutes ?? '10', 10) || 10, 1), 120);
  const tz = s.company_timezone || 'America/New_York';

  if (!enabled && !input.dryRun) return json({ ok: true, skipped: 'disabled' });

  const now = new Date();
  const dates = [localDate(new Date(now.getTime() - 86400000), tz), localDate(now, tz)];

  const { data: schedules, error: schedErr } = await admin.from('employee_schedules')
    .select('id, employee_id, job_site_id, start_date, end_date, start_time, days_of_week, week_interval, recurrence_anchor_date')
    .eq('active', true).lte('start_date', dates[1]).not('start_time', 'is', null);
  if (schedErr) return json({ error: schedErr.message }, 500);

  type Due = { schedule: any; date: string; start: Date };
  const due: Due[] = [];
  for (const sc of schedules ?? []) {
    for (const date of dates) {
      if (sc.start_date > date || (sc.end_date && sc.end_date < date)) continue;
      if (!(sc.days_of_week ?? []).includes(isoDow(date))) continue;
      const interval = sc.week_interval ?? 1;
      if (interval > 1) {
        const anchor = sc.recurrence_anchor_date ?? sc.start_date;
        const weeks = Math.floor(daysBetween(anchor, date) / 7);
        if (weeks < 0 || weeks % interval !== 0) continue;
      }
      const start = zonedToUtc(date, sc.start_time, tz);
      const minsSince = (now.getTime() - start.getTime()) / 60000;
      if (minsSince >= grace && minsSince <= LOOKBACK_MIN) due.push({ schedule: sc, date, start });
    }
  }
  if (!due.length) return json({ ok: true, checked: schedules?.length ?? 0, due: 0 });

  const empIds = [...new Set(due.map((d) => d.schedule.employee_id))];
  const earliest = new Date(Math.min(...due.map((d) => d.start.getTime())) - 2 * 3600000).toISOString();
  const [{ data: punches }, { data: excused }, { data: callOffs }, { data: timeOff }, { data: emps }] = await Promise.all([
    admin.from('time_entries').select('employee_id, clock_in').in('employee_id', empIds).gte('clock_in', earliest),
    admin.from('excused_shifts').select('employee_id, excused_date, schedule_id').in('employee_id', empIds).in('excused_date', dates),
    admin.from('shift_call_offs').select('employee_id, call_off_date, schedule_id').in('employee_id', empIds).in('call_off_date', dates),
    admin.from('time_off_requests').select('employee_id, start_date, end_date').in('employee_id', empIds)
      .eq('status', 'approved').lte('start_date', dates[1]).gte('end_date', dates[0]),
    admin.from('profiles').select('id, first_name, last_name, active').in('id', empIds),
  ]);
  const empById = new Map((emps ?? []).map((e) => [e.id, e]));

  const stillMissing = due.filter(({ schedule: sc, date, start }) => {
    const emp = empById.get(sc.employee_id);
    if (!emp || emp.active === false) return false;
    const windowStart = start.getTime() - 2 * 3600000;
    if ((punches ?? []).some((p) => p.employee_id === sc.employee_id && Date.parse(p.clock_in) >= windowStart)) return false;
    if ((excused ?? []).some((x) => x.employee_id === sc.employee_id && x.excused_date === date && (!x.schedule_id || x.schedule_id === sc.id))) return false;
    if ((callOffs ?? []).some((c) => c.employee_id === sc.employee_id && c.call_off_date === date && (!c.schedule_id || c.schedule_id === sc.id))) return false;
    if ((timeOff ?? []).some((t) => t.employee_id === sc.employee_id && t.start_date <= date && t.end_date >= date)) return false;
    return true;
  });
  if (!stillMissing.length) return json({ ok: true, due: due.length, missing: 0 });

  const siteIds = [...new Set(stillMissing.map((d) => d.schedule.job_site_id).filter(Boolean))];
  const { data: sites } = siteIds.length
    ? await admin.from('job_sites').select('id, name').in('id', siteIds) : { data: [] as any[] };
  const siteName = new Map((sites ?? []).map((x: any) => [x.id, x.name]));

  // Managers assigned to this employee (department first, legacy fallback).
  const managerCache = new Map<string, string[]>();
  const managersFor = async (empId: string) => {
    if (managerCache.has(empId)) return managerCache.get(empId)!;
    let { data } = await admin.rpc('get_employee_department_managers', { p_employee_id: empId });
    if (!data?.length) ({ data } = await admin.rpc('get_employee_managers', { _employee_id: empId }));
    const ids = [...new Set((data ?? []).map((m: any) => m.manager_id).filter((id: string) => id && id !== empId))] as string[];
    managerCache.set(empId, ids);
    return ids;
  };

  const rows: any[] = [];
  const allMgrIds = new Set<string>();
  for (const d of stillMissing) {
    for (const m of await managersFor(d.schedule.employee_id)) {
      allMgrIds.add(m);
      rows.push({ d, manager_id: m });
    }
  }
  const { data: mgrProfiles } = allMgrIds.size
    ? await admin.from('profiles').select('id, phone, sms_opt_in, active').in('id', [...allMgrIds]) : { data: [] as any[] };
  const mgrById = new Map((mgrProfiles ?? []).map((p: any) => [p.id, p]));

  const fmtTime = (d: Date) => d.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' });
  const fmtDate = (d: Date) => d.toLocaleDateString('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' });

  const planned = rows.map(({ d, manager_id }) => {
    const emp = empById.get(d.schedule.employee_id)!;
    const mgr = mgrById.get(manager_id);
    const phone = normalizePhone(mgr?.phone);
    const name = `${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim() || 'An employee';
    const site = siteName.get(d.schedule.job_site_id) ?? 'their site';
    const message = `Crew Compass: ${name} has not punched in at ${site} for the ${fmtTime(d.start)} shift (${fmtDate(d.start)}). Reply STOP to opt out.`;
    const blocked = !mgr || mgr.active === false ? 'manager_inactive'
      : !mgr.sms_opt_in ? 'not_opted_in' : !phone ? 'invalid_phone' : null;
    return {
      alert_type: 'missed_punch', schedule_id: d.schedule.id, employee_id: d.schedule.employee_id,
      manager_id, shift_date: d.date, scheduled_start: d.start.toISOString(), to_phone: phone, message,
      status: blocked ?? (smsConfigured() ? 'pending' : 'not_configured'), provider: 'twilio',
    };
  });

  if (input.dryRun) return json({ ok: true, dryRun: true, smsConfigured: smsConfigured(), enabled, alerts: planned });

  // Insert-once: the unique key makes repeated runs harmless.
  await admin.from('sms_alert_log').upsert(planned, {
    onConflict: 'alert_type,schedule_id,shift_date,manager_id', ignoreDuplicates: true,
  });

  if (!smsConfigured()) return json({ ok: true, missing: stillMissing.length, sent: 0, note: 'SMS provider not configured' });

  // Claim and send pending/failed rows for these shifts (optimistic lock on attempts).
  const scheduleIds = [...new Set(planned.map((p) => p.schedule_id))];
  const { data: sendable } = await admin.from('sms_alert_log').select('*')
    .eq('alert_type', 'missed_punch').in('schedule_id', scheduleIds).in('shift_date', dates)
    .in('status', ['pending', 'failed', 'not_configured']).lt('attempts', MAX_ATTEMPTS);
  const stillKeys = new Set(planned.filter((p) => p.status === 'pending')
    .map((p) => `${p.schedule_id}|${p.shift_date}|${p.manager_id}`));

  let sent = 0, failed = 0;
  for (const row of sendable ?? []) {
    if (!stillKeys.has(`${row.schedule_id}|${row.shift_date}|${row.manager_id}`) || !row.to_phone) continue;
    const { data: claimed } = await admin.from('sms_alert_log')
      .update({ status: 'sending', attempts: row.attempts + 1 })
      .eq('id', row.id).eq('attempts', row.attempts).in('status', ['pending', 'failed', 'not_configured'])
      .select('id');
    if (!claimed?.length) continue;
    const res = await sendSms(row.to_phone, row.message);
    if (res.ok) {
      sent++;
      await admin.from('sms_alert_log').update({ status: 'sent', provider_message_id: res.sid, sent_at: new Date().toISOString(), error_message: null }).eq('id', row.id);
    } else {
      failed++;
      console.error('SMS send failed', row.id, res.error);
      await admin.from('sms_alert_log').update({ status: 'failed', error_message: res.error }).eq('id', row.id);
    }
  }
  return json({ ok: true, missing: stillMissing.length, sent, failed });
});
