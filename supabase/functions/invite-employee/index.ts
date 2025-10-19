import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InviteEmployeeRequest {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  jobTitle: string;
  hourlyRate?: number;
  salaryAmount?: number;
  payType: 'hourly' | 'salary';
  attendanceTrackingType?: 'attendance_only' | 'attendance_and_punctuality';
}

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

    const { email, firstName, lastName, phone, jobTitle, hourlyRate, salaryAmount, payType, attendanceTrackingType }: InviteEmployeeRequest = await req.json();

    console.log('Inviting employee:', { email, firstName, lastName, phone, jobTitle, hourlyRate, salaryAmount, payType, attendanceTrackingType });

    // Check if user already exists by trying to get user data
    try {
      const { data: existingUsers } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000 // Supabase admin client limitation workaround
      });
      
      const userExists = existingUsers.users?.some(user => user.email === email);
      
      if (userExists) {
        return new Response(
          JSON.stringify({ error: 'User with this email already exists' }), 
          {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }
    } catch (error) {
      console.log('Could not check existing users, proceeding with invitation:', error);
    }

    // Send invitation email via Supabase Auth with metadata
    const redirectUrl = `https://lqtfbqfnpjobrwjlpqhr.supabase.app/`;
    
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
      }
    });

    if (inviteError) {
      console.error('Error sending invite:', inviteError);
      throw inviteError;
    }

    console.log('Employee invitation sent successfully to:', email);

    // If user was created, assign default permissions based on job title
    if (inviteData.user?.id) {
      // Define permission mappings for each job title
      const jobTitlePermissions: Record<string, string[]> = {
        'Owner': [
          'view_schedules', 'edit_schedules', 'view_time_tracking', 'edit_time_tracking',
          'view_work_orders', 'create_work_orders', 'edit_work_orders', 'view_quality_control',
          'edit_quality_control', 'view_worker_status', 'manage_employees', 'view_notifications'
        ],
        'Administrator': [
          'view_schedules', 'edit_schedules', 'view_time_tracking', 'edit_time_tracking',
          'view_work_orders', 'create_work_orders', 'edit_work_orders', 'view_quality_control',
          'edit_quality_control', 'view_worker_status', 'manage_employees', 'view_notifications'
        ],
        'Manager': [
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
          'view_work_orders', 'view_notifications'
        ],
        'Supply Management': [
          'view_schedules', 'view_time_tracking', 'edit_time_tracking',
          'view_work_orders', 'view_notifications'
        ],
      };

      const permissions = jobTitlePermissions[jobTitle] || [];
      
      // Insert permissions for the new user
      if (permissions.length > 0) {
        const permissionInserts = permissions.map(permission => ({
          user_id: inviteData.user.id,
          permission: permission
        }));

        const { error: permError } = await supabase
          .from('user_permissions')
          .insert(permissionInserts);

        if (permError) {
          console.error('Error assigning permissions:', permError);
          // Don't fail the whole operation if permissions fail
        } else {
          console.log(`Assigned ${permissions.length} permissions to user based on job title: ${jobTitle}`);
        }
      }

      // Assign manager role for Owner, Administrator, and Manager
      if (jobTitle === 'Owner' || jobTitle === 'Administrator' || jobTitle === 'Manager') {
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({
            user_id: inviteData.user.id,
            role: 'manager'
          });

        if (roleError) {
          console.error('Error assigning manager role:', roleError);
        } else {
          console.log(`Assigned manager role to user with job title: ${jobTitle}`);
        }
      }

      // Assign admin role for Owner and Administrator
      if (jobTitle === 'Owner' || jobTitle === 'Administrator') {
        const { error: adminRoleError } = await supabase
          .from('user_roles')
          .insert({
            user_id: inviteData.user.id,
            role: 'admin'
          });

        if (adminRoleError) {
          console.error('Error assigning admin role:', adminRoleError);
        } else {
          console.log(`Assigned admin role to user with job title: ${jobTitle}`);
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
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);