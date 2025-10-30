import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CreditCard, Wallet, TrendingUp, DollarSign, Info, Clock, Gift, ArrowUp, ArrowDown, FileText, ExternalLink } from 'lucide-react';
import { useCustomAuth } from '@/contexts/CustomAuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useDynamicPricing } from '@/hooks/useDynamicPricing';
import Swal from 'sweetalert2';
import { formatDistanceToNow, format, parseISO, startOfMonth, isSameMonth } from 'date-fns';
import { motion } from 'framer-motion';

interface Transaction {
  id: string;
  transaction_type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string;
  created_at: string;
  status?: string; // For payments
  source?: 'payment' | 'transaction'; // To distinguish source
}

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.4, 0, 0.2, 1] as any,
    },
  },
};

export default function CreditsTopup() {
  const { user } = useCustomAuth();
  const { toast } = useToast();
  const { pricingPerMinute } = useDynamicPricing();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [creditsBalance, setCreditsBalance] = useState(0);
  const [totalMinutesUsed, setTotalMinutesUsed] = useState(0); // This will show Pro-only usage
  const [proMinutesUsed, setProMinutesUsed] = useState(0); // Track Pro account minutes separately
  const [trialBalanceMinutes, setTrialBalanceMinutes] = useState(10.0); // Remaining trial minutes
  const [proBalanceMinutes, setProBalanceMinutes] = useState(0); // Remaining pro minutes
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
      setTrialBalanceMinutes((userData as any)?.trial_balance_minutes || 0);
      setProBalanceMinutes((userData as any)?.pro_balance_minutes || 0);
      setAccountType((userData as any)?.account_type || 'trial');

      // Calculate total minutes used (Pro + Trial used)
      const totalMins = (userData as any)?.total_minutes_used || 0;
      setTotalMinutesUsed(totalMins);

      // Get ALL transactions - both payments and credits_transactions
      // This will show: successful payments, failed payments, cancelled payments, and usage deductions
      const [paymentsResult, transactionsResult] = await Promise.all([
        // Get payments (top-ups with status)
        supabase
          .from('payments')
          .select('id, amount, status, created_at, metadata')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),

        // Get credits transactions (top-ups and deductions)
        supabase
          .from('credits_transactions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
      ]);

      // Combine and format all transactions
      const allTransactions: Transaction[] = [];

      // Add payments with status
      if (paymentsResult.data) {
        paymentsResult.data.forEach((payment: any) => {
          let description = `Payment ${payment.status}`;
          let transaction_type = 'topup';

          if (payment.metadata?.description) {
            description = payment.metadata.description;
          } else if (payment.metadata?.type === 'credits_topup') {
            description = `Credits Top-up RM${payment.amount}`;
          }

          // Map status to transaction type
          if (payment.status === 'paid') {
            transaction_type = 'topup';
            description = `✅ ${description}`;
          } else if (payment.status === 'pending') {
            transaction_type = 'pending';
            description = `⏳ ${description} (Pending)`;
          } else if (payment.status === 'failed' || payment.status === 'cancelled') {
            transaction_type = 'failed';
            description = `❌ ${description} (${payment.status})`;
          }

          allTransactions.push({
            id: payment.id,
            transaction_type,
            amount: payment.amount,
            balance_before: 0,
            balance_after: 0,
            description,
            created_at: payment.created_at,
            status: payment.status,
            source: 'payment'
          });
        });
      }

      // Add credits transactions
      if (transactionsResult.data) {
        transactionsResult.data.forEach((trans: any) => {
          allTransactions.push({
            ...trans,
            source: 'transaction'
          });
        });
      }

      // Sort by date (newest first) and limit to 50
      allTransactions.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setTransactions(allTransactions.slice(0, 50));

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

  // Balance Minutes shows Pro balance (from pro_balance_minutes)
  const balanceMinutes = proBalanceMinutes;

  // Trial Minutes shows trial balance (from trial_balance_minutes)
  const trialMinutesRemaining = trialBalanceMinutes;

  // Calculate trial minutes used (default 10.0 - remaining)
  const trialMinutesUsedCalc = Math.max(0, 10.0 - trialBalanceMinutes);

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header with gradient background */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] as any }}
        className="p-8 rounded-2xl gradient-card card-soft"
      >
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-primary-light to-primary-dark bg-clip-text text-transparent mb-3">
          Credits Top-Up
        </h1>
        <p className="text-muted-foreground text-lg">Buy credits to make AI calls to your customers</p>
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-4 gap-4"
      >
        {/* Balance Minute */}
        <motion.div variants={itemVariants}>
          <motion.div
            whileHover={{ scale: 1.02, y: -4 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="card-soft border-primary/20 transition-smooth hover:border-primary/40">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Balance Minutes</CardTitle>
                <div className="p-2 rounded-lg bg-primary/10">
                  <Wallet className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">{balanceMinutes.toFixed(1)} min</div>
                <p className="text-xs text-muted-foreground mt-1">Available for calls</p>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* Total Minutes Used - Always show, but displays Pro account usage only */}
        <motion.div variants={itemVariants}>
          <motion.div
            whileHover={{ scale: 1.02, y: -4 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="card-soft border-primary/20 transition-smooth hover:border-primary/40">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Minutes Used</CardTitle>
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">{totalMinutesUsed.toFixed(1)} min</div>
                <p className="text-xs text-muted-foreground mt-1">Pro account usage only</p>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* Trial Minute */}
        <motion.div variants={itemVariants}>
          <motion.div
            whileHover={{ scale: 1.02, y: -4 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="card-soft border-success/20 transition-smooth hover:border-success/40">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Trial Minutes</CardTitle>
                <div className="p-2 rounded-lg bg-success/10">
                  <Gift className="h-4 w-4 text-success" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-success">{trialMinutesRemaining.toFixed(1)} min</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {trialMinutesUsedCalc.toFixed(1)} / 10.0 min used
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* Rate */}
        <motion.div variants={itemVariants}>
          <motion.div
            whileHover={{ scale: 1.02, y: -4 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="card-soft border-primary/20 transition-smooth hover:border-primary/40">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Rate</CardTitle>
                <div className="p-2 rounded-lg bg-primary/10">
                  <DollarSign className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">RM {pricingPerMinute.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground mt-1">per minute</p>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Pricing Alert */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <Alert className="border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 card-soft">
          <div className="p-2 rounded-lg bg-primary/20">
            <Info className="h-4 w-4 text-primary" />
          </div>
          <AlertDescription>
            <div className="space-y-1">
              <p className="font-semibold text-primary">Pricing: RM {pricingPerMinute.toFixed(2)} per minute</p>
              <p className="text-sm text-muted-foreground">
                This includes AI voice processing, speech recognition, and text-to-speech.
                Affordable and cost-effective!
              </p>
            </div>
          </AlertDescription>
        </Alert>
      </motion.div>

      {/* Top-Up Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <Card className="card-medium border-primary/20 transition-smooth hover:border-primary/30">
        <CardHeader>
          <CardTitle>Select Top-Up Amount</CardTitle>
          <CardDescription>
            Choose an amount based on the minutes you need (Rate: RM{pricingPerMinute.toFixed(2)} per minute)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Predefined Amounts with Larger Minute Display */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {predefinedAmounts.map((amount) => {
              const minutes = (amount / pricingPerMinute).toFixed(0);
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
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button
              onClick={handleTopup}
              disabled={processing || !topupAmount}
              size="lg"
              className="w-full bg-gradient-to-r from-primary to-primary-dark hover:from-primary-dark hover:to-primary transition-all duration-300 shadow-lg hover:shadow-xl"
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
          </motion.div>

          <p className="text-xs text-center text-muted-foreground">
            Secure payment via Billplz. Supports FPX (Malaysian banks).
          </p>
        </CardContent>
        </Card>
      </motion.div>

      {/* Transaction History */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        <Card className="card-medium border-primary/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Recent Transactions</CardTitle>
                <CardDescription className="mt-1">Your latest credits transactions</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No transactions yet
              </p>
            ) : (
              <div className="space-y-6">
                {(() => {
                  // Group transactions by month
                  const groupedByMonth: { [key: string]: Transaction[] } = {};

                  transactions.forEach((transaction) => {
                    const date = parseISO(transaction.created_at);
                    const monthKey = format(date, 'MMMM yyyy');

                    if (!groupedByMonth[monthKey]) {
                      groupedByMonth[monthKey] = [];
                    }
                    groupedByMonth[monthKey].push(transaction);
                  });

                  return Object.entries(groupedByMonth).map(([month, monthTransactions]) => (
                    <div key={month} className="space-y-3">
                      {/* Month Header */}
                      <div className="flex items-center gap-2 pb-2 border-b">
                        <h3 className="text-sm font-semibold text-primary">{month}</h3>
                        <Badge variant="secondary" className="text-xs">
                          {monthTransactions.length} transactions
                        </Badge>
                      </div>

                      {/* Transactions for this month */}
                      {monthTransactions.map((transaction, index) => {
                        const isCredit = transaction.transaction_type === 'topup' || transaction.transaction_type === 'bonus';
                        const isPending = transaction.transaction_type === 'pending';
                        const isFailed = transaction.transaction_type === 'failed';

                        const Icon = isCredit ? ArrowUp : (isPending ? Clock : (isFailed ? FileText : ArrowDown));
                        const iconColor = isCredit ? 'text-success' : (isPending ? 'text-yellow-600' : (isFailed ? 'text-destructive' : 'text-destructive'));
                        const bgColor = isCredit ? 'bg-success/10' : (isPending ? 'bg-yellow-600/10' : (isFailed ? 'bg-destructive/10' : 'bg-destructive/10'));
                        const amountColor = isCredit ? 'text-success' : (isPending ? 'text-yellow-600' : (isFailed ? 'text-muted-foreground' : 'text-destructive'));
                        const amountPrefix = isCredit ? '+' : (isPending || isFailed ? '' : '-');

                        return (
                          <motion.div
                            key={transaction.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3, delay: index * 0.02 }}
                            className="group"
                          >
                            <div className="flex items-center justify-between p-4 border border-primary/10 rounded-lg hover:bg-muted/50 hover:border-primary/30 transition-smooth card-soft">
                              <div className="flex items-center gap-3 flex-1">
                                <div className={`p-2 rounded-full ${bgColor} ${iconColor} transition-smooth group-hover:scale-110`}>
                                  <Icon className="h-4 w-4" />
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm font-medium group-hover:text-primary transition-smooth">{transaction.description}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {format(parseISO(transaction.created_at), 'MMM dd, yyyy HH:mm')}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right flex items-center gap-3">
                                <div>
                                  <p className={`text-sm font-bold ${amountColor}`}>
                                    {amountPrefix}RM{Math.abs(transaction.amount).toFixed(2)}
                                  </p>
                                  {transaction.source === 'transaction' && transaction.balance_after > 0 && (
                                    <p className="text-xs text-muted-foreground">
                                      Balance: RM{transaction.balance_after.toFixed(2)}
                                    </p>
                                  )}
                                  {transaction.status && (
                                    <Badge
                                      variant={transaction.status === 'paid' ? 'default' : transaction.status === 'pending' ? 'secondary' : 'destructive'}
                                      className="text-xs mt-1"
                                    >
                                      {transaction.status}
                                    </Badge>
                                  )}
                                </div>
                                {/* View Invoice Button for paid payments */}
                                {transaction.source === 'payment' && transaction.status === 'paid' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => window.open(`/invoices?payment_id=${transaction.id}`, '_blank')}
                                    className="h-8 w-8 p-0"
                                  >
                                    <FileText className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  ));
                })()}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
