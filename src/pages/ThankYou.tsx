import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCustomAuth } from '@/contexts/CustomAuthContext';
import { getUserPayments, type Payment } from '@/lib/billing';

export default function ThankYou() {
  const navigate = useNavigate();
  const { user, refreshUser } = useCustomAuth();
  const [latestPayment, setLatestPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if payment was cancelled via Billplz redirect
    const urlParams = new URLSearchParams(window.location.search);
    const billplzPaid = urlParams.get('billplz[paid]');
    
    // If payment was cancelled (paid=false), redirect to dashboard
    if (billplzPaid === 'false') {
      navigate('/dashboard');
      return;
    }

    const fetchLatestPayment = async () => {
      if (!user) {
        navigate('/login');
        return;
      }

      try {
        const payments = await getUserPayments(user.id);
        // Get the most recent paid payment
        const recentPaid = payments.find(p => p.status === 'paid');
        setLatestPayment(recentPaid || null);
        
        // Refresh user to update subscription status
        if (recentPaid) {
          await refreshUser();
        }
      } catch (error) {
        console.error('Error fetching payment:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLatestPayment();
  }, [user, navigate, refreshUser]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-background to-muted/20">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-background to-muted/20">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <CardTitle className="text-2xl">Payment Successful!</CardTitle>
          <CardDescription>
            Thank you for upgrading to Pro. Your account has been activated.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {latestPayment && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Bill ID:</span>
                <span className="font-mono font-medium">{latestPayment.billplz_bill_id || '-'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount:</span>
                <span className="font-medium">
                  {latestPayment.currency} {Number(latestPayment.amount).toFixed(2)}
                </span>
              </div>
              {latestPayment.paid_at && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Paid At:</span>
                  <span className="font-medium">
                    {new Date(latestPayment.paid_at).toLocaleDateString('en-MY', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              )}
            </div>
          )}
          
          <div className="space-y-3">
            <Button 
              onClick={() => navigate('/dashboard')} 
              className="w-full"
            >
              Go to Dashboard
            </Button>
            <Button 
              onClick={() => navigate('/invoices')} 
              variant="outline"
              className="w-full"
            >
              View Invoices
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
