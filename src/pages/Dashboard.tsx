import { useCustomAuth } from '@/contexts/CustomAuthContext';
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

export default function Dashboard() {
  const { user } = useCustomAuth();
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
  const balanceMinutes = creditsBalance / 0.15;
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

  // Group calls by hour for line chart
  const callsByHour = Array.from({ length: 24 }, (_, i) => ({
    hour: `${i.toString().padStart(2, '0')}:00`,
    calls: 0,
    answered: 0,
    unanswered: 0
  }));

  callLogsData?.forEach(log => {
    const createdAt = new Date(log.created_at);
    const hour = createdAt.getHours();
    callsByHour[hour].calls++;
    if (log.status === 'answered') {
      callsByHour[hour].answered++;
    } else if (log.status === 'no_answered' || log.status === 'failed' || log.status === 'voicemail') {
      callsByHour[hour].unanswered++;
    }
  });

  // Chart.js configuration
  const lineChartData = {
    labels: callsByHour.map(d => d.hour),
    datasets: [
      {
        label: 'Total Calls',
        data: callsByHour.map(d => d.calls),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: true,
      },
      {
        label: 'Answered',
        data: callsByHour.map(d => d.answered),
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        tension: 0.4,
        fill: true,
      },
      {
        label: 'Not Answered',
        data: callsByHour.map(d => d.unanswered),
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        tension: 0.4,
        fill: true,
      },
    ],
  };

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' as const },
      title: { display: false },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { stepSize: 1 },
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
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
            Welcome back, {user?.username}!
          </h1>
          <p className="text-muted-foreground">
            Here's an overview of your voice AI campaigns and performance.
          </p>
        </div>

        {/* Date Filter */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              <CardTitle>Date Filters</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dateFrom">From Date</Label>
                <Input
                  id="dateFrom"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="dateTo">To Date</Label>
                <Input
                  id="dateTo"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* First Row: Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{campaignsData?.length || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{contactsData?.length || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Minutes Used</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {accountType === 'trial' ? trialUsed.toFixed(1) : proMinutesUsed.toFixed(1)} min
              </div>
              <p className="text-xs text-muted-foreground">
                {accountType === 'trial' ? 'Trial usage' : 'Pro usage'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Remaining Minutes</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{remainingMinutes.toFixed(1)} min</div>
              <p className="text-xs text-muted-foreground">
                {accountType === 'trial' ? 'Trial balance' : `RM ${creditsBalance.toFixed(2)}`}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Second Row: Call Breakdown Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
              <PhoneCall className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalCalls}</div>
              <p className="text-xs text-muted-foreground">Filtered by date</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Answered</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{answeredCalls}</div>
              <p className="text-xs text-muted-foreground">{answeredPercent}% of total</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unanswered</CardTitle>
              <AlertCircle className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{unansweredCalls}</div>
              <p className="text-xs text-muted-foreground">{unansweredPercent}% of total</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Voicemail/Failed</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{voicemailCalls + failedCalls}</div>
              <p className="text-xs text-muted-foreground">
                VM: {voicemailPercent}% | Failed: {failedPercent}%
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Call Statistics Line Chart */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              <CardTitle>Call Statistics</CardTitle>
            </div>
            <CardDescription>
              Hourly call distribution (filtered by selected dates)
            </CardDescription>
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

        {/* Stage Analytics */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              <CardTitle>Stage Analytics</CardTitle>
            </div>
            <CardDescription>
              Distribution of answered calls by conversation stage reached (filtered by selected dates)
            </CardDescription>
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
                {stageData.map(({ stage, count, percent }) => (
                  <div key={stage} className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{stage}</span>
                        <span className="text-sm text-muted-foreground">
                          {count} calls ({percent}%)
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}