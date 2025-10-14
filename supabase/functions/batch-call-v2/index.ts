/**
 * Batch Call V2 - Uses Custom AI Pipeline instead of VAPI
 *
 * This version:
 * - Uses YOUR master API keys (Azure STT, OpenRouter, ElevenLabs)
 * - Charges clients from their credits balance
 * - Client only provides Twilio credentials
 * - 80% cheaper than VAPI
 *
 * Cost: $0.12/min (you pay) → Charge $0.20/min → $0.08/min profit (40% margin)
 */

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
    const requestBody = await req.json();
    const { userId } = requestBody;

    if (!userId) {
      throw new Error('User ID is required');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? 'https://ahexnoaazbveiyhplfrc.supabase.co',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoZXhub2FhemJ2ZWl5aHBsZnJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDI0MzAyMiwiZXhwIjoyMDc1ODE5MDIyfQ.a2Te8vxVqbgKl7E7qK7Uah6lqx6QxXgUh-9sqqtUx8I'
    );

    // Verify user exists
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, username, credits_balance')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      throw new Error('User not found');
    }

    const { campaignName, promptId, phoneNumbers, phoneNumbersWithNames = [], customerName, retryEnabled, retryIntervalMinutes, maxRetryAttempts, idsale } = requestBody;

    console.log(`Starting batch call campaign: ${campaignName} for user: ${userData.id}`);
    console.log(`User credits balance: $${userData.credits_balance}`);

    // Validate inputs
    if (!campaignName || !phoneNumbers || !Array.isArray(phoneNumbers)) {
      throw new Error('Missing required parameters: campaignName, phoneNumbers');
    }

    // Get user's Twilio configuration
    const { data: phoneConfig, error: phoneError } = await supabaseAdmin
      .from('phone_config')
      .select('*')
      .eq('user_id', userData.id)
      .single();

    if (phoneError || !phoneConfig || !phoneConfig.twilio_phone_number || !phoneConfig.twilio_account_sid || !phoneConfig.twilio_auth_token) {
      throw new Error('Twilio configuration not found. Please configure your Twilio settings in Phone Config.');
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

    // Calculate estimated cost
    const estimatedMinutesPerCall = 2; // Average call duration
    const costPerMinute = 0.20; // What we charge client
    const estimatedTotalCost = validPhones.length * estimatedMinutesPerCall * costPerMinute;

    console.log(`📊 Estimated cost for ${validPhones.length} calls: $${estimatedTotalCost.toFixed(2)}`);
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

    // Get AI call handler WebSocket URL (Deno Deploy - PRODUCTION)
    // 🚀 NEW: Using Deno Deploy for unlimited WebSocket time + Singapore edge (15ms latency!)
    const DENO_DEPLOY_URL = Deno.env.get('DENO_DEPLOY_URL') || 'YOUR_DENO_DEPLOY_URL_HERE';
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

        console.log(`📞 Initiating call to ${phoneNumber}`);

        // Create TwiML - Pass only IDs to avoid Twilio 4000 char limit
        // The edge function will fetch prompts from database
        const customerNameToUse = customerNameFromRequest || (contactData && contactData.name) || customerName || "";

        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <Stream url="${AI_CALL_HANDLER_URL}">
            <Parameter name="user_id" value="${userData.id}" />
            <Parameter name="campaign_id" value="${campaign.id}" />
            <Parameter name="prompt_id" value="${prompt.id}" />
            <Parameter name="phone_number" value="${phoneNumber}" />
            <Parameter name="customer_name" value="${customerNameToUse}" />
        </Stream>
    </Connect>
</Response>`;

        // Make call via Twilio API
        const twilioAuth = btoa(`${phoneConfig.twilio_account_sid}:${phoneConfig.twilio_auth_token}`);

        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${phoneConfig.twilio_account_sid}/Calls.json`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${twilioAuth}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              From: phoneConfig.twilio_phone_number,
              To: phoneNumber,
              Twiml: twiml
            }).toString()
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Twilio API Error for ${phoneNumber}:`, errorText);
          throw new Error(`Twilio API Error: ${response.status} - ${errorText}`);
        }

        const twilioResponse = await response.json();

        console.log(`✅ Call initiated:`, {
          call_sid: twilioResponse.sid,
          phone: phoneNumber,
          status: twilioResponse.status
        });

        // Log successful call
        await supabaseAdmin.from('call_logs').insert({
          campaign_id: campaign.id,
          user_id: userData.id,
          contact_id: contactData?.id || null,
          call_id: twilioResponse.sid,
          phone_number: phoneNumber,
          vapi_call_id: twilioResponse.sid,
          status: twilioResponse.status || 'initiated',
          agent_id: 'ai-call-handler',
          caller_number: phoneNumber,
          start_time: new Date().toISOString(),
          idsale: idsale || null,
          customer_name: customerNameFromRequest || contactData?.name || customerName || null,
          metadata: {
            twilio_response: twilioResponse,
            batch_call: true,
            customer_name: contactData?.name || null,
            pipeline: 'azure_stt_openrouter_elevenlabs'
          }
        });

        console.log(`✅ Call initiated for ${phoneNumber}: ${twilioResponse.sid}`);
        return { success: true, phoneNumber, callId: twilioResponse.sid };

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
