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

// 🔍 DEBUG: Log environment variables on startup (v2)
console.log('🔧 Environment check (redeployed):');
console.log('  CHIP_API_KEY:', CHIP_API_KEY ? '✅ Set (' + CHIP_API_KEY.substring(0, 20) + '...)' : '❌ NOT SET');
console.log('  CHIP_BRAND_ID:', CHIP_BRAND_ID ? '✅ Set (' + CHIP_BRAND_ID + ')' : '❌ NOT SET');

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Handle GET requests (health checks from CHIP)
  if (req.method === 'GET') {
    return new Response(JSON.stringify({ status: 'ok', message: 'CHIP webhook endpoint ready' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
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

    // Extract purchase data from webhook
    const purchaseId = webhookData.id;

    if (!purchaseId) {
      console.error('❌ Missing purchase ID in webhook');
      return new Response('Missing purchase ID', { status: 400 });
    }

    console.log(`📋 Webhook for Purchase ${purchaseId} - Verifying with CHIP API...`);

    // 🔒 SECURITY: Query CHIP API to verify payment status (don't trust webhook payload)
    const verifyResponse = await fetch(`${CHIP_BASE_URL}/purchases/${purchaseId}/`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CHIP_API_KEY}`,
        'Content-Type': 'application/json',
      }
    });

    if (!verifyResponse.ok) {
      console.error(`❌ Failed to verify purchase from CHIP API: ${verifyResponse.status}`);
      return new Response('Failed to verify purchase', { status: 500 });
    }

    const chipPurchaseData = await verifyResponse.json();
    console.log('✅ Verified purchase from CHIP API:', JSON.stringify(chipPurchaseData, null, 2));

    // Use verified data from API, not webhook payload
    const status = chipPurchaseData.status;
    const eventType = webhookData.event_type || 'purchase.updated';
    const transactionId = chipPurchaseData.transaction_data?.id || chipPurchaseData.transaction?.id || purchaseId;

    console.log(`📋 Purchase ${purchaseId} - Verified Status: ${status} - Event: ${eventType} - Transaction: ${transactionId}`);

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
        chip_transaction_id: transactionId,
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

      // Fetch dynamic pricing from system settings
      const { data: pricingSetting, error: pricingError } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'pricing_per_minute')
        .single();

      if (pricingError) {
        console.error('❌ Error fetching pricing setting:', pricingError);
        // Revert payment status to failed
        await supabase
          .from('payments')
          .update({ status: 'failed' })
          .eq('id', payment.id);
        return new Response(JSON.stringify({ error: 'Error fetching pricing configuration' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const PRICE_PER_MINUTE = parseFloat(pricingSetting.setting_value);
      const minutesToAdd = payment.amount / PRICE_PER_MINUTE;

      console.log(`💰 Converting RM${payment.amount} to ${minutesToAdd.toFixed(2)} minutes (@ RM${PRICE_PER_MINUTE}/min)`);

      // Get current pro balance
      const { data: userData, error: userFetchError } = await supabase
        .from('users')
        .select('pro_balance_minutes')
        .eq('id', payment.user_id)
        .single();

      if (userFetchError) {
        console.error('❌ Error fetching user balance:', userFetchError);
        // Revert payment status to failed since credits weren't added
        await supabase
          .from('payments')
          .update({ status: 'failed' })
          .eq('id', payment.id);
        return new Response(JSON.stringify({ error: 'Error fetching user balance' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const currentBalance = userData.pro_balance_minutes || 0;
      const newBalance = currentBalance + minutesToAdd;

      console.log(`💰 Adding ${minutesToAdd.toFixed(2)} minutes to pro balance: ${currentBalance.toFixed(2)} → ${newBalance.toFixed(2)}`);

      // Update pro_balance_minutes
      const { error: updateError } = await supabase
        .from('users')
        .update({ pro_balance_minutes: newBalance })
        .eq('id', payment.user_id);

      if (updateError) {
        console.error('❌ Error updating pro balance:', updateError);
        // Revert payment status to failed since credits weren't added
        await supabase
          .from('payments')
          .update({ status: 'failed' })
          .eq('id', payment.id);
        return new Response(JSON.stringify({ error: 'Error updating pro balance' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Create a transaction record for tracking
      const { error: txError } = await supabase
        .from('credits_transactions')
        .insert({
          user_id: payment.user_id,
          transaction_type: 'topup',
          amount: minutesToAdd,
          balance_before: currentBalance,
          balance_after: newBalance,
          description: `CHIP top-up - RM${payment.amount} (${minutesToAdd.toFixed(2)} minutes)`,
          payment_id: payment.id
        });

      if (txError) {
        console.error('⚠️ Error creating transaction record:', txError);
        // Don't fail the whole operation if transaction record fails
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
