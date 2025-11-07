import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, Clock, CreditCard, CheckCircle } from 'lucide-react';
import { useCustomAuth } from '@/contexts/CustomAuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  getUserSubscription,
  createUserTrialSubscription,
  canMakeCallsSync,
  getRemainingTrialDays,
  createBillplzPayment,
  getProPlan,
  type UserSubscription,
  type SubscriptionPlan,
} from '@/lib/billing';

export function BillingSection() {
  const { user, refreshUser } = useCustomAuth();
  const { toast } = useToast();
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [proPlan, setProPlan] = useState<SubscriptionPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadSubscription();
    }
  }, [user]);

  const loadSubscription = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Load both subscription and plan data
      const [userSubscription, planData] = await Promise.all([
        getUserSubscription(user.id).then(async (sub) => {
          // If no subscription exists, create trial
          if (!sub) {
            return await createUserTrialSubscription(user.id);
          }
          return sub;
        }),
        getProPlan()
      ]);
      
      setSubscription(userSubscription);
      setProPlan(planData);
      
      if (!planData) {
        setError('Pro Plan not available. Please contact support.');
      }
    } catch (err: any) {
      console.error('Error loading subscription:', err);
      setError('Failed to load subscription data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBillplzPayment = async () => {
    if (!user) {
      toast({
        title: "Error",
        description: "User information not available",
        variant: "destructive",
      });
      return;
    }

    // Check if user has saved phone number and email
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('email, phone_number')
        .eq('id', user.id)
        .single();

      if (userError) throw userError;

      if (!userData?.email || !userData?.phone_number) {
        toast({
          title: "Profile Incomplete",
          description: "Please save your email and phone number in Profile settings before subscribing.",
          variant: "destructive",
        });
        return;
      }
    } catch (error) {
      console.error('Error checking user data:', error);
      toast({
        title: "Error",
        description: "Failed to verify user information",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubscribing(true);
      
      const result = await createBillplzPayment(user.id);

      if (result) {
        // Open Billplz payment page in new tab
        window.open(result.payment_url, '_blank');
        
        toast({
          title: "Redirecting to Payment",
          description: "Please complete your payment with Billplz/FPX in the new window.",
        });
      } else {
        throw new Error('Failed to create Billplz payment');
      }
    } catch (error: any) {
      console.error('Billplz payment error:', error);
      toast({
        title: "Payment Error",
        description: error.message || "Failed to create payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubscribing(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Billing & Subscription</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Billing & Subscription</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button 
            onClick={loadSubscription} 
            variant="outline" 
            className="mt-4"
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isTrialActive = subscription?.status === 'trial' && canMakeCallsSync(subscription);
  const isSubscriptionActive = subscription?.status === 'active';
  const canCall = canMakeCallsSync(subscription);
  const remainingDays = subscription ? getRemainingTrialDays(subscription) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Billing & Subscription</CardTitle>
        <CardDescription>
          Manage your subscription and billing information
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!canCall && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Your trial has expired or you don't have an active subscription. 
              You cannot make calls until you subscribe to a plan.
            </AlertDescription>
          </Alert>
        )}

        {/* Current Status */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Current Status</h3>
          <div className="flex items-center gap-4">
            {isSubscriptionActive ? (
              <>
                <Badge variant="default" className="bg-green-100 text-green-800">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Subscription Active
                </Badge>
                {subscription?.current_period_end && (
                  <span className="text-sm text-muted-foreground">
                    Valid until {new Date(subscription.current_period_end).toLocaleDateString()}
                  </span>
                )}
              </>
            ) : isTrialActive ? (
              <>
                <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                  <Clock className="w-3 h-3 mr-1" />
                  Free Trial
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {remainingDays} day{remainingDays !== 1 ? 's' : ''} remaining
                </span>
              </>
            ) : (
              <Badge variant="destructive">
                <AlertCircle className="w-3 h-3 mr-1" />
                Expired
              </Badge>
            )}
          </div>
        </div>

        {/* Subscription Plan */}
        {proPlan && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Pro Plan - Billplz & FPX Payment</h3>
            <Card className="border-2 border-primary/20">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl">{proPlan.name}</CardTitle>
                    <CardDescription>{proPlan.description}</CardDescription>
                  </div>
                  {isSubscriptionActive && (
                    <Badge variant="default">Current Plan</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-3xl font-bold">
                    {proPlan.currency} {Number(proPlan.price).toFixed(2)}
                    <span className="text-sm font-normal text-muted-foreground">
                      /{proPlan.interval_type}
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm">Unlimited AI calls</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm">Priority support</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm">Advanced analytics</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm">Secure Billplz/FPX payments</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {!isSubscriptionActive ? (
                      <Button
                        onClick={handleBillplzPayment}
                        disabled={subscribing}
                        className="flex-1"
                        size="lg"
                      >
                        {subscribing ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <CreditCard className="w-4 h-4 mr-2" />
                            {isTrialActive ? 'Upgrade with Billplz' : 'Subscribe with Billplz'}
                          </>
                        )}
                      </Button>
                    ) : (
                      <div className="flex flex-col gap-2 w-full">
                        <Badge variant="default" className="text-center py-2">
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Subscribed
                        </Badge>
                        {subscription?.current_period_end && (
                          <span className="text-sm text-muted-foreground text-center">
                            Valid until {new Date(subscription.current_period_end).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Trial Information */}
        {!isSubscriptionActive && (
          <div className="space-y-2">
            <h4 className="font-medium">Trial Information</h4>
            <p className="text-sm text-muted-foreground">
              New users get a 7-day free trial with full access to all features. 
              After the trial period, you'll need to subscribe to continue using the service.
            </p>
          </div>
        )}

      </CardContent>
    </Card>
  );
}