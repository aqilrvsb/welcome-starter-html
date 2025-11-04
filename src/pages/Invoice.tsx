import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CheckCircle2, Download, Printer, ArrowLeft, FileText } from 'lucide-react';
import { format } from 'date-fns';

interface Payment {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  status: string;
  chip_purchase_id: string;
  chip_transaction_id: string;
  paid_at: string;
  created_at: string;
  metadata: {
    type: string;
    description: string;
  };
}

interface User {
  id: string;
  username: string;
  email: string;
  full_name: string;
}

export default function Invoice() {
  const [searchParams] = useSearchParams();
  const paymentId = searchParams.get('payment_id');
  const [payment, setPayment] = useState<Payment | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadInvoiceData();
  }, [paymentId]);

  const loadInvoiceData = async () => {
    if (!paymentId) {
      setError('No payment ID provided');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Get payment data
      const { data: paymentData, error: paymentError } = await supabase
        .from('payments')
        .select('*')
        .eq('id', paymentId)
        .single();

      if (paymentError) throw paymentError;

      setPayment(paymentData);

      // Get user data
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, username, email, full_name')
        .eq('id', paymentData.user_id)
        .single();

      if (userError) throw userError;

      setUser(userData);
    } catch (err: any) {
      console.error('Error loading invoice:', err);
      setError(err.message || 'Failed to load invoice');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    // In a real app, you'd generate a PDF here
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (error || !payment || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Invoice Not Found</h2>
              <p className="text-muted-foreground mb-4">
                {error || 'The invoice you are looking for does not exist.'}
              </p>
              <Link to="/credits-topup">
                <Button>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Credits
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const invoiceNumber = `INV-${payment.id.substring(0, 8).toUpperCase()}`;
  const invoiceDate = format(new Date(payment.paid_at || payment.created_at), 'dd MMM yyyy');
  const pricingPerMinute = 0.15; // Default rate
  const minutes = (payment.amount / pricingPerMinute).toFixed(0);

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .invoice-container { max-width: 100%; margin: 0; padding: 20px; }
        }
      `}</style>

      <div className="max-w-4xl mx-auto invoice-container">
        {/* Header Actions */}
        <div className="flex justify-between items-center mb-6 no-print">
          <Link to="/credits-topup">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
          </div>
        </div>

        {/* Invoice Card */}
        <Card className="shadow-lg">
          <CardContent className="p-8 md:p-12">
            {/* Company Header */}
            <div className="flex justify-between items-start mb-8">
              <div>
                <h1 className="text-3xl font-bold mb-2">AI Call Pro</h1>
                <p className="text-sm text-muted-foreground">AI-Powered Call Center Platform</p>
                <p className="text-sm text-muted-foreground">www.aicallpro.com</p>
              </div>
              <div className="text-right">
                <h2 className="text-2xl font-bold mb-2">INVOICE</h2>
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold">Invoice #:</span> {invoiceNumber}
                </p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold">Date:</span> {invoiceDate}
                </p>
              </div>
            </div>

            <Separator className="my-6" />

            {/* Bill To */}
            <div className="mb-8">
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">BILL TO:</h3>
              <div className="text-base">
                <p className="font-semibold">{user.full_name || user.username}</p>
                <p className="text-muted-foreground">{user.email}</p>
                <p className="text-sm text-muted-foreground mt-1">Customer ID: {user.id.substring(0, 8).toUpperCase()}</p>
              </div>
            </div>

            {/* Payment Status Banner */}
            {payment.status === 'paid' && (
              <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6 flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                <div>
                  <p className="font-semibold text-green-900 dark:text-green-100">Payment Successful</p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Paid on {format(new Date(payment.paid_at), 'dd MMM yyyy, hh:mm a')}
                  </p>
                </div>
              </div>
            )}

            {/* Invoice Items Table */}
            <div className="mb-8">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 font-semibold">Description</th>
                    <th className="text-right py-3 font-semibold">Qty</th>
                    <th className="text-right py-3 font-semibold">Rate</th>
                    <th className="text-right py-3 font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-4">
                      <p className="font-medium">{payment.metadata?.description || 'Credits Top-up'}</p>
                      <p className="text-sm text-muted-foreground">
                        AI Call Minutes (~{minutes} minutes at RM{pricingPerMinute.toFixed(2)}/min)
                      </p>
                    </td>
                    <td className="text-right py-4">1</td>
                    <td className="text-right py-4">RM {payment.amount.toFixed(2)}</td>
                    <td className="text-right py-4 font-semibold">RM {payment.amount.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end mb-8">
              <div className="w-64">
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span>RM {payment.amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">Tax:</span>
                  <span>RM 0.00</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between py-2">
                  <span className="text-lg font-bold">Total:</span>
                  <span className="text-lg font-bold">RM {payment.amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2 bg-green-50 dark:bg-green-950 rounded px-3 mt-2">
                  <span className="font-semibold text-green-900 dark:text-green-100">Amount Paid:</span>
                  <span className="font-semibold text-green-900 dark:text-green-100">RM {payment.amount.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <Separator className="my-6" />

            {/* Payment Details */}
            <div className="bg-muted/50 rounded-lg p-4 mb-6">
              <h3 className="text-sm font-semibold mb-3">PAYMENT DETAILS</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Payment Method:</span>
                  <span className="ml-2 font-medium">CHIP Payment Gateway</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Currency:</span>
                  <span className="ml-2 font-medium">{payment.currency || 'MYR'}</span>
                </div>
                {payment.chip_transaction_id && (
                  <div className="md:col-span-2">
                    <span className="text-muted-foreground">Transaction ID:</span>
                    <span className="ml-2 font-mono text-xs bg-background px-2 py-1 rounded">
                      {payment.chip_transaction_id}
                    </span>
                  </div>
                )}
                {payment.chip_purchase_id && (
                  <div className="md:col-span-2">
                    <span className="text-muted-foreground">Purchase ID:</span>
                    <span className="ml-2 font-mono text-xs bg-background px-2 py-1 rounded">
                      {payment.chip_purchase_id}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Notes */}
            <div className="text-sm text-muted-foreground">
              <p className="mb-2">
                <strong>Note:</strong> This is a computer-generated invoice and does not require a signature.
              </p>
              <p>
                For any questions regarding this invoice, please contact support at support@aicallpro.com
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-6 text-sm text-muted-foreground no-print">
          <p>Thank you for your business!</p>
          <p className="mt-1">AI Call Pro - Powered by Advanced AI Technology</p>
        </div>
      </div>
    </div>
  );
}
