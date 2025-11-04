import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, DollarSign, TrendingUp, XCircle, CheckCircle2, FileText, Search, Calendar, Check, X, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';

interface Payment {
  id: string;
  user_id: string;
  amount: number;
  status: string;
  payment_method: string | null;
  chip_purchase_id: string | null;
  chip_transaction_id: string | null;
  created_at: string;
  paid_at: string | null;
  users: {
    username: string;
    email: string;
  };
}

interface Transaction {
  id: string;
  user_id: string;
  transaction_type: string;
  amount: number;
  description: string;
  created_at: string;
  users: {
    username: string;
    email: string;
  };
}

export default function AdminTransactions() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<string>('all');

  // Summary stats
  const [totalPaid, setTotalPaid] = useState(0);
  const [totalFailed, setTotalFailed] = useState(0);
  const [amountPaid, setAmountPaid] = useState(0);
  const [totalTransactions, setTotalTransactions] = useState(0);

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    calculateSummary();
  }, [payments, statusFilter, dateFilter]);

  const loadAllData = async () => {
    try {
      setLoading(true);

      // Load payments
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select(`
          *,
          users!payments_user_id_fkey (
            username,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (paymentsError) throw paymentsError;

      // Load credits transactions
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('credits_transactions')
        .select(`
          *,
          users!credits_transactions_user_id_fkey (
            username,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (transactionsError) throw transactionsError;

      setPayments(paymentsData as any);
      setTransactions(transactionsData as any);
    } catch (error: any) {
      console.error('Error loading transactions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load transaction data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsPaid = async (paymentId: string) => {
    try {
      const { error } = await supabase
        .from('payments')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', paymentId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Payment marked as paid successfully',
      });

      // Reload data
      loadAllData();
    } catch (error: any) {
      console.error('Error marking payment as paid:', error);
      toast({
        title: 'Error',
        description: 'Failed to update payment status',
        variant: 'destructive',
      });
    }
  };

  const handleMarkAsFailed = async (paymentId: string) => {
    try {
      const { error } = await supabase
        .from('payments')
        .update({
          status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', paymentId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Payment marked as failed successfully',
      });

      // Reload data
      loadAllData();
    } catch (error: any) {
      console.error('Error marking payment as failed:', error);
      toast({
        title: 'Error',
        description: 'Failed to update payment status',
        variant: 'destructive',
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: 'Transaction ID copied to clipboard',
      duration: 2000,
    });
  };

  const calculateSummary = () => {
    let filteredPayments = payments;

    // Apply date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const startDate = dateFilter === 'month'
        ? startOfMonth(now)
        : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);

      filteredPayments = filteredPayments.filter(p =>
        new Date(p.created_at) >= startDate
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filteredPayments = filteredPayments.filter(p => p.status === statusFilter);
    }

    const paidPayments = filteredPayments.filter(p => p.status === 'paid');
    const failedPayments = filteredPayments.filter(p => p.status === 'failed' || p.status === 'cancelled');
    const totalAmount = paidPayments.reduce((sum, p) => sum + Number(p.amount), 0);

    setTotalPaid(paidPayments.length);
    setTotalFailed(failedPayments.length);
    setAmountPaid(totalAmount);
    setTotalTransactions(filteredPayments.length);
  };

  const getFilteredPayments = () => {
    let filtered = [...payments];

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => p.status === statusFilter);
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const startDate = dateFilter === 'month'
        ? startOfMonth(now)
        : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);

      filtered = filtered.filter(p => new Date(p.created_at) >= startDate);
    }

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(p =>
        p.users.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.users.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.id.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered;
  };

  const statusColors: Record<string, string> = {
    paid: 'bg-green-100 text-green-800 border-green-300',
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    failed: 'bg-red-100 text-red-800 border-red-300',
    cancelled: 'bg-gray-100 text-gray-800 border-gray-300',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const filteredPayments = getFilteredPayments();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Transactions</h1>
        <p className="text-muted-foreground mt-2">
          View and manage all payment transactions
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{totalPaid}</div>
            <p className="text-xs text-muted-foreground">Successful transactions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Failed</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{totalFailed}</div>
            <p className="text-xs text-muted-foreground">Failed/Cancelled</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Amount Paid</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">RM {amountPaid.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Total revenue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{totalTransactions}</div>
            <p className="text-xs text-muted-foreground">All records</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter transactions by status, date, or search</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Status Filter */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Filter */}
            <div className="space-y-2">
              <Label>Date Range</Label>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            <div className="space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by user, email, or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStatusFilter('all');
                setDateFilter('all');
                setSearchQuery('');
              }}
            >
              Clear Filters
            </Button>
            <div className="text-sm text-muted-foreground flex items-center ml-auto">
              Showing {filteredPayments.length} of {payments.length} transactions
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Transactions</CardTitle>
          <CardDescription>Complete list of payment transactions</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredPayments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No transactions found
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment Method</TableHead>
                  <TableHead>Transaction ID</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Paid At</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-mono text-xs">
                      {payment.id.substring(0, 8)}...
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{payment.users.username}</div>
                        <div className="text-xs text-muted-foreground">{payment.users.email}</div>
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold">
                      RM {Number(payment.amount).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColors[payment.status] || ''}>
                        {payment.status.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {payment.chip_purchase_id ? (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                          CHIP
                        </Badge>
                      ) : payment.payment_method ? (
                        payment.payment_method
                      ) : (
                        'N/A'
                      )}
                    </TableCell>
                    <TableCell>
                      {payment.chip_transaction_id ? (
                        <div className="flex items-center gap-1">
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {payment.chip_transaction_id.substring(0, 12)}...
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => copyToClipboard(payment.chip_transaction_id!)}
                            title="Copy Transaction ID"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {format(parseISO(payment.created_at), 'MMM dd, yyyy HH:mm')}
                    </TableCell>
                    <TableCell>
                      {payment.paid_at
                        ? format(parseISO(payment.paid_at), 'MMM dd, yyyy HH:mm')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {/* Invoice Button for paid payments */}
                        {payment.status === 'paid' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => window.open(`/invoice?payment_id=${payment.id}`, '_blank')}
                            title="View Invoice"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                        )}

                        {/* Manual Action Buttons for pending payments */}
                        {payment.status === 'pending' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => handleMarkAsPaid(payment.id)}
                              title="Mark as Paid"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleMarkAsFailed(payment.id)}
                              title="Mark as Failed"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
