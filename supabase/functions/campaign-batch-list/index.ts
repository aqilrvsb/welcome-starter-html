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

    // Parse query parameters
    const url = new URL(req.url);
    const userId = url.searchParams.get('user_id');

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Missing user_id parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse additional query parameters
    const campaignNameFilter = url.searchParams.get('campaign_name');
    const dateFilter = url.searchParams.get('date');
    const page = parseInt(url.searchParams.get('page') || '1');
    const size = parseInt(url.searchParams.get('size') || '20');

    // Build query
    let query = supabase
      .from('campaigns')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Apply filters
    if (campaignNameFilter) {
      query = query.ilike('campaign_name', `%${campaignNameFilter}%`);
    }

    if (dateFilter) {
      const startOfDay = `${dateFilter} 00:00:00`;
      const endOfDay = `${dateFilter} 23:59:59`;
      query = query.gte('created_at', startOfDay).lte('created_at', endOfDay);
    }

    // Apply pagination
    const from = (page - 1) * size;
    const to = from + size - 1;
    query = query.range(from, to);

    const { data: campaigns, error, count } = await query;

    if (error) {
      console.error('Error fetching campaigns:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch campaigns' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format response
    const formattedData = (campaigns || []).map(campaign => ({
      batch_id: campaign.id,
      campaign_name: campaign.campaign_name,
      total_calls: campaign.total_numbers || 0,
      successful_calls: campaign.successful_calls || 0,
      failed_calls: campaign.failed_calls || 0,
      created_at: new Date(campaign.created_at).toISOString().replace('T', ' ').substring(0, 19),
      updated_at: new Date(campaign.updated_at).toISOString().replace('T', ' ').substring(0, 19),
    }));

    return new Response(
      JSON.stringify({
        data: formattedData,
        pagination: {
          page,
          size,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / size),
        },
      }),
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
