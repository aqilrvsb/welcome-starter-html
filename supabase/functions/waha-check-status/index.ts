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
      .select('waha_session_name, connection_status')
      .eq('user_id', user_id)
      .maybeSingle();

    if (configError) {
      console.error('Error fetching config:', configError);
      throw new Error('Failed to fetch configuration');
    }

    if (!config) {
      return new Response(
        JSON.stringify({
          status: 'disconnected',
          message: 'No WhatsApp configuration found. Please configure WhatsApp first.',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    const sessionName = config.waha_session_name;

    if (!sessionName) {
      return new Response(
        JSON.stringify({
          status: 'disconnected',
          message: 'No active session. Please scan QR code to connect.',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log('Checking status for session:', sessionName);

    // Check session status
    const statusResponse = await fetch(
      `${wahaBaseUrl}/api/sessions/${sessionName}`,
      {
        method: 'GET',
        headers: {
          'X-Api-Key': wahaApiKey,
        },
      }
    );

    const statusData = await statusResponse.json();
    console.log('Session status:', statusData);

    const status = statusData.status || 'UNKNOWN';
    let qrCode = null;

    // If session is STOPPED, try to start it
    if (status === 'STOPPED') {
      console.log('Session is stopped, attempting to start...');
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
      console.log('Start response:', await startResponse.text());
      
      // Wait a moment and check again
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const recheckResponse = await fetch(
        `${wahaBaseUrl}/api/sessions/${sessionName}`,
        {
          method: 'GET',
          headers: {
            'X-Api-Key': wahaApiKey,
          },
        }
      );
      const recheckData = await recheckResponse.json();
      console.log('Recheck status:', recheckData.status);
    }

    // If waiting for QR code, fetch it
    if (status === 'SCAN_QR_CODE' || status === 'STARTING') {
      try {
        console.log('Fetching QR code...');
        const qrResponse = await fetch(
          `${wahaBaseUrl}/api/${sessionName}/auth/qr?format=image`,
          {
            method: 'GET',
            headers: {
              'X-Api-Key': wahaApiKey,
              'Accept': 'application/json',
            },
          }
        );

        const qrData = await qrResponse.json();
        console.log('QR code data received');
        
        if (qrData.data) {
          qrCode = `data:image/png;base64,${qrData.data}`;
        }
      } catch (error) {
        console.error('Error fetching QR code:', error);
      }
    }

    // Update database with current status
    const connectionStatus = status === 'WORKING' ? 'connected' : 
                            status === 'SCAN_QR_CODE' ? 'scan_qr_code' :
                            status === 'STARTING' ? 'starting' :
                            status === 'STOPPED' ? 'stopped' : 'disconnected';

    await supabase
      .from('phone_config')
      .update({ connection_status: connectionStatus })
      .eq('user_id', user_id);

    return new Response(
      JSON.stringify({
        status: connectionStatus,
        qr_code: qrCode,
        raw_status: status,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error in waha-check-status:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Unknown error',
        status: 'error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
