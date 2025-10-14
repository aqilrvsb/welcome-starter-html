import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateBillRequest {
  collection_id: string;
  email: string;
  mobile?: string;
  name: string;
  amount: number;
  description: string;
  reference_1_label?: string;
  reference_1?: string;
  user_id: string;
  subscription_id?: string;
}

interface BillPlzResponse {
  id: string;
  collection_id: string;
  paid: boolean;
  state: string;
  amount: number;
  paid_amount: number;
  due_at: string;
  email: string;
  mobile: string | null;
  name: string;
  url: string;
  reference_1_label: string | null;
  reference_1: string | null;
  redirect_url: string | null;
  callback_url: string | null;
  description: string;
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const BILLPLZ_API_KEY = Deno.env.get('BILLPLZ_API_KEY');
const BILLPLZ_BASE_URL = 'https://www.billplz.com/api/v3';

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    
    // Check if it's a webhook (from Billplz) - webhooks send form data
    if (req.method === 'POST' && contentType.includes('application/x-www-form-urlencoded')) {
      return await handleWebhook(req);
    }

    // For regular API calls from frontend, check the action in the body
    const body = await req.json();
    const action = body.action;

    switch (action) {
      case 'create-bill':
        return await createBill(req, body);
      case 'get-bill':
        return await getBillStatus(req, body);
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action. Please specify action: create-bill or get-bill' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
    }
  } catch (error: any) {
    console.error('Error in billplz-integration:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
};

async function createBill(req: Request, body: any): Promise<Response> {
  const {
    collection_id,
    email,
    mobile,
    name,
    amount,
    description,
    reference_1_label,
    reference_1,
    user_id,
    subscription_id
  } = body;

  if (!BILLPLZ_API_KEY) {
    throw new Error('BillPlz API key not configured');
  }

  // Create payment record in database first
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .insert({
      user_id,
      subscription_id,
      amount,
      currency: 'MYR',
      status: 'pending',
    })
    .select()
    .single();

  if (paymentError) {
    console.error('Error creating payment record:', paymentError);
    throw new Error('Failed to create payment record');
  }

  // Get the app origin from environment or construct from known domains
  // Priority: ENV variable > Production domain > Staging domain
  let appOrigin = Deno.env.get('APP_ORIGIN');
  
  if (!appOrigin) {
    // Default to common Lovable domains
    const projectId = Deno.env.get('SUPABASE_URL')?.includes('ahexnoaazbveiyhplfrc')
      ? 'ahexnoaazbveiyhplfrc'
      : '';
    appOrigin = `https://${projectId}.lovable.app`;
  }
  
  console.log('Using app origin for redirect:', appOrigin);
  
  // Prepare BillPlz API request - redirect to dashboard for both success and cancel
  const billPlzData = new URLSearchParams({
    collection_id,
    email,
    name,
    amount: (amount * 100).toString(), // BillPlz expects amount in cents
    description,
    callback_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/billplz-integration`,
    redirect_url: `${appOrigin}/dashboard`, // Redirect to dashboard for both success and cancel
  });

  if (mobile) billPlzData.append('mobile', mobile);
  if (reference_1_label) billPlzData.append('reference_1_label', reference_1_label);
  if (reference_1) billPlzData.append('reference_1', reference_1);

  // Create bill with BillPlz
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
    throw new Error(`BillPlz API error: ${response.status} ${errorText}`);
  }

  const billData: BillPlzResponse = await response.json();

  // Update payment record with BillPlz bill ID and URL
  const { error: updateError } = await supabase
    .from('payments')
    .update({
      billplz_bill_id: billData.id,
      billplz_url: billData.url,
      metadata: billData,
    })
    .eq('id', payment.id);

  if (updateError) {
    console.error('Error updating payment record:', updateError);
  }

  console.log('Bill created successfully:', billData.id);

  return new Response(
    JSON.stringify({
      success: true,
      bill_id: billData.id,
      payment_url: billData.url,
      payment_id: payment.id,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function handleWebhook(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const formData = await req.formData();
    
    // Parse Billplz webhook data - Billplz can send with or without 'billplz[' prefix
    let billplz_id = formData.get('id') as string || formData.get('billplz[id]') as string;
    let billplz_paid = formData.get('paid') as string || formData.get('billplz[paid]') as string;
    let billplz_paid_at = formData.get('paid_at') as string || formData.get('billplz[paid_at]') as string;

    console.log('Webhook received - Bill ID:', billplz_id, 'Paid:', billplz_paid, 'Paid At:', billplz_paid_at);

    if (!billplz_id) {
      console.error('No bill ID found in webhook data');
      return new Response('Missing bill ID', { status: 400 });
    }

    // Find payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*')
      .eq('billplz_bill_id', billplz_id)
      .maybeSingle();

    if (paymentError || !payment) {
      console.error('Payment not found for bill_id:', billplz_id, paymentError);
      return new Response('Payment not found', { status: 404 });
    }

    // Update payment status
    const newStatus = billplz_paid === 'true' ? 'paid' : 'failed';
    const paid_at = billplz_paid === 'true' && billplz_paid_at ? new Date(billplz_paid_at) : null;

    const { error: updateError } = await supabase
      .from('payments')
      .update({
        status: newStatus,
        paid_at,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment.id);

    if (updateError) {
      console.error('Error updating payment:', updateError);
      return new Response('Error updating payment', { status: 500 });
    }

    console.log('Payment updated successfully. Status:', newStatus);

    // If payment is successful, activate the subscription
    if (billplz_paid === 'true') {
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      let subscriptionId = payment.subscription_id;

      // If no subscription_id in payment, fetch user's latest subscription
      if (!subscriptionId) {
        const { data: userSub, error: fetchError } = await supabase
          .from('user_subscriptions')
          .select('id')
          .eq('user_id', payment.user_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (fetchError) {
          console.error('Error fetching user subscription:', fetchError);
        } else if (userSub) {
          subscriptionId = userSub.id;
        }
      }

      // Update the subscription to active
      if (subscriptionId) {
        const { error: subscriptionError } = await supabase
          .from('user_subscriptions')
          .update({
            status: 'active',
            current_period_start: new Date().toISOString(),
            current_period_end: nextMonth.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', subscriptionId);

        if (subscriptionError) {
          console.error('Error updating subscription:', subscriptionError);
        } else {
          console.log('Subscription activated successfully for user:', payment.user_id, 'subscription:', subscriptionId);
        }
      } else {
        console.error('No subscription found for user:', payment.user_id);
      }
    }

    return new Response('OK', { status: 200 });
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    return new Response('Internal server error', { status: 500 });
  }
}

async function getBillStatus(req: Request, body: any): Promise<Response> {
  const billId = body.bill_id;

  if (!billId) {
    return new Response(
      JSON.stringify({ error: 'Bill ID required' }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  if (!BILLPLZ_API_KEY) {
    throw new Error('BillPlz API key not configured');
  }

  const response = await fetch(`${BILLPLZ_BASE_URL}/bills/${billId}`, {
    headers: {
      'Authorization': `Basic ${btoa(BILLPLZ_API_KEY + ':')}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get bill status: ${response.status}`);
  }

  const billData = await response.json();

  return new Response(
    JSON.stringify(billData),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

serve(handler);