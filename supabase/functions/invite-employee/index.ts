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

    const { email, firstName, lastName, phone, hourlyRate }: InviteEmployeeRequest = await req.json();

    console.log('Inviting employee:', { email, firstName, lastName, phone, hourlyRate });

    // Check if user already exists
    const { data: existingUser } = await supabase.auth.admin.getUserByEmail(email);
    
    if (existingUser.user) {
      return new Response(
        JSON.stringify({ error: 'User with this email already exists' }), 
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Create user account with metadata
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: false, // They'll confirm via invite link
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        phone: phone || null,
        hourly_rate: hourlyRate || null,
      }
    });

    if (createError) {
      console.error('Error creating user:', createError);
      throw createError;
    }

    // Send invitation email via Supabase Auth
    const redirectUrl = `${Deno.env.get('SUPABASE_URL')}/auth/v1/verify?type=invite&redirect_to=${encodeURIComponent(supabaseUrl.replace('supabase.co', 'supabase.app'))}`;
    
    const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: redirectUrl,
    });

    if (inviteError) {
      console.error('Error sending invite:', inviteError);
      // If invite fails, clean up the created user
      await supabase.auth.admin.deleteUser(newUser.user?.id!);
      throw inviteError;
    }

    console.log('Employee invitation sent successfully to:', email);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Employee invitation sent successfully',
        userId: newUser.user?.id 
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