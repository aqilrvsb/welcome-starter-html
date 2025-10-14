import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

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
    const { callSid, userId } = await req.json();

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get Twilio credentials from phone_config
    const { data: phoneConfig, error: configError } = await supabase
      .from('phone_config')
      .select('twilio_account_sid, twilio_auth_token')
      .eq('user_id', userId)
      .single();

    if (configError || !phoneConfig) {
      console.error('Error fetching phone config:', configError);
      return new Response(
        JSON.stringify({ error: 'Phone configuration not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get call details from Twilio API
    const twilioAccountSid = phoneConfig.twilio_account_sid;
    const twilioAuthToken = phoneConfig.twilio_auth_token;
    
    const auth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Calls/${callSid}.json`;

    const response = await fetch(twilioUrl, {
      headers: {
        'Authorization': `Basic ${auth}`,
      },
    });

    if (!response.ok) {
      console.error('Twilio API error:', response.status, response.statusText);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch call details from Twilio' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const callData = await response.json();
    
    // Extract cost information
    let cost = parseFloat(callData.price || '0');
    const currency = callData.price_unit || 'USD';
    
    // Convert negative costs to positive (remove the negative sign)
    if (cost < 0) {
      console.log(`Negative Twilio cost detected: ${cost} ${currency}. Converting to positive: ${Math.abs(cost)}`);
      cost = Math.abs(cost);
    }

    console.log(`Twilio cost for call ${callSid}: ${cost} ${currency}`);

    return new Response(
      JSON.stringify({ 
        cost: cost,
        currency: currency,
        duration: callData.duration,
        status: callData.status
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-twilio-cost function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});