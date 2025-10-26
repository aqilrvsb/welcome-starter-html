import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WebhookPayload {
  name: string;
  phone_number: string;
  product?: string;
  prompt_name?: string;
  campaign_name?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const url = new URL(req.url);
  const userAgent = req.headers.get("user-agent") || "unknown";
  const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";

  try {
    // Extract webhook type and token from URL path
    // When deployed to Supabase, the function receives the full URL path
    // Example: https://xxx.supabase.co/functions/v1/webhook-handler/lead/abc123
    // url.pathname will be: /functions/v1/webhook-handler/lead/abc123
    const pathParts = url.pathname.split("/").filter(Boolean);

    // Find the index of "webhook-handler" in the path
    const handlerIndex = pathParts.indexOf("webhook-handler");

    if (handlerIndex === -1 || pathParts.length < handlerIndex + 3) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid webhook URL format. Expected: /webhook-handler/lead/{token} or /webhook-handler/lead-call/{token}"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const webhookType = pathParts[handlerIndex + 1]; // "lead" or "lead-call"
    const webhookToken = pathParts[handlerIndex + 2]; // token

    // Validate webhook type
    const expectedType = webhookType === "lead" ? "lead_only" :
                        webhookType === "lead-call" ? "lead_and_call" : null;

    if (!expectedType) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid webhook type. Must be 'lead' or 'lead-call'"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Look up webhook by token
    const { data: webhook, error: webhookError } = await supabase
      .from("webhooks")
      .select("*")
      .eq("webhook_token", webhookToken)
      .eq("webhook_type", expectedType)
      .eq("is_active", true)
      .single();

    if (webhookError || !webhook) {
      console.error("❌ Webhook not found:", webhookError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid or inactive webhook token"
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Webhook found: ${webhook.webhook_name} (${webhook.webhook_type}) for user ${webhook.user_id}`);

    // Parse request body
    const payload: WebhookPayload = await req.json();

    // Validate required fields
    if (!payload.name || !payload.phone_number) {
      await logWebhookRequest(supabase, webhook.id, payload, "error", null, null, "Missing required fields: name and phone_number", Date.now() - startTime, ipAddress, userAgent);
      await updateWebhookFailedStats(supabase, webhook);

      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: name and phone_number"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean phone number (remove spaces, dashes, etc.)
    const cleanedPhone = payload.phone_number.replace(/[\s\-\(\)]/g, "");

    // Create contact (lead)
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .insert({
        user_id: webhook.user_id,
        name: payload.name,
        phone: cleanedPhone,
        product: payload.product || null,
        source: `webhook:${webhook.webhook_name}`,
        status: "new",
      })
      .select()
      .single();

    if (contactError) {
      console.error("❌ Failed to create contact:", contactError);
      await logWebhookRequest(supabase, webhook.id, payload, "error", null, null, `Failed to create contact: ${contactError.message}`, Date.now() - startTime, ipAddress, userAgent);
      await updateWebhookFailedStats(supabase, webhook);

      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to create contact",
          details: contactError.message
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Contact created: ${contact.id} - ${contact.name}`);

    let callId: string | null = null;

    // If webhook type is lead_and_call, initiate call
    if (webhook.webhook_type === "lead_and_call") {
      // Determine prompt to use
      const promptName = payload.prompt_name || webhook.default_prompt_name;

      if (!promptName) {
        await logWebhookRequest(supabase, webhook.id, payload, "error", contact.id, null, "No prompt specified and no default prompt configured", Date.now() - startTime, ipAddress, userAgent);
        await updateWebhookFailedStats(supabase, webhook);

        return new Response(
          JSON.stringify({
            success: false,
            error: "No prompt specified and no default prompt configured for this webhook"
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Look up prompt by name
      const { data: prompt, error: promptError } = await supabase
        .from("prompts")
        .select("id")
        .eq("user_id", webhook.user_id)
        .eq("prompt_name", promptName)
        .single();

      if (promptError || !prompt) {
        console.error("❌ Prompt not found:", promptError);
        await logWebhookRequest(supabase, webhook.id, payload, "error", contact.id, null, `Prompt not found: ${promptName}`, Date.now() - startTime, ipAddress, userAgent);
        await updateWebhookFailedStats(supabase, webhook);

        return new Response(
          JSON.stringify({
            success: false,
            error: `Prompt not found: ${promptName}`
          }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`✅ Prompt found: ${prompt.id} (${promptName})`);

      // Determine campaign name
      const campaignName = payload.campaign_name || webhook.default_campaign_name || `Webhook: ${webhook.webhook_name}`;

      // Create call log entry (call will be initiated by separate service)
      const { data: callLog, error: callError } = await supabase
        .from("call_logs")
        .insert({
          user_id: webhook.user_id,
          contact_id: contact.id,
          prompt_id: prompt.id,
          campaign_name: campaignName,
          direction: "outbound",
          call_status: "queued",
          phone_number: cleanedPhone,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (callError) {
        console.error("❌ Failed to create call log:", callError);
        await logWebhookRequest(supabase, webhook.id, payload, "error", contact.id, null, `Failed to initiate call: ${callError.message}`, Date.now() - startTime, ipAddress, userAgent);
        await updateWebhookFailedStats(supabase, webhook);

        return new Response(
          JSON.stringify({
            success: false,
            error: "Failed to initiate call",
            details: callError.message,
            contact_id: contact.id
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      callId = callLog.id;
      console.log(`✅ Call queued: ${callId}`);
    }

    // Log successful webhook request
    await logWebhookRequest(supabase, webhook.id, payload, "success", contact.id, callId, null, Date.now() - startTime, ipAddress, userAgent);

    // Update webhook stats
    await supabase
      .from("webhooks")
      .update({
        total_requests: webhook.total_requests + 1,
        successful_requests: webhook.successful_requests + 1,
        last_request_at: new Date().toISOString(),
      })
      .eq("id", webhook.id);

    // Return success response
    const response = {
      success: true,
      message: webhook.webhook_type === "lead_and_call"
        ? "Contact created and call initiated successfully"
        : "Contact created successfully",
      data: {
        contact_id: contact.id,
        name: contact.name,
        phone: contact.phone,
        ...(callId && { call_id: callId }),
      },
    };

    console.log(`✅ Webhook processed successfully in ${Date.now() - startTime}ms`);

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("❌ Webhook handler error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: "Internal server error",
        details: error.message
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Helper function to log webhook requests
async function logWebhookRequest(
  supabase: any,
  webhookId: string,
  payload: any,
  status: "success" | "error",
  contactId: string | null,
  callId: string | null,
  errorMessage: string | null,
  processingTimeMs: number,
  ipAddress: string,
  userAgent: string
) {
  try {
    await supabase
      .from("webhook_logs")
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
    console.error("❌ Failed to log webhook request:", logError);
  }
}

// Helper function to update webhook stats on failure
async function updateWebhookFailedStats(supabase: any, webhook: any) {
  try {
    await supabase
      .from("webhooks")
      .update({
        total_requests: webhook.total_requests + 1,
        failed_requests: webhook.failed_requests + 1,
        last_request_at: new Date().toISOString(),
      })
      .eq("id", webhook.id);
  } catch (error) {
    console.error("❌ Failed to update webhook stats:", error);
  }
}
