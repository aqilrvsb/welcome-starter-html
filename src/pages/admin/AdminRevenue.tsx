import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingUp, Users, CreditCard, Wallet, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function AdminRevenue() {
  // Fetch all users for revenue calculations
  const { data: allUsers } = useQuery({
    queryKey: ['admin-revenue-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch payment transactions (assuming you have a payments table)
  const { data: allPayments } = useQuery({
    queryKey: ['admin-all-payments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_transactions')
        .select('*, users(username, email)')
        .order('created_at', { ascending: false });
      if (error) {
        console.log('No payment transactions table yet');
        return [];
      }
      return data || [];
    },
  });

  // Calculate revenue metrics
  const totalRevenue = allPayments?.reduce((sum, payment) => {
    return sum + (payment.amount || 0);
  }, 0) || 0;

  const thisMonthRevenue = allPayments?.filter(payment => {
    const paymentDate = new Date(payment.created_at);
    const now = new Date();
    return paymentDate.getMonth() === now.getMonth() &&
           paymentDate.getFullYear() === now.getFullYear();
  }).reduce((sum, payment) => sum + (payment.amount || 0), 0) || 0;

  const lastMonthRevenue = allPayments?.filter(payment => {
    const paymentDate = new Date(payment.created_at);
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1);
    return paymentDate.getMonth() === lastMonth.getMonth() &&
           paymentDate.getFullYear() === lastMonth.getFullYear();
  }).reduce((sum, payment) => sum + (payment.amount || 0), 0) || 0;

  const revenueGrowth = lastMonthRevenue > 0
    ? (((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100).toFixed(1)
    : '0';

  // Calculate ARPU (Average Revenue Per User)
  const paidUsers = allUsers?.filter(user => (user.pro_balance_minutes || 0) > 0) || [];
  const arpu = paidUsers.length > 0 ? (totalRevenue / paidUsers.length).toFixed(2) : '0.00';

  // Calculate conversion rate
  const totalUsers = allUsers?.length || 0;
  const conversionRate = totalUsers > 0
    ? ((paidUsers.length / totalUsers) * 100).toFixed(1)
    : '0';

  // Top paying users
  const topPayingUsers = allUsers
    ?.map(user => ({
      ...user,
      totalSpent: allPayments?.filter(p => p.user_id === user.id)
        .reduce((sum, p) => sum + (p.amount || 0), 0) || 0
    }))
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 5) || [];

  // Revenue trend data (last 30 days)
  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - i));
    return date;
  });

  const revenueByDay = last30Days.map(date => {
    const dayRevenue = allPayments?.filter(payment => {
      const paymentDate = new Date(payment.created_at);
      return paymentDate.toDateString() === date.toDateString();
    }).reduce((sum, payment) => sum + (payment.amount || 0), 0) || 0;
    return dayRevenue;
  });

  const revenueChartData = {
    labels: last30Days.map(date => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
    datasets: [
      {
        label: 'Revenue ($)',
        data: revenueByDay,
        fill: true,
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        tension: 0.4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value: any) {
            return '$' + value;
          }
        }
      }
    }
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 max-w-7xl">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="p-8 rounded-2xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 card-soft mb-8"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="p-3 rounded-lg bg-green-500/10">
            <DollarSign className="h-6 w-6 text-green-600" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
            Revenue Analytics
          </h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Financial performance and revenue insights
        </p>
      </motion.div>

      {/* Key Metrics */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
      >
        {/* Total Revenue */}
        <Card className="card-soft border-green-200 hover:border-green-400 transition-smooth">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">${totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">All time earnings</p>
          </CardContent>
        </Card>

        {/* This Month Revenue */}
        <Card className="card-soft border-blue-200 hover:border-blue-400 transition-smooth">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">${thisMonthRevenue.toFixed(2)}</div>
            <div className="flex items-center gap-1 mt-1">
              {parseFloat(revenueGrowth) >= 0 ? (
                <ArrowUpRight className="h-3 w-3 text-green-600" />
              ) : (
                <ArrowDownRight className="h-3 w-3 text-red-600" />
              )}
              <span className={`text-xs ${parseFloat(revenueGrowth) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {revenueGrowth}% vs last month
              </span>
            </div>
          </CardContent>
        </Card>

        {/* ARPU */}
        <Card className="card-soft border-purple-200 hover:border-purple-400 transition-smooth">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ARPU</CardTitle>
            <Wallet className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">${arpu}</div>
            <p className="text-xs text-muted-foreground mt-1">Average revenue per user</p>
          </CardContent>
        </Card>

        {/* Conversion Rate */}
        <Card className="card-soft border-orange-200 hover:border-orange-400 transition-smooth">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <CreditCard className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{conversionRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">{paidUsers.length} / {totalUsers} users paid</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Revenue Trend Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="mb-8"
      >
        <Card className="card-soft">
          <CardHeader>
            <CardTitle>Revenue Trend (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <Line data={revenueChartData} options={chartOptions} />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Top Paying Users */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        <Card className="card-soft">
          <CardHeader>
            <CardTitle>Top 5 Paying Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topPayingUsers.map((user, index) => (
                <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-smooth">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium">{user.username}</div>
                      <div className="text-sm text-muted-foreground">{user.email}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-green-600">${user.totalSpent.toFixed(2)}</div>
                    <div className="text-xs text-muted-foreground">Total spent</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
