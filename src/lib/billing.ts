import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

// Use the types from the database schema
export type UserSubscription = Database['public']['Tables']['user_subscriptions']['Row'];
export type SubscriptionPlan = Database['public']['Tables']['subscription_plans']['Row'];
export type Payment = Database['public']['Tables']['payments']['Row'];

// Billplz configuration
export const BILLPLZ_CONFIG = {
  COLLECTION_ID: 'watojri1', // Your Billplz collection ID
} as const;

export const createUserTrialSubscription = async (userId: string): Promise<UserSubscription | null> => {
  try {
    // Check if user already has a subscription
    const { data: existingSubscription, error: checkError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking existing subscription:', checkError);
      return null;
    }

    if (existingSubscription) {
      return existingSubscription;
    }

    // Create trial using database function
    const { data, error } = await supabase.rpc('create_trial_subscription', {
      p_user_id: userId
    });

    if (error) {
      console.error('Error creating trial subscription:', error);
      return null;
    }

    // Fetch the created subscription
    const { data: subscription, error: fetchError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('id', data)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching subscription:', fetchError);
      return null;
    }

    return subscription;
  } catch (error) {
    console.error('Error creating trial subscription:', error);
    return null;
  }
};

export const getUserSubscription = async (userId: string): Promise<UserSubscription | null> => {
  try {
    // Expire old pending payments first
    await expirePendingPayments(userId);
    
    const { data: subscription, error } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error getting subscription:', error);
      return null;
    }

    if (!subscription) {
      // No subscription found, create trial
      return await createUserTrialSubscription(userId);
    }

    return subscription;
  } catch (error) {
    console.error('Error getting subscription:', error);
    return null;
  }
};

export const checkTrialStatus = (subscription: UserSubscription): boolean => {
  if (subscription.status !== 'trial' || !subscription.trial_end_date) return false;
  
  const now = new Date();
  const trialEnd = new Date(subscription.trial_end_date);
  
  return now < trialEnd;
};

