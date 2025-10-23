import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CreditCard, Wallet, TrendingUp, DollarSign, Info } from 'lucide-react';
import { useCustomAuth } from '@/contexts/CustomAuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import Swal from 'sweetalert2';

export default function CreditsTopup() {
  const { user } = useCustomAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [creditsBalance, setCreditsBalance] = useState(0);
  const [totalMinutesUsed, setTotalMinutesUsed] = useState(0);
  const [topupAmount, setTopupAmount] = useState<number>(100); // Default RM100
  const [customAmount, setCustomAmount] = useState<string>('');

  const predefinedAmounts = [50, 100, 200, 500, 1000];

  useEffect(() => {
    if (user) {
      loadCreditsInfo();
    }
  }, [user]);

  const loadCreditsInfo = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get user's credits balance
      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      setCreditsBalance((userData as any)?.credits_balance || 0);
      setTotalMinutesUsed((userData as any)?.total_minutes_used || 0);

    } catch (error: any) {
      console.error('Error loading credits:', error);
      toast({
        title: 'Error',
        description: 'Failed to load credits balance',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTopup = async () => {
    if (!user) return;

    const amount = customAmount ? parseFloat(customAmount) : topupAmount;

    if (!amount || amount < 10) {
      toast({
        title: 'Invalid Amount',
        description: 'Minimum top-up amount is RM10',
        variant: 'destructive',
      });
      return;
    }

    try {
      setProcessing(true);

      // Create Billplz payment for credits top-up
      const { data, error } = await supabase.functions.invoke('billplz-credits-topup', {
        body: {
          user_id: user.id,
          amount: amount,
          description: `Credits Top-up - RM${amount.toFixed(2)}`
        }
      });

      if (error) throw error;

      // Open payment page in new tab
      window.open(data.payment_url, '_blank');

      toast({
        title: 'Redirecting to Payment',
        description: 'Please complete your payment with Billplz/FPX in the new window.',
      });

    } catch (error: any) {
      console.error('Top-up error:', error);

      // Show SweetAlert error
      Swal.fire({
        icon: 'error',
        title: 'Failed to Create Payment',
        html: `
          <div style="text-align: left;">
            <p><strong>An error occurred while creating your payment.</strong></p>
            <p>${error.message || 'Please try again later.'}</p>
            <br/>
            <p><strong>Possible causes:</strong></p>
            <ul style="text-align: left; padding-left: 20px;">
              <li>Billplz API keys not configured</li>
              <li>Edge function not deployed</li>
              <li>Network connection issue</li>
            </ul>
          </div>
        `,
        confirmButtonText: 'OK',
        confirmButtonColor: '#ef4444',
      });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </div>
    );
  }

  const estimatedMinutes = creditsBalance / 0.15; // RM0.15 per minute

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Credits Top-Up</h1>
        <p className="text-muted-foreground">Buy credits to make AI calls to your customers</p>
      </div>

      {/* Current Balance Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">RM {creditsBalance.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              ~{estimatedMinutes.toFixed(0)} minutes available
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Minutes Used</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMinutesUsed.toFixed(1)} min</div>
            <p className="text-xs text-muted-foreground">
              RM {(totalMinutesUsed * 0.15).toFixed(2)} spent
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rate</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">RM 0.15</div>
            <p className="text-xs text-muted-foreground">per minute</p>
          </CardContent>
        </Card>
      </div>

      {/* Pricing Alert */}
      <Alert className="border-primary/20 bg-primary/5">
        <Info className="h-4 w-4 text-primary" />
        <AlertDescription>
          <div className="space-y-1">
            <p className="font-medium">Pricing: RM 0.15 per minute</p>
            <p className="text-sm">
              This includes AI voice processing, speech recognition, and text-to-speech.
              Affordable and cost-effective! 🎉
            </p>
          </div>
        </AlertDescription>
      </Alert>

      {/* Top-Up Card */}
      <Card>
        <CardHeader>
          <CardTitle>Select Top-Up Amount</CardTitle>
          <CardDescription>
            Choose a predefined amount or enter a custom amount (minimum RM10)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Predefined Amounts */}
          <div>
            <Label className="mb-2 block">Quick Select</Label>
            <div className="grid grid-cols-5 gap-2">
              {predefinedAmounts.map((amount) => (
                <Button
                  key={amount}
                  variant={topupAmount === amount && !customAmount ? "default" : "outline"}
                  onClick={() => {
                    setTopupAmount(amount);
                    setCustomAmount('');
                  }}
                  className="flex flex-col h-auto py-3"
                >
                  <span className="text-lg font-bold">RM{amount}</span>
                  <span className="text-xs text-muted-foreground">
                    ~{(amount / 0.15).toFixed(0)} min
                  </span>
                </Button>
              ))}
            </div>
          </div>

          {/* Custom Amount */}
          <div>
            <Label htmlFor="custom-amount">Custom Amount (RM)</Label>
            <Input
              id="custom-amount"
              type="number"
              placeholder="Enter custom amount (min RM10)"
              value={customAmount}
              onChange={(e) => {
                setCustomAmount(e.target.value);
                setTopupAmount(0);
              }}
              min={10}
              step={10}
            />
            {customAmount && parseFloat(customAmount) >= 10 && (
              <p className="text-sm text-muted-foreground mt-1">
                ~{(parseFloat(customAmount) / 0.15).toFixed(0)} minutes
              </p>
            )}
          </div>

          {/* Summary */}
          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Current Balance:</span>
              <span className="font-medium">RM {creditsBalance.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Top-Up Amount:</span>
              <span className="font-medium">
                RM {(customAmount ? parseFloat(customAmount) : topupAmount).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>New Balance:</span>
              <span className="text-primary">
                RM {(creditsBalance + (customAmount ? parseFloat(customAmount) : topupAmount)).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Payment Button */}
          <Button
            onClick={handleTopup}
            disabled={processing || (!topupAmount && !customAmount)}
            size="lg"
            className="w-full"
          >
            {processing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4 mr-2" />
                Pay with Billplz/FPX
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Secure payment via Billplz. Supports FPX (Malaysian banks).
          </p>
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>Your latest credits transactions</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Coming soon - view your transaction history here
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
