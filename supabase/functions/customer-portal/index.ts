import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CUSTOMER-PORTAL] ${step}${detailsStr}`);
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
    
    let customerId;
    if (customers.data.length === 0) {
      // Create customer if doesn't exist
      logStep("Creating new customer for user", { username: user.username });
      const customer = await stripe.customers.create({
        email: `${user.username}@custom.local`,
        name: user.username,
      });
      customerId = customer.id;
      logStep("Created new customer", { customerId });
    } else {
      customerId = customers.data[0].id;
      logStep("Found existing customer", { customerId });
    }

    const origin = req.headers.get("origin") || "https://71537ca3-ca93-4bd3-bbff-87ee6c09e193.lovableproject.com";
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/settings`,
    });
    
    logStep("Customer portal session created", { sessionId: portalSession.id, url: portalSession.url });

    return new Response(JSON.stringify({ url: portalSession.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in customer-portal", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});