export const canMakeCalls = async (userId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase.rpc('can_user_make_calls', {
      p_user_id: userId
    });

    if (error) {
      console.error('Error checking call permissions:', error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error('Error checking call permissions:', error);
    return false;
  }
};

export const canMakeCallsSync = (subscription: UserSubscription | null): boolean => {
  if (!subscription) return false;
  
  const now = new Date();
  
  // Check trial
  if (subscription.status === 'trial' && subscription.trial_end_date) {
    const trialEnd = new Date(subscription.trial_end_date);
    return now < trialEnd;
  }
  
  // Check active subscription
  if (subscription.status === 'active' && subscription.current_period_end) {
    const subscriptionEnd = new Date(subscription.current_period_end);
    return now < subscriptionEnd;
  }
  
  return false;
};

export const getSubscriptionPlans = async (): Promise<SubscriptionPlan[]> => {
  try {
    const { data: plans, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('price', { ascending: true });

    if (error) {
      console.error('Error fetching subscription plans:', error);
      return [];
    }

    return plans || [];
  } catch (error) {
    console.error('Error fetching subscription plans:', error);
    return [];
  }
};

// Get Pro Plan from database
export const getProPlan = async (): Promise<SubscriptionPlan | null> => {
  try {
    const { data: plan, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('name', 'Pro Plan')
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('Error fetching Pro plan:', error);
      return null;
    }

    return plan;
  } catch (error) {
    console.error('Error fetching Pro plan:', error);
    return null;
  }
};

// Billplz integration functions
export const createBillplzPayment = async (
  userId: string,
  planId?: string
): Promise<{ payment_url: string; payment_id: string } | null> => {
  try {
    const customAuthToken = localStorage.getItem('customAuthToken');
    if (!customAuthToken) {
      throw new Error('Authentication required');
    }

    if (!userId) {
      throw new Error('User ID is required');
    }

    // Get Pro Plan from database
    const proPlan = await getProPlan();
    if (!proPlan) {
      throw new Error('Pro Plan not found');
    }

    // Get user's subscription
    const subscription = await getUserSubscription(userId);
    if (!subscription) {
      throw new Error('No subscription found');
    }

    // Get user data from users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('username, email')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      throw new Error('User not found');
    }

    // Use the user's real email if available, otherwise use username-based email
    const userName = userData.username || 'User';
    const userEmail = userData.email || `${userId.substring(0, 8)}@custom.local`;

    const { data, error } = await supabase.functions.invoke('billplz-integration', {
      body: {
        action: 'create-bill',
        collection_id: BILLPLZ_CONFIG.COLLECTION_ID,
        email: userEmail,
        name: userName,
        amount: Number(proPlan.price),
        description: `${proPlan.name} - ${proPlan.description || 'Monthly Subscription'}`,
        reference_1_label: 'Subscription',
        reference_1: proPlan.name,
        user_id: userId,
        subscription_id: subscription.id, // Link payment to subscription
      },
      headers: {
        'Authorization': `Bearer ${customAuthToken}`
      }
    });

    if (error) {
      console.error('Error creating Billplz payment:', error);
      return null;
    }

    return {
      payment_url: data.payment_url,
      payment_id: data.payment_id
    };
  } catch (error) {
    console.error('Error creating Billplz payment:', error);
    throw error;
  }
};

// Check payment status
export const checkBillplzPayment = async (billId: string): Promise<any | null> => {
  try {
    const { data, error } = await supabase.functions.invoke('billplz-integration', {
      body: { 
        action: 'get-bill',
        bill_id: billId 
      }
    });

    if (error) {
      console.error('Error checking payment status:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error checking payment status:', error);
    return null;
  }
};

export const updateSubscriptionStatus = async (
  subscriptionId: string,
  status: UserSubscription['status'],
  currentPeriodEnd?: Date
): Promise<UserSubscription | null> => {
  try {
    const updates: Partial<UserSubscription> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (currentPeriodEnd) {
      updates.current_period_end = currentPeriodEnd.toISOString();
    }

    if (status === 'cancelled') {
      updates.cancelled_at = new Date().toISOString();
    }

    const { data: subscription, error } = await supabase
      .from('user_subscriptions')
      .update(updates)
      .eq('id', subscriptionId)
      .select()
      .single();

    if (error) {
      console.error('Error updating subscription:', error);
      return null;
    }

    return subscription;
  } catch (error) {
    console.error('Error updating subscription:', error);
    return null;
  }
};

export const getRemainingTrialDays = (subscription: UserSubscription): number => {
  if (subscription.status !== 'trial' || !subscription.trial_end_date) return 0;
  
  const now = new Date();
  const trialEnd = new Date(subscription.trial_end_date);
  const diffTime = trialEnd.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays);
};

// Expire pending payments older than 30 minutes
// This function is called automatically when fetching payments or subscription
export const expirePendingPayments = async (userId: string): Promise<void> => {
  try {
    const thirtyMinutesAgo = new Date();
    thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30);

    const { error } = await supabase
      .from('payments')
      .update({ 
        status: 'failed',
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('status', 'pending')
      .lt('created_at', thirtyMinutesAgo.toISOString());

    if (error) {
      console.error('Error expiring pending payments:', error);
    }
  } catch (error) {
    console.error('Error expiring pending payments:', error);
  }
};

export const getUserPayments = async (userId: string): Promise<Payment[]> => {
  try {
    // First, expire old pending payments
    await expirePendingPayments(userId);
    
    const { data: payments, error } = await supabase
      .from('payments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching payments:', error);
      return [];
    }

    return payments || [];
  } catch (error) {
    console.error('Error fetching payments:', error);
    return [];
  }
};

// ADMIN: Manual upgrade function for testing (uses Edge Function to bypass RLS)
export const manualUpgradeUserToPro = async (userId: string): Promise<UserSubscription | null> => {
  try {
    const { data, error } = await supabase.functions.invoke('manual-upgrade', {
      body: { user_id: userId },
    });

    if (error) {
      console.error('Edge function error (manual-upgrade):', error);
      return null;
    }

    return data as UserSubscription;
  } catch (err) {
    console.error('Error invoking manual-upgrade function:', err);
    return null;
  }
};