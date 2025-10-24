import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CreditCard, Wallet, TrendingUp, DollarSign, Info, Clock, Gift, ArrowUp, ArrowDown } from 'lucide-react';
import { useCustomAuth } from '@/contexts/CustomAuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import Swal from 'sweetalert2';
import { formatDistanceToNow } from 'date-fns';

interface Transaction {
  id: string;
  transaction_type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string;
  created_at: string;
}

export default function CreditsTopup() {
  const { user } = useCustomAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [creditsBalance, setCreditsBalance] = useState(0);
  const [totalMinutesUsed, setTotalMinutesUsed] = useState(0); // This will show Pro-only usage
  const [proMinutesUsed, setProMinutesUsed] = useState(0); // Track Pro account minutes separately
  const [trialMinutesUsed, setTrialMinutesUsed] = useState(0);
  const [trialMinutesTotal, setTrialMinutesTotal] = useState(10.0);
  const [accountType, setAccountType] = useState<'trial' | 'pro'>('trial');
  const [topupAmount, setTopupAmount] = useState<number>(20); // Default RM20
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const predefinedAmounts = [10, 20, 50, 100];

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
      setTrialMinutesUsed((userData as any)?.trial_minutes_used || 0);
      setTrialMinutesTotal((userData as any)?.trial_minutes_total || 10.0);
      setAccountType((userData as any)?.account_type || 'trial');

      // Calculate Pro-only minutes: total_minutes_used - trial_minutes_used
      const totalMins = (userData as any)?.total_minutes_used || 0;
      const trialMins = (userData as any)?.trial_minutes_used || 0;
      const proOnlyMins = Math.max(0, totalMins - trialMins);

      setProMinutesUsed(proOnlyMins);
      setTotalMinutesUsed(proOnlyMins); // Show Pro-only minutes in "Total Minutes Used" card

      // Get recent transactions
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('credits_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (transactionsError) {
        console.error('Error loading transactions:', transactionsError);
      } else {
        setTransactions(transactionsData || []);
      }

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

    const amount = topupAmount;

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

  const balanceMinutes = creditsBalance / 0.15; // RM0.15 per minute
  const trialMinutesRemaining = Math.max(0, trialMinutesTotal - trialMinutesUsed);

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Credits Top-Up</h1>
        <p className="text-muted-foreground">Buy credits to make AI calls to your customers</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Balance Minute */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Balance Minute</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{balanceMinutes.toFixed(1)} min</div>
          </CardContent>
        </Card>

        {/* Total Minutes Used - Always show, but displays Pro account usage only */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Minutes Used</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMinutesUsed.toFixed(1)} min</div>
            <p className="text-xs text-muted-foreground">Pro account usage only</p>
          </CardContent>
        </Card>

        {/* Trial Minute */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trial Minute</CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{trialMinutesRemaining.toFixed(1)} min</div>
            <p className="text-xs text-muted-foreground">
              {trialMinutesUsed.toFixed(1)} / {trialMinutesTotal.toFixed(1)} min used
            </p>
          </CardContent>
        </Card>

        {/* Rate */}
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
            Choose an amount based on the minutes you need (Rate: RM0.15 per minute)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Predefined Amounts with Larger Minute Display */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {predefinedAmounts.map((amount) => {
              const minutes = (amount / 0.15).toFixed(0);
              return (
                <Button
                  key={amount}
                  variant={topupAmount === amount ? "default" : "outline"}
                  onClick={() => setTopupAmount(amount)}
                  className="flex flex-col h-auto py-6 gap-2"
                >
                  <span className="text-2xl font-bold">RM{amount}</span>
                  <div className="flex items-center gap-1 text-sm">
                    <Clock className="h-4 w-4" />
                    <span className="text-lg font-semibold">~{minutes} min</span>
                  </div>
                </Button>
              );
            })}
          </div>

          {/* Payment Button */}
          <Button
            onClick={handleTopup}
            disabled={processing || !topupAmount}
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
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No transactions yet
            </p>
          ) : (
            <div className="space-y-3">
              {transactions.map((transaction) => {
                const isCredit = transaction.transaction_type === 'topup' || transaction.transaction_type === 'bonus';
                const Icon = isCredit ? ArrowUp : ArrowDown;
                const iconColor = isCredit ? 'text-green-600' : 'text-red-600';
                const amountColor = isCredit ? 'text-green-600' : 'text-red-600';
                const amountPrefix = isCredit ? '+' : '-';

                return (
                  <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full bg-muted ${iconColor}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{transaction.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(transaction.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${amountColor}`}>
                        {amountPrefix}RM{Math.abs(transaction.amount).toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Balance: RM{transaction.balance_after.toFixed(2)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
