import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const InviteEmployeeSchema = z.object({
  email: z.string().email({ message: "Invalid email format" }).max(255, { message: "Email too long" }),
  firstName: z.string().min(1, { message: "First name required" }).max(100, { message: "First name too long" }).optional(),
  lastName: z.string().min(1, { message: "Last name required" }).max(100, { message: "Last name too long" }).optional(),
  phone: z.string().max(20, { message: "Phone number too long" }).optional().nullable(),
  jobTitle: z.string().min(1, { message: "Job title required" }).max(100, { message: "Job title too long" }).optional(),
  hourlyRate: z.number().min(0, { message: "Hourly rate cannot be negative" }).max(10000, { message: "Hourly rate too high" }).optional().nullable(),
  salaryAmount: z.number().min(0, { message: "Salary cannot be negative" }).max(10000000, { message: "Salary too high" }).optional().nullable(),
  payType: z.enum(['hourly', 'salary'], { message: "Pay type must be 'hourly' or 'salary'" }).optional(),
  attendanceTrackingType: z.enum(['attendance_only', 'attendance_and_punctuality']).optional(),
  attendanceBonusAmount: z.number().min(0).max(100000).optional().nullable(),
  timeBonusAmount: z.number().min(0).max(100000).optional().nullable(),
  resend: z.boolean().optional(),
});

// Permission mappings — must match jobTitles.ts in the frontend exactly
const ALL_PERMISSIONS = [
  'view_schedules', 'edit_schedules', 'view_time_tracking', 'edit_time_tracking',
  'view_work_orders', 'create_work_orders', 'edit_work_orders', 'view_quality_control',
  'edit_quality_control', 'view_worker_status', 'manage_employees', 'view_notifications',
  'admin_settings', 'view_crm', 'view_supplies', 'use_estimating', 'view_team_directory',
  'view_calendar', 'use_messaging', 'publish_schedules',
];
// `publish_schedules` is opt-in only — never granted through the `without` helper.
const without = (...omit: string[]) =>
  ALL_PERMISSIONS.filter((p) => p !== 'publish_schedules' && !omit.includes(p));

const jobTitlePermissions: Record<string, string[]> = {
  'Owner': [...ALL_PERMISSIONS],
  'Office Manager': [...ALL_PERMISSIONS],
  'Operations Manager': [...ALL_PERMISSIONS],
  'Janitorial Manager': without('view_crm', 'view_supplies', 'use_estimating', 'view_calendar', 'admin_settings'),
  'Project Crew Lead': without('view_crm', 'view_supplies', 'use_estimating', 'view_calendar', 'admin_settings'),
  'Night Manager': without('view_crm', 'view_supplies', 'use_estimating', 'view_calendar', 'admin_settings'),
  'Project Worker': [
    'view_schedules', 'view_time_tracking', 'edit_time_tracking', 'view_notifications', 'use_messaging'
  ],
  'Janitorial Staff': [
    'view_schedules', 'view_time_tracking', 'edit_time_tracking', 'view_work_orders',
    'view_notifications', 'use_messaging'
  ],
  'Floaters': [
    'view_schedules', 'view_time_tracking', 'edit_time_tracking', 'view_work_orders',
    'view_worker_status', 'view_notifications', 'use_messaging'
  ],
  'Supply Management': without('view_crm', 'use_estimating', 'admin_settings', 'view_calendar'),
  'Supply': [
    'view_schedules', 'view_time_tracking', 'edit_time_tracking', 'view_supplies',
    'view_notifications', 'use_messaging'
  ],
};

// Titles that get the 'manager' system role
const managerTitles = ['Owner', 'Office Manager', 'Operations Manager', 'Janitorial Manager', 'Project Crew Lead', 'Night Manager'];
// Titles that get the 'admin' system role
const adminTitles = ['Owner', 'Office Manager', 'Operations Manager'];

