/**
 * CHIP Credits Top-Up Handler
 *
 * Allows clients to buy credits via CHIP Payment Gateway (replaces Billplz)
 * Credits are added to their account after successful payment
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const CHIP_API_KEY = Deno.env.get('CHIP_API_KEY');
const CHIP_BASE_URL = 'https://gate.chip-in.asia/api/v1';
const CHIP_BRAND_ID = Deno.env.get('CHIP_BRAND_ID');

// 🔍 DEBUG: Log environment variables on startup
console.log('🔧 Environment check:');
console.log('  CHIP_API_KEY:', CHIP_API_KEY ? '✅ Set (' + CHIP_API_KEY.substring(0, 20) + '...)' : '❌ NOT SET');
console.log('  CHIP_BRAND_ID:', CHIP_BRAND_ID ? '✅ Set (' + CHIP_BRAND_ID + ')' : '❌ NOT SET');

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const contentType = req.headers.get('content-type') || '';

    // Check if it's a webhook from CHIP
    if (req.method === 'POST' && contentType.includes('application/json')) {
      // Check for webhook signature
      const signature = req.headers.get('X-Signature');
      if (signature) {
        return await handleWebhook(req, signature);
      }
    }

    // Regular API call from frontend
    const body = await req.json();
    const { user_id, amount, description } = body;

    if (!user_id || !amount) {
      return new Response(
        JSON.stringify({ error: 'user_id and amount are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (amount < 10) {
      return new Response(
        JSON.stringify({ error: 'Minimum top-up amount is RM10' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user data
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('username, email')
      .eq('id', user_id)
      .single();

    if (userError || !userData) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userName = userData.username || 'User';
    const userEmail = userData.email || `${user_id.substring(0, 8)}@custom.local`;

    // Create payment record in database
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        user_id,
        amount,
        currency: 'MYR',
        status: 'pending',
        metadata: {
          type: 'credits_topup',
          description: description || `Credits Top-up RM${amount}`
        }
      })
      .select()
      .single();

    if (paymentError) {
      console.error('Error creating payment record:', paymentError);
      throw new Error('Failed to create payment record');
    }

    // Get app origin dynamically from request headers
    const origin = req.headers.get('origin');
    const referer = req.headers.get('referer');

    let appOrigin = origin;

    // If no origin header, extract from referer
    if (!appOrigin && referer) {
      try {
        const refererUrl = new URL(referer);
        appOrigin = `${refererUrl.protocol}//${refererUrl.host}`;
      } catch (e) {
        console.error('Failed to parse referer:', e);
      }
    }

    // Fallback to environment variable
    if (!appOrigin) {
      appOrigin = Deno.env.get('APP_ORIGIN') || 'https://aicallpro.com';
    }

    console.log(`🌐 Using app origin: ${appOrigin} (from ${origin ? 'origin header' : referer ? 'referer header' : 'env/default'})`);

    // Create CHIP purchase
    const chipData = {
      brand_id: CHIP_BRAND_ID,
      client: {
        email: userEmail,
        full_name: userName,
      },
      purchase: {
        currency: 'MYR',
        products: [
          {
            name: description || `Credits Top-up`,
            price: Math.round(amount * 100), // Convert to cents
            quantity: 1,
          }
        ],
        notes: `Credits top-up for ${userName}`,
        metadata: {
          user_id: user_id,
          payment_id: payment.id,
          type: 'credits_topup'
        }
      },
      success_redirect: `${appOrigin}/credits-topup?status=success`,
      failure_redirect: `${appOrigin}/credits-topup?status=failed`,
      success_callback: `${Deno.env.get('SUPABASE_URL')}/functions/v1/billplz-credits-topup`,
      reference: `TOPUP-${payment.id.substring(0, 8)}`,
      send_receipt: true,
    };

    console.log('📤 Creating CHIP purchase:', JSON.stringify(chipData, null, 2));

    const response = await fetch(`${CHIP_BASE_URL}/purchases/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CHIP_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chipData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('CHIP API error:', errorText);
      throw new Error(`CHIP API error: ${response.status} - ${errorText}`);
    }

    const purchaseData = await response.json();

    console.log('✅ CHIP purchase created:', purchaseData.id);

    // Update payment record with CHIP purchase ID
    await supabase
      .from('payments')
      .update({
        chip_purchase_id: purchaseData.id,
        chip_checkout_url: purchaseData.checkout_url,
        metadata: {
          type: 'credits_topup',
          description: description || `Credits Top-up RM${amount}`,
          chip_data: purchaseData
        }
      })
      .eq('id', payment.id);

    return new Response(
      JSON.stringify({
        success: true,
        purchase_id: purchaseData.id,
        payment_url: purchaseData.checkout_url,
        payment_id: payment.id,
        amount: amount
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in chip-credits-topup:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
};

async function handleWebhook(req: Request, signature: string): Promise<Response> {
  try {
    const webhookData = await req.json();

    console.log('🔔 CHIP Webhook received:', JSON.stringify(webhookData, null, 2));
    console.log('🔐 Signature:', signature);

    // Extract purchase data
    const purchaseId = webhookData.id;
    const status = webhookData.status;
    const eventType = webhookData.event_type || 'purchase.updated';

    console.log(`📋 Purchase ${purchaseId} - Status: ${status} - Event: ${eventType}`);

    if (!purchaseId) {
      console.error('❌ Missing purchase ID in webhook');
      return new Response('Missing purchase ID', { status: 400 });
    }

    // Find payment record by CHIP purchase ID
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*')
      .eq('chip_purchase_id', purchaseId)
      .maybeSingle();

    if (paymentError || !payment) {
      console.error('❌ Payment not found for purchase:', purchaseId);
      return new Response('Payment not found', { status: 404 });
    }

    // IMPORTANT: Only process if payment is currently pending
    // This prevents double-processing or overwriting successful payments
    if (payment.status === 'paid') {
      console.log('⚠️ Payment already marked as paid, skipping:', payment.id);
      return new Response(JSON.stringify({ message: 'Payment already processed' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Map CHIP status to our payment status
    // CHIP statuses: created, sent, viewed, error, cancelled, overdue, expired,
    //                hold, released, pending_release, pending_capture, preauthorized,
    //                paid, pending_execute, pending_charge, retrieved, charged_back,
    //                pending_refund, refunded
    let newStatus = 'pending';

    if (status === 'paid') {
      newStatus = 'paid';
    } else if (['error', 'cancelled', 'expired', 'charged_back'].includes(status)) {
      newStatus = 'failed';
    } else if (['created', 'sent', 'viewed', 'pending_execute', 'pending_charge', 'pending_capture'].includes(status)) {
      newStatus = 'pending';
    } else if (['hold', 'preauthorized'].includes(status)) {
      newStatus = 'pending'; // Funds authorized but not captured
    } else if (['refunded', 'pending_refund'].includes(status)) {
      newStatus = 'refunded';
    }

    console.log(`📝 Payment ${payment.id} status changing: ${payment.status} → ${newStatus}`);

    // Update payment status
    const paid_at = status === 'paid' ? new Date().toISOString() : null;

    await supabase
      .from('payments')
      .update({
        status: newStatus,
        paid_at,
        updated_at: new Date().toISOString(),
        metadata: {
          ...payment.metadata,
          chip_status: status,
          chip_webhook_data: webhookData,
          last_event: eventType
        }
      })
      .eq('id', payment.id);

    console.log(`✅ Payment ${payment.id} status updated to: ${newStatus} (CHIP: ${status})`);

    // ONLY add credits if payment is 100% successful (status = 'paid')
    if (status === 'paid' && newStatus === 'paid') {
      console.log(`💰 Payment SUCCESSFUL - Adding RM${payment.amount} credits to user ${payment.user_id}`);

      // Double-check: verify payment record is actually marked as paid
      const { data: verifyPayment } = await supabase
        .from('payments')
        .select('status')
        .eq('id', payment.id)
        .single();

      if (verifyPayment?.status !== 'paid') {
        console.error('❌ Payment verification failed - status not paid');
        return new Response(JSON.stringify({ error: 'Payment verification failed' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Use the database function to add credits
      const { error: creditsError } = await supabase.rpc('add_credits', {
        p_user_id: payment.user_id,
        p_amount: payment.amount,
        p_payment_id: payment.id,
        p_description: `Credits top-up - RM${payment.amount} via CHIP`
      });

      if (creditsError) {
        console.error('❌ Error adding credits:', creditsError);
        // Revert payment status to failed since credits weren't added
        await supabase
          .from('payments')
          .update({ status: 'failed' })
          .eq('id', payment.id);
        return new Response(JSON.stringify({ error: 'Error adding credits' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      console.log(`✅ Credits added successfully to user ${payment.user_id}`);
    } else {
      console.log(`ℹ️ Payment status is "${status}" (mapped to "${newStatus}") - ${newStatus === 'paid' ? 'Credits will be added' : 'NO credits added'}`);
    }

    return new Response(JSON.stringify({ message: 'OK', status: newStatus }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('❌ Error processing webhook:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

serve(handler);
