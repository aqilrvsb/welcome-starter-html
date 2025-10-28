/**
 * Webhook Handler for Lead + Auto Call Integration
 *
 * Deployed on Deno Deploy (same as ai-call-handler-freeswitch)
 *
 * Supports:
 * - lead_only: Creates contact only
 * - lead_and_call: Creates contact + initiates call
 *
 * Name-based routing (no UUIDs needed!)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface WebhookPayload {
  name: string;
  phone_number: string;
  product?: string;
  prompt_name?: string;
  campaign_name?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const url = new URL(req.url);
  const userAgent = req.headers.get('user-agent') || 'unknown';
  const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';

  try {
    // Extract webhook type and token from URL path
    // Expected: https://your-project.deno.dev/lead/abc123 or /lead-call/abc123
    const pathParts = url.pathname.split('/').filter(Boolean);

    if (pathParts.length < 2) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid webhook URL format. Expected: /lead/{token} or /lead-call/{token}'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const webhookType = pathParts[0]; // "lead" or "lead-call"
    const webhookToken = pathParts[1]; // token

    // Validate webhook type
    const expectedType = webhookType === 'lead' ? 'lead_only' :
                        webhookType === 'lead-call' ? 'lead_and_call' : null;

    if (!expectedType) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid webhook type. Must be "lead" or "lead-call"'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📥 Webhook Request: ${webhookType} / ${webhookToken}`);

    // Look up webhook by token
    const { data: webhook, error: webhookError } = await supabaseAdmin
      .from('webhooks')
      .select('*')
      .eq('webhook_token', webhookToken)
      .eq('webhook_type', expectedType)
      .eq('is_active', true)
      .single();

    if (webhookError || !webhook) {
      console.error('❌ Webhook not found:', webhookError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid or inactive webhook token'
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Webhook found: ${webhook.webhook_name} (${webhook.webhook_type}) for user ${webhook.user_id}`);

    // Parse request body
    const payload: WebhookPayload = await req.json();

    // Validate required fields
    if (!payload.name || !payload.phone_number) {
      await logWebhookRequest(webhook.id, payload, 'error', null, null, 'Missing required fields: name and phone_number', Date.now() - startTime, ipAddress, userAgent);
      await updateWebhookFailedStats(webhook);

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: name and phone_number'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean phone number (remove spaces, dashes, etc.)
    const cleanedPhone = payload.phone_number.replace(/[\s\-\(\)]/g, '');

    console.log(`📞 Processing: ${payload.name} - ${cleanedPhone}`);

    // Create contact (lead)
    const { data: contact, error: contactError } = await supabaseAdmin
      .from('contacts')
      .insert({
        user_id: webhook.user_id,
        name: payload.name,
        phone_number: cleanedPhone,
        product: payload.product || null,
        info: `webhook:${webhook.webhook_name}`,
      })
      .select()
      .single();

    if (contactError) {
      console.error('❌ Failed to create contact:', contactError);
      await logWebhookRequest(webhook.id, payload, 'error', null, null, `Failed to create contact: ${contactError.message}`, Date.now() - startTime, ipAddress, userAgent);
      await updateWebhookFailedStats(webhook);

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to create contact',
          details: contactError.message
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Contact created: ${contact.id} - ${contact.name}`);

    let callId: string | null = null;

    // If webhook type is lead_and_call, initiate call
    if (webhook.webhook_type === 'lead_and_call') {
      // Determine prompt to use
      const promptName = payload.prompt_name || webhook.default_prompt_name;

      if (!promptName) {
        await logWebhookRequest(webhook.id, payload, 'error', contact.id, null, 'No prompt specified and no default prompt configured', Date.now() - startTime, ipAddress, userAgent);
        await updateWebhookFailedStats(webhook);

        return new Response(
          JSON.stringify({
            success: false,
            error: 'No prompt specified and no default prompt configured for this webhook',
            contact_id: contact.id
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Look up prompt by name
      const { data: prompt, error: promptError } = await supabaseAdmin
        .from('prompts')
        .select('id')
        .eq('user_id', webhook.user_id)
        .eq('prompt_name', promptName)
        .single();

      if (promptError || !prompt) {
        console.error('❌ Prompt not found:', promptError);
        await logWebhookRequest(webhook.id, payload, 'error', contact.id, null, `Prompt not found: ${promptName}`, Date.now() - startTime, ipAddress, userAgent);
        await updateWebhookFailedStats(webhook);

        return new Response(
          JSON.stringify({
            success: false,
            error: `Prompt not found: ${promptName}`,
            contact_id: contact.id
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`✅ Prompt found: ${prompt.id} (${promptName})`);

      // Check if user has phone_config, create default if not
      const { data: existingPhoneConfig } = await supabaseAdmin
        .from('phone_config')
        .select('id')
        .eq('user_id', webhook.user_id)
        .single();

      if (!existingPhoneConfig) {
        console.log(`⚙️ No phone_config found for user ${webhook.user_id}, creating default FreeSWITCH config`);

        // Create default phone_config with platform FreeSWITCH/AlienVOIP settings
        const { error: configError } = await supabaseAdmin
          .from('phone_config')
          .insert({
            user_id: webhook.user_id,
            freeswitch_url: Deno.env.get('DEFAULT_FREESWITCH_URL') || 'http://68.183.177.218',
            sip_username: Deno.env.get('DEFAULT_SIP_USERNAME') || '',
            sip_password: Deno.env.get('DEFAULT_SIP_PASSWORD') || '',
            sip_proxy_primary: 'sip1.alienvoip.com',
            sip_proxy_secondary: 'sip3.alienvoip.com',
            sip_codec: 'ulaw',
          });

        if (configError) {
          console.error('❌ Failed to create default phone_config:', configError);
          await logWebhookRequest(webhook.id, payload, 'error', contact.id, null, `Phone config not found and failed to create default: ${configError.message}`, Date.now() - startTime, ipAddress, userAgent);
          await updateWebhookFailedStats(webhook);

          return new Response(
            JSON.stringify({
              success: false,
              error: 'Phone configuration not found. Please configure your FreeSWITCH settings in Settings > Phone Config.',
              contact_id: contact.id
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`✅ Default phone_config created for user ${webhook.user_id}`);
      }

      // Initiate call via batch-call-v2 function
      console.log(`📞 Initiating call to ${cleanedPhone} via batch-call-v2`);

      try {
        const batchCallResponse = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/batch-call-v2`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({
              userId: webhook.user_id,
              campaignName: `Webhook: ${webhook.webhook_name}`,
              promptId: prompt.id,
              phoneNumbers: [cleanedPhone],
              phoneNumbersWithNames: [{ phone: cleanedPhone, name: payload.name }],
              customerName: payload.name,
              retryEnabled: false,
            }),
          }
        );

        const batchCallResult = await batchCallResponse.json();

        if (!batchCallResponse.ok || !batchCallResult.success) {
          throw new Error(batchCallResult.error || 'Failed to initiate call via batch-call-v2');
        }

        console.log(`✅ Call initiated successfully via batch-call-v2:`, batchCallResult);

        // Get the call log ID from the result
        callId = batchCallResult.campaign?.id || null;

      } catch (callError: any) {
        console.error('❌ Failed to initiate call:', callError);
        await logWebhookRequest(webhook.id, payload, 'error', contact.id, null, `Failed to initiate call: ${callError.message}`, Date.now() - startTime, ipAddress, userAgent);
        await updateWebhookFailedStats(webhook);

        return new Response(
          JSON.stringify({
            success: false,
            error: 'Failed to initiate call',
            details: callError.message,
            contact_id: contact.id
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Log successful webhook request
    await logWebhookRequest(webhook.id, payload, 'success', contact.id, callId, null, Date.now() - startTime, ipAddress, userAgent);

    // Update webhook stats
    await supabaseAdmin
      .from('webhooks')
      .update({
        total_requests: webhook.total_requests + 1,
        successful_requests: webhook.successful_requests + 1,
        last_request_at: new Date().toISOString(),
      })
      .eq('id', webhook.id);

    // Return success response
    const response = {
      success: true,
      message: webhook.webhook_type === 'lead_and_call'
        ? 'Contact created and call initiated successfully'
        : 'Contact created successfully',
      data: {
        contact_id: contact.id,
        name: contact.name,
        phone_number: contact.phone_number,
        ...(callId && { call_id: callId }),
      },
    };

    console.log(`✅ Webhook processed successfully in ${Date.now() - startTime}ms`);

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Webhook handler error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function logWebhookRequest(
  webhookId: string,
  payload: any,
  status: 'success' | 'error',
  contactId: string | null,
  callId: string | null,
  errorMessage: string | null,
  processingTimeMs: number,
  ipAddress: string,
  userAgent: string
) {
  try {
    await supabaseAdmin
      .from('webhook_logs')
      .insert({
        webhook_id: webhookId,
        request_payload: payload,
        response_status: status,
        contact_id: contactId,
        call_id: callId,
        error_message: errorMessage,
        processing_time_ms: processingTimeMs,
        ip_address: ipAddress,
        user_agent: userAgent,
      });
  } catch (logError) {
    console.error('❌ Failed to log webhook request:', logError);
  }
}

async function updateWebhookFailedStats(webhook: any) {
  try {
    await supabaseAdmin
      .from('webhooks')
      .update({
        total_requests: webhook.total_requests + 1,
        failed_requests: webhook.failed_requests + 1,
        last_request_at: new Date().toISOString(),
      })
      .eq('id', webhook.id);
  } catch (error) {
    console.error('❌ Failed to update webhook stats:', error);
  }
}

console.log('🚀 Webhook Handler started on Deno Deploy');
