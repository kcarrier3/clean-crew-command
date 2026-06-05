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
  firstName: z.string().min(1, { message: "First name required" }).max(100, { message: "First name too long" }),
  lastName: z.string().min(1, { message: "Last name required" }).max(100, { message: "Last name too long" }),
  phone: z.string().max(20, { message: "Phone number too long" }).optional().nullable(),
  jobTitle: z.string().min(1, { message: "Job title required" }).max(100, { message: "Job title too long" }),
  hourlyRate: z.number().min(0, { message: "Hourly rate cannot be negative" }).max(10000, { message: "Hourly rate too high" }).optional().nullable(),
  salaryAmount: z.number().min(0, { message: "Salary cannot be negative" }).max(10000000, { message: "Salary too high" }).optional().nullable(),
  payType: z.enum(['hourly', 'salary'], { message: "Pay type must be 'hourly' or 'salary'" }),
  attendanceTrackingType: z.enum(['attendance_only', 'attendance_and_punctuality']).optional(),
  attendanceBonusAmount: z.number().min(0).max(100000).optional().nullable(),
  timeBonusAmount: z.number().min(0).max(100000).optional().nullable(),
});

// Permission mappings — must match jobTitles.ts in the frontend exactly
const jobTitlePermissions: Record<string, string[]> = {
  'Owner': [
    'view_schedules', 'edit_schedules', 'view_time_tracking', 'edit_time_tracking',
    'view_work_orders', 'create_work_orders', 'edit_work_orders', 'view_quality_control',
    'edit_quality_control', 'view_worker_status', 'manage_employees', 'view_notifications',
    'admin_settings'
  ],
  'Administrator': [
    'view_schedules', 'edit_schedules', 'view_time_tracking', 'edit_time_tracking',
    'view_work_orders', 'create_work_orders', 'edit_work_orders', 'view_quality_control',
    'edit_quality_control', 'view_worker_status', 'manage_employees', 'view_notifications',
    'admin_settings'
  ],
  'Janitorial Manager': [
    'view_schedules', 'edit_schedules', 'view_work_orders', 'create_work_orders',
    'edit_work_orders', 'view_quality_control', 'edit_quality_control', 'view_notifications'
  ],
  'Project Crew Lead': [
    'view_schedules', 'edit_schedules', 'view_work_orders', 'create_work_orders',
    'edit_work_orders', 'view_quality_control', 'edit_quality_control', 'view_notifications'
  ],
  'Supervisor': [
    'view_schedules', 'edit_schedules', 'view_time_tracking', 'edit_time_tracking',
    'view_work_orders', 'create_work_orders', 'edit_work_orders', 'view_quality_control',
    'edit_quality_control', 'view_worker_status', 'view_notifications'
  ],
  'Project Worker': [
    'view_schedules', 'view_time_tracking', 'edit_time_tracking',
    'view_work_orders', 'view_notifications'
  ],
  'Janitorial Staff': [
    'view_schedules', 'view_time_tracking', 'edit_time_tracking',
    'view_work_orders', 'view_notifications'
  ],
  'Floaters': [
    'view_schedules', 'view_time_tracking', 'edit_time_tracking',
    'view_work_orders', 'view_notifications', 'view_quality_control'
  ],
  'Supply Management': [
    'view_schedules', 'view_time_tracking', 'edit_time_tracking',
    'view_work_orders', 'view_notifications'
  ],
};

// Titles that get the 'manager' system role
const managerTitles = ['Owner', 'Administrator', 'Janitorial Manager', 'Project Crew Lead', 'Supervisor'];
// Titles that get the 'admin' system role
const adminTitles = ['Owner', 'Administrator'];

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Parse and validate input
    let requestBody;
    try {
      requestBody = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const validationResult = InviteEmployeeSchema.safeParse(requestBody);
    if (!validationResult.success) {
      console.error('Validation error:', validationResult.error.errors);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid input', 
          details: validationResult.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { email, firstName, lastName, phone, jobTitle, hourlyRate, salaryAmount, payType, attendanceTrackingType, attendanceBonusAmount, timeBonusAmount } = validationResult.data;

    console.log('Inviting employee:', { email, firstName, lastName, phone, jobTitle, hourlyRate, salaryAmount, payType, attendanceTrackingType });

    // Check if user already exists
    try {
      const { data: existingUsers } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000
      });
      
      const userExists = existingUsers.users?.some(user => user.email === email);
      
      if (userExists) {
        return new Response(
          JSON.stringify({ error: 'A user with this email already exists' }), 
          {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }
    } catch (error) {
      console.log('Could not check existing users, proceeding with invitation:', error);
    }

    // Use the app's public URL for the invite redirect so employees land on the app
    // Falls back to the Supabase project URL if SITE_URL is not set
    const siteUrl = Deno.env.get('SITE_URL') || 'https://clean-crew-command.lovable.app';
    const redirectUrl = `${siteUrl}/reset-password`;
    
    const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: redirectUrl,
      data: {
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
      }
    });

    if (inviteError) {
      console.error('Error sending invite:', inviteError);
      throw inviteError;
    }

    console.log('Employee invitation sent successfully to:', email);

    // Assign permissions and roles based on job title
    if (inviteData.user?.id) {
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
