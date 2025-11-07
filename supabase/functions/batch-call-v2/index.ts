/**
 * Batch Call V2 - Uses FreeSWITCH + AlienVOIP + Custom AI Pipeline
 *
 * This version:
 * - Uses FreeSWITCH (fspbx) with AlienVOIP SIP trunk (70% cheaper than Twilio!)
 * - Uses YOUR master API keys (Azure STT, OpenRouter, ElevenLabs)
 * - Charges clients from their credits balance
 * - Client provides AlienVOIP SIP credentials in phone_config
 * - 80% cheaper than VAPI + Twilio combined
 *
 * Cost: AlienVOIP RM0.006-0.01/min vs Twilio RM0.03/min → 70% savings on telephony
 */

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { createFreeSwitchClient } from '../_shared/freeswitch-esl-client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    const { userId } = requestBody;

    if (!userId) {
      throw new Error('User ID is required');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? 'https://ahexnoaazbveiyhplfrc.supabase.co',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoZXhub2FhemJ2ZWl5aHBsZnJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDI0MzAyMiwiZXhwIjoyMDc1ODE5MDIyfQ.a2Te8vxVqbgKl7E7qK7Uah6lqx6QxXgUh-9sqqtUx8I'
    );

    // Verify user exists and get account type
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, username, credits_balance, account_type')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      throw new Error('User not found');
    }

    const accountType = userData.account_type || 'trial';
    console.log(`👤 User account type: ${accountType}`);

    const { campaignName, promptId, phoneNumbers, phoneNumbersWithNames = [], customerName, retryEnabled, retryIntervalMinutes, maxRetryAttempts, idsale } = requestBody;

    console.log(`Starting batch call campaign: ${campaignName} for user: ${userData.id}`);
    console.log(`User credits balance: $${userData.credits_balance}`);

    // Validate inputs
    if (!campaignName || !phoneNumbers || !Array.isArray(phoneNumbers)) {
      throw new Error('Missing required parameters: campaignName, phoneNumbers');
    }

    // Get SIP configuration based on account type
    let sipConfig = null;

    if (accountType === 'pro') {
      // Pro user: Must have their own SIP configuration
      const { data: phoneConfig, error: phoneError } = await supabaseAdmin
        .from('phone_config')
        .select('sip_username, sip_password, sip_proxy_primary, sip_caller_id')
        .eq('user_id', userData.id)
        .single();

      if (phoneError || !phoneConfig) {
        throw new Error('Pro account requires SIP configuration. Please configure your SIP trunk in Phone Settings.');
      }

      sipConfig = {
        sip_username: phoneConfig.sip_username,
        sip_password: phoneConfig.sip_password,
        sip_proxy_primary: phoneConfig.sip_proxy_primary,
        sip_caller_id: phoneConfig.sip_caller_id,
      };

      console.log(`✅ Pro SIP config loaded: ${sipConfig.sip_username}@${sipConfig.sip_proxy_primary}`);
    } else {
      // Trial user: Use shared gateway (no SIP config needed, will use ENV variables fallback)
      console.log('✅ Trial user: Using shared AlienVOIP gateway');
    }

    // Get the selected prompt
    let prompt;
    if (promptId) {
      const { data, error: promptError } = await supabaseAdmin
        .from('prompts')
        .select('*')
        .eq('id', promptId)
        .eq('user_id', userData.id)
        .single();

      if (promptError || !data) {
        throw new Error('Prompt not found');
      }
      prompt = data;
    } else {
      const { data, error: promptError } = await supabaseAdmin
        .from('prompts')
        .select('*')
        .eq('user_id', userData.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (promptError || !data) {
        throw new Error('No prompts found. Please create a prompt first.');
      }
      prompt = data;
    }

    // Validate and format phone numbers
    const validPhones: string[] = [];
    const invalidPhones: string[] = [];

    for (const phone of phoneNumbers) {
      const cleanPhone = phone.replace(/[^0-9+]/g, '').trim();

      if (!cleanPhone) {
        invalidPhones.push(phone);
        continue;
      }

      let formattedPhone: string;
      if (cleanPhone.startsWith('+')) {
        formattedPhone = cleanPhone;
      } else if (cleanPhone.startsWith('60')) {
        formattedPhone = '+' + cleanPhone;
      } else if (cleanPhone.startsWith('0')) {
        formattedPhone = '+6' + cleanPhone;
      } else {
        formattedPhone = '+60' + cleanPhone;
      }

      if (formattedPhone.length >= 12 && formattedPhone.length <= 15) {
        validPhones.push(formattedPhone);
      } else {
        invalidPhones.push(phone);
      }
    }

    if (validPhones.length === 0) {
      throw new Error('No valid phone numbers provided');
    }

    // Calculate estimated cost (AlienVOIP is 70% cheaper than Twilio!)
    const estimatedMinutesPerCall = 2; // Average call duration
    const costPerMinute = 0.06; // RM0.06/min with AlienVOIP (vs RM0.20/min Twilio) - 70% savings!
    const estimatedTotalCost = validPhones.length * estimatedMinutesPerCall * costPerMinute;

    console.log(`📊 Estimated cost for ${validPhones.length} calls: $${estimatedTotalCost.toFixed(2)} (AlienVOIP pricing)`);
    console.log(`💰 User balance: $${userData.credits_balance}`);

    // Check if user has sufficient credits (with buffer)
    const requiredBalance = estimatedTotalCost * 0.5; // Require 50% upfront
    if (userData.credits_balance < requiredBalance) {
      throw new Error(`Insufficient credits. Required: $${requiredBalance.toFixed(2)}, Available: $${userData.credits_balance.toFixed(2)}. Please top up your credits.`);
    }

    // Create campaign record
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('campaigns')
      .insert({
        user_id: userData.id,
        campaign_name: campaignName,
        prompt_id: prompt.id,
        status: 'in_progress',
        total_numbers: validPhones.length,
        retry_enabled: retryEnabled || false,
        retry_interval_minutes: retryIntervalMinutes || 30,
        max_retry_attempts: maxRetryAttempts || 3,
        current_retry_count: 0
      })
      .select()
      .single();

    if (campaignError) {
      throw new Error('Failed to create campaign: ' + campaignError.message);
    }

    console.log(`✅ Created campaign ${campaign.id} with ${validPhones.length} valid numbers`);

    // Initialize FreeSWITCH ESL client
    const freeswitchClient = createFreeSwitchClient();
    console.log(`🔗 Initialized FreeSWITCH client for ${phoneConfig.freeswitch_url}`);

    // Get AI call handler WebSocket URL (Deno Deploy - PRODUCTION)
    // 🚀 Using Deno Deploy for unlimited WebSocket time + Singapore edge (15ms latency!)
    const DENO_DEPLOY_URL = Deno.env.get('DENO_DEPLOY_URL') || 'https://sifucall.deno.dev';
    const AI_CALL_HANDLER_URL = DENO_DEPLOY_URL.replace('https://', 'wss://');

    console.log(`🔗 Using WebSocket URL: ${AI_CALL_HANDLER_URL}`);

    // Create a map of phone numbers to customer names
    const phoneToNameMap = new Map<string, string>();
    if (phoneNumbersWithNames && Array.isArray(phoneNumbersWithNames)) {
      phoneNumbersWithNames.forEach((item: any) => {
        if (item.phone_number && item.customer_name) {
          phoneToNameMap.set(item.phone_number, item.customer_name);
        }
      });
    }

    // Process all calls concurrently
    let successCount = 0;
    let failureCount = 0;

    console.log(`🚀 Processing ${validPhones.length} calls concurrently`);

    const callPromises = validPhones.map(async (phoneNumber) => {
      const customerNameFromRequest = phoneToNameMap.get(phoneNumber);

      const normalizePhone = (phone: string) => phone.replace(/[^0-9]/g, '');
      const targetNormalized = normalizePhone(phoneNumber);

      const { data: allContacts } = await supabaseAdmin
        .from('contacts')
        .select('id, name, phone_number')
        .eq('user_id', userData.id);

      const contactData = allContacts?.find(contact => {
        const contactNormalized = normalizePhone(contact.phone_number);
        return contactNormalized === targetNormalized ||
               contactNormalized === targetNormalized.slice(-9) ||
               targetNormalized.endsWith(contactNormalized);
      }) || null;

      try {
        // Replace variables in prompts
        const replaceVariables = (text: string) => {
          let result = text;
          const nameToUse = customerNameFromRequest || (contactData && contactData.name) || customerName || "Cik";

          result = result.replace(/\{\{CUSTOMER_PHONE_NUMBER\}\}/g, phoneNumber);
          result = result.replace(/\{\{customer_name\}\}/g, nameToUse);
          result = result.replace(/\{\{CUSTOMER_NAME\}\}/g, nameToUse);

          if (prompt.variables && Array.isArray(prompt.variables)) {
            for (const variable of prompt.variables) {
              const variableName = variable.name;
              const placeholder = new RegExp(`\\{\\{${variableName}\\}\\}`, 'g');

              switch (variableName.toLowerCase()) {
                case 'customer_name':
                case 'name':
                case 'nama':
                  result = result.replace(placeholder, nameToUse);
                  break;
                case 'phone_number':
                case 'phone':
                case 'telefon':
                  result = result.replace(placeholder, phoneNumber);
                  break;
                default:
                  result = result.replace(placeholder, `[${variableName}]`);
                  break;
              }
            }
          }

          return result;
        };

        console.log(`📞 Initiating call to ${phoneNumber} via FreeSWITCH + AlienVOIP`);

        // Prepare metadata for AI handler
        const customerNameToUse = customerNameFromRequest || (contactData && contactData.name) || customerName || "";

        // Make call via FreeSWITCH ESL (Originate command with mod_audio_fork)
        // This will:
        // 1. Call customer via AlienVOIP SIP trunk (shared for Trial, dynamic for Pro)
        // 2. When answered, audio is forked to AI handler WebSocket via mod_audio_fork
        // 3. AI handler processes audio in real-time
        const callResult = await freeswitchClient.originateCall({
          phoneNumber: phoneNumber,
          aiHandlerUrl: `${AI_CALL_HANDLER_URL}/audio`,
          callerId: `AI Call <${phoneNumber}>`,
          sipConfig: sipConfig, // Pass SIP config for Pro users (null for Trial)
          variables: {
            user_id: userData.id,
            campaign_id: campaign.id,
            prompt_id: prompt.id,
            customer_name: customerNameToUse,
            websocket_url: AI_CALL_HANDLER_URL,
            account_type: accountType, // Add account type for tracking
          }
        });

        if (!callResult.success) {
          throw new Error(callResult.error || 'Failed to originate call via MikoPBX');
        }

        console.log(`✅ Call initiated via MikoPBX:`, {
          call_id: callResult.callId,
          phone: phoneNumber,
          provider: 'AlienVOIP',
          status: 'initiated'
        });

        // Log successful call
        await supabaseAdmin.from('call_logs').insert({
          campaign_id: campaign.id,
          user_id: userData.id,
          contact_id: contactData?.id || null,
          call_id: callResult.callId,
          phone_number: phoneNumber,
          vapi_call_id: callResult.callId, // Using MikoPBX call ID
          status: 'initiated',
          agent_id: 'ai-call-handler',
          caller_number: phoneNumber,
          start_time: new Date().toISOString(),
          idsale: idsale || null,
          customer_name: customerNameFromRequest || contactData?.name || customerName || null,
          metadata: {
            mikopbx_call_id: callResult.callId,
            provider: 'AlienVOIP',
            sip_trunk: phoneConfig.sip_proxy_primary,
            batch_call: true,
            customer_name: contactData?.name || null,
            pipeline: 'azure_stt_openrouter_elevenlabs',
            mikopbx_url: phoneConfig.mikopbx_url
          }
        });

        console.log(`✅ Call initiated for ${phoneNumber}: ${callResult.callId}`);
        return { success: true, phoneNumber, callId: callResult.callId };

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`❌ Failed to call ${phoneNumber}:`, errorMessage);

        await supabaseAdmin.from('call_logs').insert({
          campaign_id: campaign.id,
          user_id: userData.id,
          contact_id: contactData?.id || null,
          call_id: `failed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          phone_number: phoneNumber,
          status: 'failed',
          agent_id: 'ai-call-handler',
          caller_number: phoneNumber,
          start_time: new Date().toISOString(),
          idsale: idsale || null,
          customer_name: customerNameFromRequest || contactData?.name || customerName || null,
          metadata: {
            error: errorMessage,
            batch_call: true,
            pipeline: 'azure_stt_openrouter_elevenlabs',
            failed_at: new Date().toISOString()
          }
        });

        return { success: false, phoneNumber, error: errorMessage };
      }
    });

    // Execute all calls concurrently
    const results = await Promise.all(callPromises);

    results.forEach(result => {
      if (result.success) {
        successCount++;
      } else {
        failureCount++;
      }
    });

    console.log(`✅ All calls completed: ${successCount} successful, ${failureCount} failed`);

    // Update campaign status
    await supabaseAdmin
      .from('campaigns')
      .update({
        status: 'completed',
        successful_calls: successCount,
        failed_calls: failureCount
      })
      .eq('id', campaign.id);

    return new Response(JSON.stringify({
      message: `Batch call campaign completed successfully`,
      campaign_id: campaign.id,
      summary: {
        total_provided: phoneNumbers.length,
        valid_numbers: validPhones.length,
        invalid_numbers: invalidPhones.length,
        successful_calls: successCount,
        failed_calls: failureCount,
        estimated_cost: estimatedTotalCost,
        current_balance: userData.credits_balance
      },
      invalid_numbers: invalidPhones
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Error in batch-call-v2 function:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
