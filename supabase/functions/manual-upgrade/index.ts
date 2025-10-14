// Supabase Edge Function: manual-upgrade
// Purpose: Manually upgrade a user to Pro Plan for testing (bypasses RLS using service role)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, plan_id } = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({ error: "Missing user_id" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: "Missing Supabase env vars" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Resolve Pro Plan id
    let proPlanId = plan_id as string | undefined;
    if (!proPlanId) {
      const { data: proPlan } = await supabase
        .from("subscription_plans")
        .select("id")
        .eq("name", "Pro Plan")
        .eq("is_active", true)
        .maybeSingle();
      proPlanId = proPlan?.id ?? "82302cf9-77ea-49b5-b3ae-edf5f80a9405"; // fallback
    }

    // Get or create subscription
    const { data: existingSub } = await supabase
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", user_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let subscriptionId = existingSub?.id as string | undefined;
    if (!subscriptionId) {
      const { data: createdId, error: rpcError } = await supabase.rpc(
        "create_trial_subscription",
        { p_user_id: user_id }
      );
      if (rpcError) {
        console.error("RPC error create_trial_subscription:", rpcError);
        return new Response(JSON.stringify({ error: rpcError.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      subscriptionId = createdId as string;
    }

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(now.getMonth() + 1);

    const { data: updatedSubscription, error: updateError } = await supabase
      .from("user_subscriptions")
      .update({
        status: "active",
        plan_id: proPlanId,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("id", subscriptionId)
      .select("*")
      .single();

    if (updateError) {
      console.error("Update error:", updateError);
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify(updatedSubscription), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    console.error("Unexpected error in manual-upgrade:", err);
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});