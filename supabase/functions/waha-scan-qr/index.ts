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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { user_id } = await req.json();

    if (!user_id) {
      throw new Error('User ID is required');
    }

    // Get username from users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('username')
      .eq('id', user_id)
      .single();

    if (userError || !userData) {
      throw new Error('User not found');
    }

    // Hardcoded WAHA configuration
    const wahaBaseUrl = 'https://waha-plus-production-705f.up.railway.app';
    const wahaApiKey = Deno.env.get('WAHA_API_KEY')!;

    // Get phone config to check existing session
    const { data: config } = await supabase
      .from('phone_config')
      .select('*')
      .eq('user_id', user_id)
      .maybeSingle();

    // Create session name from username (sanitized: lowercase, alphanumeric only, max 20 chars)
    const sanitizedUsername = userData.username
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 20);
    const sessionName = `${sanitizedUsername}_wa`;

    console.log('Creating WAHA session:', sessionName);

    // Delete old session if exists
    if (config?.waha_session_name) {
      try {
        const deleteResponse = await fetch(
          `${wahaBaseUrl}/api/sessions/${config.waha_session_name}`,
          {
            method: 'DELETE',
            headers: {
              'X-Api-Key': wahaApiKey,
            },
          }
        );
        console.log('Old session deleted:', await deleteResponse.text());
      } catch (error) {
        console.log('No old session to delete or error:', error);
      }
    }

    // Create new session
    const sessionData = {
      name: sessionName,
      start: false,
      config: {
        debug: false,
        noweb: {
          store: {
            enabled: true,
            fullSync: false,
          },
        },
      },
    };

    const createResponse = await fetch(`${wahaBaseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': wahaApiKey,
      },
      body: JSON.stringify(sessionData),
    });

    const createResult = await createResponse.json();
    console.log('Session created:', createResult);

    if (!createResult.name) {
      throw new Error(createResult.error || 'Failed to create session');
    }

    // Start the session
    const startResponse = await fetch(
      `${wahaBaseUrl}/api/sessions/${sessionName}/start`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': wahaApiKey,
        },
      }
    );

    console.log('Session started:', await startResponse.text());

    // Update database
    const updateData = {
      waha_session_name: sessionName,
      waha_api_key: wahaApiKey,
      connection_status: 'starting',
      provider: 'waha',
    };

    if (config) {
      await supabase
        .from('phone_config')
        .update(updateData)
        .eq('user_id', user_id);
    } else {
      await supabase
        .from('phone_config')
        .insert({
          user_id: user_id,
          ...updateData,
          twilio_phone_number: '',
          twilio_account_sid: '',
          twilio_auth_token: '',
        });
    }

    console.log('Database updated successfully');

    return new Response(
      JSON.stringify({
        success: true,
        session_name: sessionName,
        message: 'Session created. Check status to get QR code.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error in waha-scan-qr:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
