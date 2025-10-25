/**
 * Billplz Credits Top-Up Handler
 *
 * Allows clients to buy credits via Billplz/FPX payment
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

const BILLPLZ_API_KEY = Deno.env.get('BILLPLZ_API_KEY');
const BILLPLZ_BASE_URL = 'https://www.billplz.com/api/v3';
const BILLPLZ_COLLECTION_ID = Deno.env.get('BILLPLZ_COLLECTION_ID') || 'watojri1';

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const contentType = req.headers.get('content-type') || '';

    // Check if it's a webhook from Billplz
    if (req.method === 'POST' && contentType.includes('application/x-www-form-urlencoded')) {
      return await handleWebhook(req);
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

    // Get app origin dynamically from request or environment
    const origin = req.headers.get('origin') || req.headers.get('referer')?.split('/').slice(0, 3).join('/');
    let appOrigin = origin || Deno.env.get('APP_ORIGIN');

    // Fallback to constructed URL only if no origin found
    if (!appOrigin) {
      const projectId = Deno.env.get('SUPABASE_URL')?.includes('ahexnoaazbveiyhplfrc')
        ? 'ahexnoaazbveiyhplfrc'
        : '';
      appOrigin = `https://${projectId}.lovable.app`;
    }

    console.log(`🌐 Using app origin: ${appOrigin}`);

    // Create Billplz bill
    const billPlzData = new URLSearchParams({
      collection_id: BILLPLZ_COLLECTION_ID,
      email: userEmail,
      name: userName,
      amount: (amount * 100).toString(), // Convert to cents
      description: description || `Credits Top-up RM${amount}`,
      callback_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/billplz-credits-topup`,
      redirect_url: `${appOrigin}/credits-topup`,
      reference_1_label: 'Credits Top-up',
      reference_1: `RM${amount}`
    });

    const response = await fetch(`${BILLPLZ_BASE_URL}/bills`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(BILLPLZ_API_KEY + ':')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: billPlzData.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('BillPlz API error:', errorText);
      throw new Error(`BillPlz API error: ${response.status}`);
    }

    const billData = await response.json();

    // Update payment record with Billplz bill ID
    await supabase
      .from('payments')
      .update({
        billplz_bill_id: billData.id,
        billplz_url: billData.url,
        metadata: {
          type: 'credits_topup',
          description: description || `Credits Top-up RM${amount}`,
          billplz_data: billData
        }
      })
      .eq('id', payment.id);

    console.log('✅ Billplz bill created:', billData.id);

    return new Response(
      JSON.stringify({
        success: true,
        bill_id: billData.id,
        payment_url: billData.url,
        payment_id: payment.id,
        amount: amount
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in billplz-credits-topup:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
};

async function handleWebhook(req: Request): Promise<Response> {
  try {
    const formData = await req.formData();

    const billplz_id = formData.get('id') as string || formData.get('billplz[id]') as string;
    const billplz_paid = formData.get('paid') as string || formData.get('billplz[paid]') as string;
    const billplz_paid_at = formData.get('paid_at') as string || formData.get('billplz[paid_at]') as string;
    const billplz_state = formData.get('state') as string || formData.get('billplz[state]') as string;

    console.log('🔔 Webhook received - Bill ID:', billplz_id, 'Paid:', billplz_paid, 'State:', billplz_state);

    if (!billplz_id) {
      console.error('❌ Missing bill ID in webhook');
      return new Response('Missing bill ID', { status: 400 });
    }

    // Find payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*')
      .eq('billplz_bill_id', billplz_id)
      .maybeSingle();

    if (paymentError || !payment) {
      console.error('❌ Payment not found for bill:', billplz_id);
      return new Response('Payment not found', { status: 404 });
    }

    // IMPORTANT: Only process if payment is currently pending
    // This prevents double-processing or overwriting successful payments
    if (payment.status === 'paid') {
      console.log('⚠️ Payment already marked as paid, skipping:', payment.id);
      return new Response('Payment already processed', { status: 200 });
    }

    // Determine payment status based on Billplz response
    // CRITICAL: Only 'paid' === 'true' AND 'state' === 'paid' means SUCCESS
    const isPaidSuccess = billplz_paid === 'true' && billplz_state === 'paid';
    const newStatus = isPaidSuccess ? 'paid' : 'failed';
    const paid_at = isPaidSuccess && billplz_paid_at ? new Date(billplz_paid_at) : null;

    console.log(`📝 Payment ${payment.id} status changing: ${payment.status} → ${newStatus}`);

    // Update payment status
    await supabase
      .from('payments')
      .update({
        status: newStatus,
        paid_at,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment.id);

    console.log(`✅ Payment ${payment.id} status updated to: ${newStatus}`);

    // ONLY add credits if payment is 100% successful
    if (isPaidSuccess) {
      console.log(`💰 Payment SUCCESSFUL - Adding RM${payment.amount} credits to user ${payment.user_id}`);

      // Double-check: verify payment record is actually marked as paid
      const { data: verifyPayment } = await supabase
        .from('payments')
        .select('status')
        .eq('id', payment.id)
        .single();

      if (verifyPayment?.status !== 'paid') {
        console.error('❌ Payment verification failed - status not paid');
        return new Response('Payment verification failed', { status: 500 });
      }

      // Use the database function to add credits
      const { error: creditsError } = await supabase.rpc('add_credits', {
        p_user_id: payment.user_id,
        p_amount: payment.amount,
        p_payment_id: payment.id,
        p_description: `Credits top-up - RM${payment.amount} via Billplz`
      });

      if (creditsError) {
        console.error('❌ Error adding credits:', creditsError);
        // Revert payment status to failed since credits weren't added
        await supabase
          .from('payments')
          .update({ status: 'failed' })
          .eq('id', payment.id);
        return new Response('Error adding credits', { status: 500 });
      }

      console.log(`✅ Credits added successfully to user ${payment.user_id}`);
    } else {
      console.log(`❌ Payment NOT successful (paid: ${billplz_paid}, state: ${billplz_state}) - NO credits added`);
    }

    return new Response('OK', { status: 200 });

  } catch (error: any) {
    console.error('❌ Error processing webhook:', error);
    return new Response('Internal server error', { status: 500 });
  }
}

serve(handler);
