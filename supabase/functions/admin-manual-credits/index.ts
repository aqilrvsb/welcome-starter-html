/**
 * Admin Manual Credits Edge Function
 *
 * Allows admins to manually add or deduct credits from user accounts
 * Creates transaction records for full audit trail
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, transaction_type, amount, description } = await req.json();

    // Validation
    if (!user_id || !transaction_type || !amount || !description) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!['topup', 'deduction'].includes(transaction_type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid transaction type' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (amount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Amount must be greater than 0' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get user details
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, account_type, trial_balance_minutes, pro_balance_minutes')
      .eq('id', user_id)
      .single();

    if (userError || !user) {
      console.error('❌ User not found:', userError);
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const accountType = user.account_type || 'trial';
    const balanceField = accountType === 'trial' ? 'trial_balance_minutes' : 'pro_balance_minutes';
    const currentBalance = accountType === 'trial' ? user.trial_balance_minutes : user.pro_balance_minutes;

    // Calculate new balance
    const balanceBefore = currentBalance;
    let balanceAfter;

    if (transaction_type === 'topup') {
      balanceAfter = balanceBefore + amount;
    } else {
      // deduction
      balanceAfter = Math.max(0, balanceBefore - amount); // Don't go negative
    }

    console.log(`💳 Admin Manual Credit: ${transaction_type} ${amount} min for user ${user_id}`);
    console.log(`   Account Type: ${accountType}`);
    console.log(`   Balance Before: ${balanceBefore.toFixed(2)} min`);
    console.log(`   Balance After: ${balanceAfter.toFixed(2)} min`);

    // Update user balance
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        [balanceField]: balanceAfter,
      })
      .eq('id', user_id);

    if (updateError) {
      console.error('❌ Failed to update balance:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update balance' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create transaction record
    const { data: transaction, error: transactionError } = await supabaseAdmin
      .from('credits_transactions')
      .insert({
        user_id,
        transaction_type: transaction_type === 'topup' ? 'bonus' : 'deduction',
        amount: transaction_type === 'topup' ? amount : -amount, // Store as positive for topup, negative for deduction
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        description: `[ADMIN] ${description}`,
        metadata: {
          admin_action: true,
          account_type: accountType,
          balance_type: balanceField,
        },
      })
      .select()
      .single();

    if (transactionError) {
      console.error('❌ Failed to create transaction record:', transactionError);
      // Note: Balance already updated, but transaction record failed
      // This is logged for manual review
      return new Response(
        JSON.stringify({
          warning: 'Balance updated but transaction record failed',
          balance_after: balanceAfter,
        }),
        {
          status: 207, // Multi-Status
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`✅ Admin manual credit transaction completed: ${transaction.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        transaction_id: transaction.id,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        account_type: accountType,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('❌ Error in admin manual credits:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