// Auth emails use their own sender — never the billing sender.
const APP_URL = (Deno.env.get('APP_URL') || Deno.env.get('SITE_URL') || 'https://app.gosummitfacilities.com').replace(/\/$/, '');
const INVITE_FROM_EMAIL = Deno.env.get('INVITE_FROM_EMAIL') || 'noreply@billing.crewcompass360.com';
const INVITE_FROM_NAME = Deno.env.get('INVITE_FROM_NAME') || 'Crew Compass';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const LINK_TTL_HOURS = 24;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const inviteHtml = (name: string, title: string, link: string, isResend: boolean) => `
<div style="font-family:Arial,sans-serif;background:#ffffff;padding:24px;color:#1f2937">
  <div style="max-width:520px;margin:0 auto">
    <h2 style="color:#ea580c;margin:0 0 16px">Welcome to Crew Compass</h2>
    <p>Hi ${esc(name || 'there')},</p>
    <p>${isResend ? 'Here is a fresh link to' : 'You have been invited to'} set up your Crew Compass account${title ? ` as <strong>${esc(title)}</strong>` : ''} with Summit Facilities Group.</p>
    <p style="margin:28px 0"><a href="${link}" style="background:#ea580c;color:#ffffff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:bold">Set up my account</a></p>
    <p style="font-size:13px;color:#6b7280">This link works once and expires in ${LINK_TTL_HOURS} hours. If it expires, ask your manager to resend your invite.</p>
    <p style="font-size:13px;color:#6b7280">If you weren't expecting this, you can ignore this email.</p>
  </div>
</div>`;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Caller must be signed in and allowed to manage employees.
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: caller } = token ? await supabase.auth.getUser(token) : ({ data: { user: null } } as any);
    const callerId: string | undefined = caller?.user?.id;
    if (!callerId) return json({ error: 'You must be signed in to invite employees.' }, 401);
    const [{ data: isAdmin }, { data: canManage }] = await Promise.all([
      supabase.rpc('has_role', { _user_id: callerId, _role: 'admin' }),
      supabase.rpc('has_permission', { _user_id: callerId, _permission: 'manage_employees' }),
    ]);
    if (!isAdmin && !canManage) return json({ error: 'You do not have permission to invite employees.' }, 403);

    let requestBody;
    try {
      requestBody = await req.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const validationResult = InviteEmployeeSchema.safeParse(requestBody);
    if (!validationResult.success) {
      return json({
        error: 'Invalid input',
        details: validationResult.error.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
      }, 400);
    }

    const { email, firstName, lastName, phone, jobTitle, hourlyRate, salaryAmount, payType, attendanceTrackingType, attendanceBonusAmount, timeBonusAmount, resend } = validationResult.data;

    // Only admins may hand out admin-level titles.
    if (jobTitle && adminTitles.includes(jobTitle) && !isAdmin) {
      return json({ error: 'Only admins can invite someone with an admin-level job title.' }, 403);
    }

    console.log('Inviting employee:', { jobTitle, payType, resend });

    let existingUser: any = null;
    try {
      let page = 1;
      while (page <= 20) {
        const { data } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
        const match = data?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
        if (match) { existingUser = match; break; }
        if (!data?.users || data.users.length < 1000) break;
        page++;
      }
    } catch (error) {
      console.log('Could not check existing users:', error);
    }

    if (existingUser?.email_confirmed_at || existingUser?.last_sign_in_at) {
      return json({ error: 'This person has already activated their account. Use password reset instead.' }, 400);
    }

    const redirectUrl = `${APP_URL}/reset-password`;

    const metadata = {
      first_name: firstName,
      last_name: lastName,
      phone: phone || null,
      job_title: jobTitle,
      hourly_rate: payType === 'hourly' ? hourlyRate : null,
      salary_amount: payType === 'salary' ? salaryAmount : null,
      pay_type: payType,
      attendance_tracking_type: attendanceTrackingType || 'attendance_only',
      attendance_bonus_amount: attendanceBonusAmount || null,
      time_bonus_amount: timeBonusAmount || null,
    };

    const isResend = !!existingUser;
    const { data: logRow } = await supabase.from('employee_invitations').insert({
      user_id: existingUser?.id ?? null, email, job_title: jobTitle ?? null, invited_by: callerId,
      kind: isResend ? 'resend' : 'invite', status: 'pending',
    }).select('id').single();
    const logId = logRow?.id;
    const updateLog = async (patch: Record<string, unknown>) => {
      if (logId) await supabase.from('employee_invitations').update(patch).eq('id', logId);
    };

    let userId: string | undefined = existingUser?.id;
    let provider = 'supabase_auth';
    let providerMessageId: string | null = null;

    if (RESEND_API_KEY) {
      // Generate a one-time link (Supabase sends nothing) and deliver it via Resend.
      let linkRes: any = await supabase.auth.admin.generateLink({
        type: 'invite', email, options: { redirectTo: redirectUrl, data: metadata },
      });
      if (linkRes.error && existingUser) {
        linkRes = await supabase.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo: redirectUrl } });
        if (!linkRes.error) await supabase.auth.admin.updateUserById(existingUser.id, { user_metadata: metadata });
      }
      const link = linkRes.data?.properties?.action_link;
      if (linkRes.error || !link) {
        const msg = linkRes.error?.message || 'Could not create a setup link';
        await updateLog({ status: 'failed', error_message: msg });
        return json({ error: msg }, 400);
      }
      userId = linkRes.data.user?.id ?? userId;
      provider = 'resend';
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `invite-${logId}` },
        body: JSON.stringify({
          from: `${INVITE_FROM_NAME} <${INVITE_FROM_EMAIL}>`,
          to: [email],
          subject: isResend ? 'Your new Crew Compass setup link' : "You're invited to Crew Compass",
          html: inviteHtml(firstName ?? '', jobTitle ?? '', link, isResend),
          text: `Set up your Crew Compass account: ${link}\n\nThis link works once and expires in ${LINK_TTL_HOURS} hours.`,
          tags: [{ name: 'category', value: 'employee_invite' }],
        }),
      });
      const body = await r.text();
      if (!r.ok) {
        console.error(`Resend invite failed [${r.status}]: ${body}`);
        await updateLog({ user_id: userId, provider, status: 'failed', error_message: `Email provider error ${r.status}: ${body.slice(0, 400)}` });
        return json({ error: `The invite email could not be sent (provider error ${r.status}).`, userId }, 502);
      }
      try { providerMessageId = JSON.parse(body).id ?? null; } catch { /* ignore */ }
    } else {
      // Fallback: Supabase Auth sends the email through its configured SMTP.
      const res: any = existingUser
        ? await supabase.auth.admin.generateLink({ type: 'invite', email, options: { redirectTo: redirectUrl, data: metadata } })
        : await supabase.auth.admin.inviteUserByEmail(email, { redirectTo: redirectUrl, data: metadata });
      if (res.error) {
        await updateLog({ status: 'failed', provider, error_message: res.error.message });
        return json({ error: res.error.message || 'Failed to send invitation' }, 400);
      }
      userId = res.data?.user?.id ?? userId;
    }

    await updateLog({
      user_id: userId, provider, provider_message_id: providerMessageId, status: 'sent',
      sent_at: new Date().toISOString(),
      link_expires_at: new Date(Date.now() + LINK_TTL_HOURS * 3600_000).toISOString(),
    });

    const inviteData = { user: { id: userId } };
    console.log('Employee invitation sent via', provider);

    // Assign permissions and roles based on job title (skip on resend if no jobTitle change)
    // Resends never touch roles/permissions an admin may have customised.
    if (inviteData.user?.id && jobTitle && !isResend) {
      const userId = inviteData.user.id;

      // Update the profile with job_title and attendance_tracking_type
      // (the trigger does not persist these fields, so we set them here)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          job_title: jobTitle,
          attendance_tracking_type: attendanceTrackingType || 'attendance_only',
        })
        .eq('id', userId);

      if (profileError) {
        console.error('Error updating profile with job title:', profileError);
      }

      // Remove the default employee permissions assigned by the trigger
      // so we can replace them with job-title-specific ones
      await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', userId);

      // Insert job-title-specific permissions
      const permissions = jobTitlePermissions[jobTitle] || jobTitlePermissions['Janitorial Staff'];
      
      if (permissions.length > 0) {
        const permissionInserts = permissions.map(permission => ({
          user_id: userId,
          permission: permission
        }));

        const { error: permError } = await supabase
          .from('user_permissions')
          .insert(permissionInserts);

        if (permError) {
          console.error('Error assigning permissions:', permError);
        } else {
          console.log(`Assigned ${permissions.length} permissions for job title: ${jobTitle}`);
        }
      }

      // Assign manager role for supervisory titles
      if (managerTitles.includes(jobTitle)) {
        // Remove default employee role first
        await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', 'employee');

        const { error: roleError } = await supabase
          .from('user_roles')
          .upsert({ user_id: userId, role: 'manager' }, { onConflict: 'user_id,role' });

        if (roleError) {
          console.error('Error assigning manager role:', roleError);
        } else {
          console.log(`Assigned manager role to: ${jobTitle}`);
        }
      }

      // Assign admin role for Owner and Administrator
      if (adminTitles.includes(jobTitle)) {
        const { error: adminRoleError } = await supabase
          .from('user_roles')
          .upsert({ user_id: userId, role: 'admin' }, { onConflict: 'user_id,role' });

        if (adminRoleError) {
          console.error('Error assigning admin role:', adminRoleError);
        } else {
          console.log(`Assigned admin role to: ${jobTitle}`);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Employee invitation sent successfully',
        provider,
        invitationId: logId,
        expiresInHours: LINK_TTL_HOURS,
        userId: inviteData.user?.id 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error('Error in invite-employee function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'An unexpected error occurred' }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
