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
  hourlyRate?: number;
  salaryAmount?: number;
  payType: 'hourly' | 'salary';
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email, firstName, lastName, phone, hourlyRate, salaryAmount, payType }: InviteEmployeeRequest = await req.json();

    console.log('Inviting employee:', { email, firstName, lastName, phone, hourlyRate, salaryAmount, payType });

    // Check if user already exists by trying to get user data
    try {
      const { data: existingUser } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000 // Supabase admin client limitation workaround
      });
      
      const userExists = existingUser.users?.some(user => user.email === email);
      
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
      console.log('Could not check existing users, proceeding with invitation');
    }

    // Send invitation email via Supabase Auth with metadata
    const redirectUrl = `${supabaseUrl}/auth/v1/verify?type=invite&redirect_to=${encodeURIComponent('https://lqtfbqfnpjobrwjlpqhr.supabase.app/')}`;
    
    const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: redirectUrl,
      data: {
        first_name: firstName,
        last_name: lastName,
        phone: phone || null,
        hourly_rate: payType === 'hourly' ? hourlyRate : null,
        salary_amount: payType === 'salary' ? salaryAmount : null,
        pay_type: payType,
      }
    });

    if (inviteError) {
      console.error('Error sending invite:', inviteError);
      throw inviteError;
    }

    console.log('Employee invitation sent successfully to:', email);

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