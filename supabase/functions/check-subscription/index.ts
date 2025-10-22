import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    // Create Supabase client with service role for custom auth
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    // Get user from custom auth session token
    const sessionToken = authHeader.replace('Bearer ', '');
    
    const { data: sessionData, error: sessionError } = await supabaseAdmin
      .from('user_sessions')
      .select('user_id, expires_at')
      .eq('session_token', sessionToken)
      .single();
    
    if (sessionError || !sessionData) {
      throw new Error('Invalid session token');
    }
    
    if (new Date(sessionData.expires_at) < new Date()) {
      throw new Error('Session expired');
    }
    
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, username')
      .eq('id', sessionData.user_id)
      .single();
    
    if (userError || !userData) {
      throw new Error('User not found');
    }

    const user = userData;
    logStep("User authenticated", { userId: user.id, username: user.username });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    
    // Check if customer exists using username as email (custom auth)
    const customers = await stripe.customers.list({ 
      email: `${user.username}@custom.local`,
      limit: 1 
    });
    
    if (customers.data.length === 0) {
      logStep("No customer found, user not subscribed");
      
      // Update user subscription status to trial/expired
      await supabaseAdmin
        .from('user_subscriptions')
        .update({
          status: 'trial',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);
      
      return new Response(JSON.stringify({ 
        subscribed: false,
        product_id: null,
        subscription_end: null
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });
    
    const hasActiveSub = subscriptions.data.length > 0;
    let productId = null;
    let subscriptionEnd = null;

    if (hasActiveSub) {
      const subscription = subscriptions.data[0];
      
      // Safely handle timestamp conversion
      try {
        subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
        const currentPeriodStart = new Date(subscription.current_period_start * 1000).toISOString();
        productId = subscription.items.data[0].price.product as string;
        logStep("Active subscription found", { subscriptionId: subscription.id, endDate: subscriptionEnd, productId });
        
        // Update user subscription status in database
        await supabaseAdmin
          .from('user_subscriptions')
          .upsert({
            user_id: user.id,
            status: 'active',
            plan_id: '82302cf9-77ea-49b5-b3ae-edf5f80a9405', // Pro Plan ID
            current_period_start: currentPeriodStart,
            current_period_end: subscriptionEnd,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id'
          });
      } catch (dateError) {
        logStep("Error processing subscription dates", { error: dateError, subscription: subscription.id });
        // Still return subscription as active even if we can't update local DB
      }
        
    } else {
      logStep("No active subscription found");
      
      // Check if user has an active trial before marking as expired
      const { data: existingSub } = await supabaseAdmin
        .from('user_subscriptions')
        .select('status, trial_end_date')
        .eq('user_id', user.id)
        .single();
      
      // Only update to expired if:
      // 1. User has no subscription at all, OR
      // 2. User has a trial that has already expired
      if (!existingSub) {
        // No subscription record, shouldn't happen but handle gracefully
        logStep("No subscription record found for user");
      } else if (existingSub.status === 'trial' && existingSub.trial_end_date) {
        const trialEnd = new Date(existingSub.trial_end_date);
        const now = new Date();
        
        if (now > trialEnd) {
          // Trial has expired, update to expired
          logStep("Trial has expired, updating status");
          await supabaseAdmin
            .from('user_subscriptions')
            .update({
              status: 'expired',
              updated_at: new Date().toISOString()
            })
            .eq('user_id', user.id);
        } else {
          // Trial is still active, keep as trial
          logStep("Trial still active, keeping trial status");
        }
      } else if (existingSub.status !== 'trial') {
        // Not on trial and no active Stripe sub, mark as expired
        logStep("No trial and no active subscription, marking expired");
        await supabaseAdmin
          .from('user_subscriptions')
          .update({
            status: 'expired',
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id);
      }
    }

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      product_id: productId,
      subscription_end: subscriptionEnd
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ 
      subscribed: false,
      product_id: null,
      subscription_end: null,
      error: errorMessage 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200, // Return 200 to avoid breaking the UI
    });
  }
});