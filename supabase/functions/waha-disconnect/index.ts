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

    // Hardcoded WAHA configuration
    const wahaBaseUrl = 'https://waha-plus-production-705f.up.railway.app';
    const wahaApiKey = Deno.env.get('WAHA_API_KEY')!;

    // Get phone config for session name
    const { data: config, error: configError } = await supabase
      .from('phone_config')
      .select('waha_session_name')
      .eq('user_id', user_id)
      .single();

    if (configError || !config) {
      throw new Error('Configuration not found');
    }

    const sessionName = config.waha_session_name;

    if (!sessionName) {
      throw new Error('Session not created');
    }

    console.log('Disconnecting session:', sessionName);

    // Delete the session
    const deleteResponse = await fetch(
      `${wahaBaseUrl}/api/sessions/${sessionName}`,
      {
        method: 'DELETE',
        headers: {
          'X-Api-Key': wahaApiKey,
        },
      }
    );

    console.log('Delete response status:', deleteResponse.status);

    // Update database
    await supabase
      .from('phone_config')
      .update({
        waha_session_name: null,
        connection_status: 'disconnected',
      })
      .eq('user_id', user_id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Session disconnected successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error in waha-disconnect:', error);
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
