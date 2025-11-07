import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting retry processing job...');

    // Find campaigns eligible for retry
    const { data: allCampaigns, error: campaignsError } = await supabaseAdmin
      .from('campaigns')
      .select('*')
      .eq('status', 'completed')
      .eq('retry_enabled', true)
      .order('updated_at', { ascending: true });
    
    if (campaignsError) {
      console.error('Error fetching campaigns:', campaignsError);
      throw campaignsError;
    }
    
    // Filter campaigns where current_retry_count < max_retry_attempts
    const campaignsToRetry = allCampaigns?.filter(c => c.current_retry_count < c.max_retry_attempts) || [];

    if (!campaignsToRetry || campaignsToRetry.length === 0) {
      console.log('No campaigns found for retry');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No campaigns to retry',
        processed: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    console.log(`Found ${campaignsToRetry.length} campaigns for potential retry`);

    let processedCount = 0;
    let retriedCallsCount = 0;

    for (const campaign of campaignsToRetry) {
      // Check if enough time has passed since last update
      const lastUpdated = new Date(campaign.updated_at);
      const now = new Date();
      const minutesSinceUpdate = (now.getTime() - lastUpdated.getTime()) / (1000 * 60);

      if (minutesSinceUpdate < campaign.retry_interval_minutes) {
        console.log(`Campaign ${campaign.id} not ready for retry yet. Minutes since update: ${minutesSinceUpdate}`);
        continue;
      }

      console.log(`Processing retry for campaign: ${campaign.campaign_name} (${campaign.id})`);

      // Get failed/unanswered calls from this campaign
      const { data: failedCalls, error: callsError } = await supabaseAdmin
        .from('call_logs')
        .select('phone_number, contact_id')
        .eq('campaign_id', campaign.id)
        .neq('status', 'answered'); // Get all calls that didn't result in answered status

      if (callsError) {
        console.error(`Error fetching failed calls for campaign ${campaign.id}:`, callsError);
        continue;
      }

      if (!failedCalls || failedCalls.length === 0) {
        console.log(`No failed calls found for campaign ${campaign.id}`);
        // Mark campaign as completed with retries done
        await supabaseAdmin
          .from('campaigns')
          .update({ 
            current_retry_count: campaign.max_retry_attempts,
            updated_at: new Date().toISOString()
          })
          .eq('id', campaign.id);
        continue;
      }

      console.log(`Found ${failedCalls.length} failed calls for campaign ${campaign.id}`);

      // Get unique phone numbers to retry
      const phoneNumbersToRetry = [...new Set(failedCalls.map(call => call.phone_number))];

      // Get user session for authentication
      const { data: userSession, error: sessionError } = await supabaseAdmin
        .from('user_sessions')
        .select('session_token')
        .eq('user_id', campaign.user_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (sessionError || !userSession) {
        console.error(`No active session found for user ${campaign.user_id}`);
        continue;
      }

      // Call the batch-call function to retry these numbers
      try {
        const retryResponse = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/batch-call`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${userSession.session_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              campaignName: `${campaign.campaign_name} (Retry ${campaign.current_retry_count + 1})`,
              promptId: campaign.prompt_id,
              phoneNumbers: phoneNumbersToRetry,
              retryEnabled: campaign.current_retry_count + 1 < campaign.max_retry_attempts,
              retryIntervalMinutes: campaign.retry_interval_minutes,
              maxRetryAttempts: campaign.max_retry_attempts,
            }),
          }
        );

        if (retryResponse.ok) {
          console.log(`Successfully initiated retry for campaign ${campaign.id}`);
          retriedCallsCount += phoneNumbersToRetry.length;
          
          // Update original campaign retry count
          await supabaseAdmin
            .from('campaigns')
            .update({ 
              current_retry_count: campaign.current_retry_count + 1,
              updated_at: new Date().toISOString()
            })
            .eq('id', campaign.id);
          
          processedCount++;
        } else {
          const errorText = await retryResponse.text();
          console.error(`Failed to retry campaign ${campaign.id}:`, errorText);
        }
      } catch (error) {
        console.error(`Error retrying campaign ${campaign.id}:`, error);
      }
    }

    console.log(`Retry processing completed. Processed ${processedCount} campaigns, retried ${retriedCallsCount} calls`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Retry processing completed',
      processed: processedCount,
      retriedCalls: retriedCallsCount
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in retry processing:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorDetails = error instanceof Error ? error.toString() : String(error);
    
    return new Response(JSON.stringify({
      error: errorMessage,
      details: errorDetails
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
