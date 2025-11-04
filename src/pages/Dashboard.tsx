import { useCustomAuth } from '@/contexts/CustomAuthContext';
import { useDynamicPricing } from '@/hooks/useDynamicPricing';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Users,
  Clock,
  PhoneCall,
  Calendar,
  Target,
  Wallet
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { motion } from 'framer-motion';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Animation variants for elegant motion
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

const cardHoverVariants = {
  rest: { scale: 1, y: 0 },
  hover: {
    scale: 1.02,
    y: -4,
    transition: {
      duration: 0.3,
      ease: [0.4, 0, 0.2, 1],
    },
  },
};

export default function Dashboard() {
  const { user } = useCustomAuth();
  const { pricingPerMinute } = useDynamicPricing();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);

  // Initialize filters with today as default
  const today = new Date().toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);

  // Check for payment success parameter
  useEffect(() => {
    if (searchParams.get('payment') === 'success') {
      setShowPaymentSuccess(true);
      navigate('/dashboard', { replace: true });
    }
  }, [searchParams, navigate]);

  // Fetch user balance data (trial + pro minutes)
  const { data: userData, isLoading: userLoading } = useQuery({
    queryKey: ['user-balance', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('users')
        .select('account_type, trial_minutes_total, trial_minutes_used, credits_balance, total_minutes_used')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch campaigns (filtered by date)
  const { data: campaignsData, isLoading: campaignsLoading } = useQuery({
    queryKey: ['dashboard-campaigns', user?.id, dateFrom, dateTo],
    queryFn: async () => {
      if (!user) return [];
      let query = supabase.from('campaigns').select('*').eq('user_id', user.id);
      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        query = query.gte('created_at', fromDate.toISOString());
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        query = query.lte('created_at', toDate.toISOString());
      }
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch call logs (filtered by date)
  const { data: callLogsData, isLoading: callLogsLoading } = useQuery({
    queryKey: ['dashboard-call-logs', user?.id, dateFrom, dateTo],
    queryFn: async () => {
      if (!user) return [];
      let query = supabase.from('call_logs').select('*').eq('user_id', user.id);
      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        query = query.gte('created_at', fromDate.toISOString());
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        query = query.lte('created_at', toDate.toISOString());
      }
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch contacts (not date-filtered)
  const { data: contactsData, isLoading: contactsLoading } = useQuery({
    queryKey: ['dashboard-contacts', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from('contacts').select('*').eq('user_id', user.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Calculate statistics
  const accountType = userData?.account_type || 'trial';
  const trialTotal = userData?.trial_minutes_total || 10.0;
  const trialUsed = userData?.trial_minutes_used || 0;
  const trialRemaining = Math.max(0, trialTotal - trialUsed);
  const creditsBalance = userData?.credits_balance || 0;
  const balanceMinutes = creditsBalance / pricingPerMinute;
  const totalMinutesUsed = userData?.total_minutes_used || 0;
  const proMinutesUsed = Math.max(0, totalMinutesUsed - trialUsed);
  const remainingMinutes = accountType === 'trial' ? trialRemaining : balanceMinutes;

  // Call statistics (filtered by date)
  const totalCalls = callLogsData?.length || 0;
  const answeredCalls = callLogsData?.filter(log => log.status === 'answered').length || 0;
  const unansweredCalls = callLogsData?.filter(log => log.status === 'no_answered').length || 0;
  const voicemailCalls = callLogsData?.filter(log => log.status === 'voicemail').length || 0;
  const failedCalls = callLogsData?.filter(log => log.status === 'failed').length || 0;

  // Calculate percentages
  const answeredPercent = totalCalls > 0 ? (answeredCalls / totalCalls * 100).toFixed(1) : '0.0';
  const unansweredPercent = totalCalls > 0 ? (unansweredCalls / totalCalls * 100).toFixed(1) : '0.0';
  const voicemailPercent = totalCalls > 0 ? (voicemailCalls / totalCalls * 100).toFixed(1) : '0.0';
  const failedPercent = totalCalls > 0 ? (failedCalls / totalCalls * 100).toFixed(1) : '0.0';

  // Calculate cumulative totals by call index for comparison
  const sortedCalls = [...(callLogsData || [])].sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const cumulativeData = sortedCalls.map((_, index) => {
    const callsUpToNow = sortedCalls.slice(0, index + 1);
    return {
      index: index + 1,
      total: index + 1,
      answered: callsUpToNow.filter(log => log.status === 'answered').length,
      unanswered: callsUpToNow.filter(log => log.status === 'no_answered').length,
      failed: callsUpToNow.filter(log => log.status === 'failed').length,
      voicemail: callsUpToNow.filter(log => log.status === 'voicemail').length,
    };
  });

  // Chart.js Multi-Axis configuration comparing cumulative totals
  const lineChartData = {
    labels: cumulativeData.map(d => `Call ${d.index}`),
    datasets: [
      {
        label: 'Total Calls',
        data: cumulativeData.map(d => d.total),
        borderColor: 'rgb(99, 102, 241)', // Primary purple-blue
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        borderWidth: 3,
        tension: 0.4, // Smooth curve
        fill: false,
        pointRadius: 2,
        pointHoverRadius: 5,
        yAxisID: 'y',
      },
      {
        label: 'Answered Calls',
        data: cumulativeData.map(d => d.answered),
        borderColor: 'rgb(34, 197, 94)', // Success green
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        borderWidth: 2,
        tension: 0.4,
        fill: false,
        pointRadius: 2,
        pointHoverRadius: 5,
        yAxisID: 'y',
      },
      {
        label: 'Unanswered Calls',
        data: cumulativeData.map(d => d.unanswered),
        borderColor: 'rgb(249, 115, 22)', // Orange
        backgroundColor: 'rgba(249, 115, 22, 0.1)',
        borderWidth: 2,
        tension: 0.4,
        fill: false,
        pointRadius: 2,
        pointHoverRadius: 5,
        yAxisID: 'y',
      },
      {
        label: 'Failed Calls',
        data: cumulativeData.map(d => d.failed),
        borderColor: 'rgb(239, 68, 68)', // Red
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderWidth: 2,
        tension: 0.4,
        fill: false,
        pointRadius: 2,
        pointHoverRadius: 5,
        yAxisID: 'y',
      },
      {
        label: 'Voicemail Calls',
        data: cumulativeData.map(d => d.voicemail),
        borderColor: 'rgb(168, 85, 247)', // Purple
        backgroundColor: 'rgba(168, 85, 247, 0.1)',
        borderWidth: 2,
        tension: 0.4,
        fill: false,
        pointRadius: 2,
        pointHoverRadius: 5,
        yAxisID: 'y',
      },
    ],
  };

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 15,
          font: {
            size: 12,
          },
        },
      },
      title: {
        display: true,
        text: 'Cumulative Call Comparison',
        font: {
          size: 16,
          weight: 'bold' as const,
        },
        color: 'rgb(99, 102, 241)',
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: {
          size: 14,
          weight: 'bold' as const,
        },
        bodyFont: {
          size: 13,
        },
        bodySpacing: 6,
        usePointStyle: true,
      },
    },
    scales: {
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        beginAtZero: true,
        title: {
          display: true,
          text: 'Number of Calls',
          font: {
            size: 12,
            weight: 'bold' as const,
          },
          color: 'rgb(99, 102, 241)',
        },
        ticks: {
          stepSize: 1,
          font: {
            size: 11,
          },
        },
        grid: {
          color: 'rgba(99, 102, 241, 0.1)',
        },
      },
      x: {
        title: {
          display: true,
          text: 'Call Sequence',
          font: {
            size: 12,
            weight: 'bold' as const,
          },
          color: 'rgb(99, 102, 241)',
        },
        grid: {
          display: false,
        },
        ticks: {
          font: {
            size: 10,
          },
          maxTicksLimit: 20,
          callback: function(_value: any, index: number) {
            // Show every 5th label or first/last
            if (index === 0 || index === cumulativeData.length - 1 || (index + 1) % 5 === 0) {
              return `#${index + 1}`;
            }
            return '';
          },
        },
      },
    },
  };

  // Stage Analytics
  const stageStats = new Map<string, number>();
  const answeredCallLogs = callLogsData?.filter(log => log.status === 'answered') || [];
  answeredCallLogs.forEach(log => {
    const stage = log.stage_reached || 'Unknown';
    stageStats.set(stage, (stageStats.get(stage) || 0) + 1);
  });

  const totalAnsweredCallsCount = answeredCallLogs.length;
  const stageData = Array.from(stageStats.entries()).map(([stage, count]) => ({
    stage,
    count,
    percent: totalAnsweredCallsCount > 0 ? ((count / totalAnsweredCallsCount) * 100).toFixed(1) : '0.0'
  })).sort((a, b) => b.count - a.count);

  const isLoading = userLoading || campaignsLoading || callLogsLoading || contactsLoading;

  return (
    <>
      {/* Payment Success Modal */}
      <Dialog open={showPaymentSuccess} onOpenChange={setShowPaymentSuccess}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-500" />
            </div>
            <DialogTitle className="text-2xl">Payment Successful!</DialogTitle>
            <DialogDescription className="text-base">
              Thank you for subscribing to Pro. Your account has been activated.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => setShowPaymentSuccess(false)} className="w-full mt-4">
            Get Started
          </Button>
        </DialogContent>
      </Dialog>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header with gradient background */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          className="mb-8 p-8 rounded-2xl gradient-card card-soft"
        >
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary via-primary-light to-primary-dark bg-clip-text text-transparent mb-3">
            Welcome back, {user?.username}!
          </h1>
          <p className="text-muted-foreground text-lg">
            Here's an overview of your voice AI campaigns and performance.
          </p>
        </motion.div>

        {/* Date Filter */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="mb-6 card-soft transition-smooth hover:shadow-medium border-primary/20">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <CardTitle>Date Filters</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dateFrom" className="text-sm font-medium">From Date</Label>
                  <Input
                    id="dateFrom"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="mt-1.5 transition-smooth focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <Label htmlFor="dateTo" className="text-sm font-medium">To Date</Label>
                  <Input
                    id="dateTo"
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="mt-1.5 transition-smooth focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* First Row: Overview Cards */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6"
        >
          {/* Total Campaigns */}
          <motion.div variants={itemVariants}>
            <motion.div
              whileHover={{ scale: 1.02, y: -4 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="card-soft border-primary/20 transition-smooth hover:border-primary/40">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Target className="h-4 w-4 text-primary" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-primary">{campaignsData?.length || 0}</div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>

          {/* Total Contacts */}
          <motion.div variants={itemVariants}>
            <motion.div
              whileHover={{ scale: 1.02, y: -4 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="card-soft border-primary/20 transition-smooth hover:border-primary/40">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-primary">{contactsData?.length || 0}</div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>

          {/* Total Minutes Used - Pro focus */}
          <motion.div variants={itemVariants}>
            <motion.div
              whileHover={{ scale: 1.02, y: -4 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="card-soft border-primary/20 transition-smooth hover:border-primary/40">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Minutes Used</CardTitle>
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Clock className="h-4 w-4 text-primary" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-primary">
                    {proMinutesUsed.toFixed(1)} min
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Pro account usage
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>

          {/* Remaining Minutes - Pro focus */}
          <motion.div variants={itemVariants}>
            <motion.div
              whileHover={{ scale: 1.02, y: -4 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="card-soft border-success/20 transition-smooth hover:border-success/40">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Remaining Minutes</CardTitle>
                  <div className="p-2 rounded-lg bg-success/10">
                    <Wallet className="h-4 w-4 text-success" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-success">{balanceMinutes.toFixed(1)} min</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Pro account balance
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Second Row: Call Breakdown Cards */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6"
        >
          <motion.div variants={itemVariants}>
            <motion.div
              whileHover={{ scale: 1.02, y: -4 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="card-soft border-primary/20 transition-smooth hover:border-primary/40">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <PhoneCall className="h-4 w-4 text-blue-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-600">{totalCalls}</div>
                  <p className="text-xs text-muted-foreground mt-1">Filtered by date</p>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>

          <motion.div variants={itemVariants}>
            <motion.div
              whileHover={{ scale: 1.02, y: -4 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="card-soft border-success/20 transition-smooth hover:border-success/40">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Answered</CardTitle>
                  <div className="p-2 rounded-lg bg-success/10">
                    <CheckCircle className="h-4 w-4 text-success" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-success">{answeredCalls}</div>
                  <p className="text-xs text-muted-foreground mt-1">{answeredPercent}% of total</p>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>

          <motion.div variants={itemVariants}>
            <motion.div
              whileHover={{ scale: 1.02, y: -4 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="card-soft border-orange-200 transition-smooth hover:border-orange-400">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Unanswered</CardTitle>
                  <div className="p-2 rounded-lg bg-orange-500/10">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-orange-600">{unansweredCalls}</div>
                  <p className="text-xs text-muted-foreground mt-1">{unansweredPercent}% of total</p>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>

          <motion.div variants={itemVariants}>
            <motion.div
              whileHover={{ scale: 1.02, y: -4 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="card-soft border-destructive/20 transition-smooth hover:border-destructive/40">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Voicemail/Failed</CardTitle>
                  <div className="p-2 rounded-lg bg-destructive/10">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-destructive">{voicemailCalls + failedCalls}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    VM: {voicemailPercent}% | Failed: {failedPercent}%
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Call Statistics Line Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <Card className="mb-6 card-medium border-primary/20 transition-smooth hover:border-primary/30">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Call Statistics</CardTitle>
                  <CardDescription className="mt-1">
                    Cumulative call comparison by call sequence (filtered by selected dates)
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div style={{ height: '300px' }}>
                {callLogsLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">Loading chart...</p>
                  </div>
                ) : totalCalls === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">No call data available for selected dates</p>
                  </div>
                ) : (
                  <Line data={lineChartData} options={lineChartOptions} />
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Stage Analytics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <Card className="card-medium border-primary/20 transition-smooth hover:border-primary/30">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Stage Analytics</CardTitle>
                  <CardDescription className="mt-1">
                    Distribution of answered calls by conversation stage reached (filtered by selected dates)
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {callLogsLoading ? (
                <p className="text-muted-foreground">Loading stage data...</p>
              ) : stageData.length === 0 ? (
                <p className="text-muted-foreground">
                  No answered calls with stage data for selected dates
                </p>
              ) : (
                <div className="space-y-4">
                  {stageData.map(({ stage, count, percent }, index) => (
                    <motion.div
                      key={stage}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, delay: index * 0.1 }}
                      className="group"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium group-hover:text-primary transition-smooth">
                          {stage}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {count} calls ({percent}%)
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${percent}%` }}
                          transition={{ duration: 0.8, delay: index * 0.1 + 0.2, ease: "easeOut" }}
                          className="bg-gradient-to-r from-primary via-primary-light to-primary h-2.5 rounded-full"
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </>
  );
}