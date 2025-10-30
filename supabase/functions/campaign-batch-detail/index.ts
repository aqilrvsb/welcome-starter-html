import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Extract batch_id from URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const batchId = pathParts[pathParts.length - 1];
    
    // Get user_id from query parameter
    const userId = url.searchParams.get('user_id');

    if (!batchId) {
      return new Response(
        JSON.stringify({ error: 'Missing batch_id parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Missing user_id parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', batchId)
      .eq('user_id', userId)
      .single();

    if (campaignError || !campaign) {
      return new Response(
        JSON.stringify({ error: 'Campaign batch not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch call logs for this campaign
    const { data: callLogs, error: logsError } = await supabase
      .from('call_logs')
      .select('phone_number, status, start_time')
      .eq('campaign_id', batchId)
      .order('start_time', { ascending: false });

    if (logsError) {
      console.error('Error fetching call logs:', logsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch call logs' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format response
    const formattedCalls = (callLogs || []).map(log => ({
      phone_number: log.phone_number || '',
      call_status: log.status || 'Unknown',
      call_time: log.start_time 
        ? new Date(log.start_time).toISOString().replace('T', ' ').substring(0, 19)
        : '',
    }));

    const response = {
      batch_id: campaign.id,
      campaign_name: campaign.campaign_name,
      total_calls: campaign.total_numbers || 0,
      successful_calls: campaign.successful_calls || 0,
      failed_calls: campaign.failed_calls || 0,
      created_at: new Date(campaign.created_at).toISOString().replace('T', ' ').substring(0, 19),
      updated_at: new Date(campaign.updated_at).toISOString().replace('T', ' ').substring(0, 19),
      calls: formattedCalls,
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
