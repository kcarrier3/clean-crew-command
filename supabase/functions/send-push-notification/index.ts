import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { userIds, title, body, data } = await req.json();

    console.log('Sending push notification to users:', userIds);

    // Fetch device tokens for the specified users
    const { data: deviceTokens, error: tokensError } = await supabaseClient
      .from('device_tokens')
      .select('token, platform')
      .in('user_id', userIds);

    if (tokensError) {
      throw tokensError;
    }

    console.log(`Found ${deviceTokens?.length || 0} device tokens`);

    if (!deviceTokens || deviceTokens.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No device tokens found for users',
          sent: 0 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    // TODO: Integrate with Firebase Cloud Messaging (FCM) or Apple Push Notification Service (APNS)
    // For now, we'll just log that notifications would be sent
    // In production, you would:
    // 1. Set up Firebase project and get server key
    // 2. Add FIREBASE_SERVER_KEY to Supabase secrets
    // 3. Send notifications to FCM/APNS endpoints
    
    console.log('Push notifications to send:', {
      title,
      body,
      data,
      tokens: deviceTokens.map(t => ({ token: t.token.substring(0, 10) + '...', platform: t.platform }))
    });

    // Example FCM integration (commented out until Firebase is set up):
    /*
    const fcmUrl = 'https://fcm.googleapis.com/fcm/send';
    const fcmKey = Deno.env.get('FIREBASE_SERVER_KEY');
    
    const notifications = deviceTokens.map(async (deviceToken) => {
      if (deviceToken.platform === 'android' || deviceToken.platform === 'ios') {
        const response = await fetch(fcmUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `key=${fcmKey}`
          },
          body: JSON.stringify({
            to: deviceToken.token,
            notification: {
              title,
              body,
              sound: 'default'
            },
            data: data || {}
          })
        });
        
        return response.json();
      }
    });
    
    await Promise.all(notifications);
    */

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Push notifications prepared for ${deviceTokens.length} devices`,
        sent: deviceTokens.length,
        note: 'Firebase/APNS integration required for actual delivery'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in send-push-notification:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
