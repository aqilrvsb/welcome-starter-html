import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, CheckCircle, XCircle, PhoneCall, AlertCircle, Target, Users, Clock, Wallet, Calendar, TrendingUp } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { isCallSuccessful, isCallFailed } from "@/lib/statusUtils";
import { useMemo, useState } from "react";
import { CallLogsTable } from "@/components/call-logs/CallLogsTable";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useCustomAuth } from '@/contexts/CustomAuthContext';
import { useDynamicPricing } from '@/hooks/useDynamicPricing';

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

interface CampaignDetailsProps {
  campaignId: string;
  onBack: () => void;
}

export function CampaignDetails({ campaignId, onBack }: CampaignDetailsProps) {
  const { user } = useCustomAuth();
  const { pricingPerMinute } = useDynamicPricing();

  // Date filters - default to campaign creation date
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data: campaign, isLoading: campaignLoading } = useQuery({
    queryKey: ["campaign", campaignId],
    queryFn: async () => {
      // First get campaign
      const { data: campaignData, error: campaignError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();

      if (campaignError) throw campaignError;

      // Then get the prompt if it exists
      let promptData = null;
      if (campaignData.prompt_id) {
        const { data: prompt } = await supabase
          .from('prompts')
          .select('prompt_name, first_message, system_prompt')
          .eq('id', campaignData.prompt_id)
          .single();
        
        promptData = prompt;
      }

      return {
        ...campaignData,
        prompts: promptData
      };
    },
  });

  const { data: callLogs, isLoading: callLogsLoading } = useQuery({
    queryKey: ["call-logs", campaignId, dateFrom, dateTo],
    queryFn: async () => {
      let query = supabase
        .from('call_logs')
        .select(`
          *,
          contacts(name)
        `)
        .eq('campaign_id', campaignId);

      // Apply date filters if provided
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

      query = query.order('start_time', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch user balance data
  const { data: userData } = useQuery({
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

  // Calculate minutes used from call logs
  const totalMinutesUsed = useMemo(() => {
    if (!callLogs) return 0;
    return callLogs.reduce((acc, log) => acc + (log.duration || 0), 0) / 60; // Convert seconds to minutes
  }, [callLogs]);

  // User balance calculations
  const accountType = userData?.account_type || 'trial';
  const trialTotal = userData?.trial_minutes_total || 10.0;
  const trialUsed = userData?.trial_minutes_used || 0;
  const creditsBalance = userData?.credits_balance || 0;
  const balanceMinutes = creditsBalance / pricingPerMinute;
  const remainingMinutes = accountType === 'trial' ? Math.max(0, trialTotal - trialUsed) : balanceMinutes;

  // Calculate accurate statistics from call logs
  const stats = useMemo(() => {
    if (!callLogs || callLogs.length === 0) {
      return {
        totalCalls: 0,
        answeredCalls: 0,
        unansweredCalls: 0,
        voicemailFailedCalls: 0,
        answeredPercent: '0.0',
        unansweredPercent: '0.0',
        voicemailFailedPercent: '0.0'
      };
    }

    const totalCalls = callLogs.length;
    const answeredCalls = callLogs.filter(log => log.status === 'answered').length;
    const unansweredCalls = callLogs.filter(log => log.status === 'no_answered').length;
    const voicemailCalls = callLogs.filter(log => log.status === 'voicemail').length;
    const failedCalls = callLogs.filter(log => log.status === 'failed').length;
    const voicemailFailedCalls = voicemailCalls + failedCalls;

    const answeredPercent = totalCalls > 0 ? ((answeredCalls / totalCalls) * 100).toFixed(1) : '0.0';
    const unansweredPercent = totalCalls > 0 ? ((unansweredCalls / totalCalls) * 100).toFixed(1) : '0.0';
    const voicemailFailedPercent = totalCalls > 0 ? ((voicemailFailedCalls / totalCalls) * 100).toFixed(1) : '0.0';

    return {
      totalCalls,
      answeredCalls,
      unansweredCalls,
      voicemailFailedCalls,
      answeredPercent,
      unansweredPercent,
      voicemailFailedPercent
    };
  }, [callLogs]);

  // Chart data
  const sortedCalls = useMemo(() => {
    return [...(callLogs || [])].sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [callLogs]);

  const cumulativeData = useMemo(() => {
    return sortedCalls.map((_, index) => {
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
  }, [sortedCalls]);

  const lineChartData = {
    labels: cumulativeData.map(d => `Call ${d.index}`),
    datasets: [
      {
        label: 'Total Calls',
        data: cumulativeData.map(d => d.total),
        borderColor: 'rgb(99, 102, 241)',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        borderWidth: 3,
        tension: 0.4,
        fill: false,
        pointRadius: 2,
        pointHoverRadius: 5,
        yAxisID: 'y',
      },
      {
        label: 'Answered Calls',
        data: cumulativeData.map(d => d.answered),
        borderColor: 'rgb(34, 197, 94)',
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
        borderColor: 'rgb(249, 115, 22)',
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
        borderColor: 'rgb(239, 68, 68)',
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
        borderColor: 'rgb(168, 85, 247)',
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
          font: { size: 12 },
        },
      },
      title: {
        display: true,
        text: 'Cumulative Call Comparison (filtered by selected dates)',
        font: { size: 16, weight: 'bold' as const },
        color: 'rgb(99, 102, 241)',
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: { size: 14, weight: 'bold' as const },
        bodyFont: { size: 13 },
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
          font: { size: 12, weight: 'bold' as const },
          color: 'rgb(99, 102, 241)',
        },
        ticks: { stepSize: 1, font: { size: 11 } },
        grid: { color: 'rgba(99, 102, 241, 0.1)' },
      },
      x: {
        title: {
          display: true,
          text: 'Call Sequence',
          font: { size: 12, weight: 'bold' as const },
          color: 'rgb(99, 102, 241)',
        },
        grid: { display: false },
        ticks: {
          font: { size: 10 },
          maxTicksLimit: 20,
          callback: function(_value: any, index: number) {
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
  const stageStats = useMemo(() => {
    const stageMap = new Map<string, number>();
    const answeredCallLogs = callLogs?.filter(log => log.status === 'answered') || [];
    answeredCallLogs.forEach(log => {
      const stage = log.stage_reached || 'Unknown';
      stageMap.set(stage, (stageMap.get(stage) || 0) + 1);
    });

    const totalAnsweredCallsCount = answeredCallLogs.length;
    return Array.from(stageMap.entries()).map(([stage, count]) => ({
      stage,
      count,
      percent: totalAnsweredCallsCount > 0 ? ((count / totalAnsweredCallsCount) * 100).toFixed(1) : '0.0'
    })).sort((a, b) => b.count - a.count);
  }, [callLogs]);


  if (campaignLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p>Memuat detail kempen...</p>
        </CardContent>
      </Card>
    );
  }

  if (!campaign) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p>Kempen tidak dijumpai.</p>
          <Button onClick={onBack} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kembali
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header - Campaign Name with Back Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kembali
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{campaign.campaign_name}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Dicipta pada {new Date(campaign.created_at).toLocaleDateString('ms-MY', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>
        </div>
        <StatusBadge status={campaign.status} type="campaign" />
      </div>

      {/* Date Filter */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Card className="card-soft transition-smooth hover:shadow-medium border-primary/20">
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

      {/* First Row: Overview Cards (Campaign-specific data) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div whileHover={{ scale: 1.02, y: -4 }} transition={{ duration: 0.3 }}>
          <Card className="card-soft border-primary/20 transition-smooth hover:border-primary/40">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{stats.totalCalls}</div>
              <p className="text-xs text-muted-foreground mt-1">Contacts in this campaign</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div whileHover={{ scale: 1.02, y: -4 }} transition={{ duration: 0.3 }}>
          <Card className="card-soft border-primary/20 transition-smooth hover:border-primary/40">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Minutes Used</CardTitle>
              <div className="p-2 rounded-lg bg-primary/10">
                <Clock className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">
                {totalMinutesUsed.toFixed(1)} min
              </div>
              <p className="text-xs text-muted-foreground mt-1">Campaign usage</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div whileHover={{ scale: 1.02, y: -4 }} transition={{ duration: 0.3 }}>
          <Card className="card-soft border-success/20 transition-smooth hover:border-success/40">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Remaining Minutes</CardTitle>
              <div className="p-2 rounded-lg bg-success/10">
                <Wallet className="h-4 w-4 text-success" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success">{remainingMinutes.toFixed(1)} min</div>
              <p className="text-xs text-muted-foreground mt-1">Pro account balance</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Second Row: Call Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              <div className="text-3xl font-bold text-blue-600">{stats.totalCalls}</div>
              <p className="text-xs text-muted-foreground mt-1">Filtered by date</p>
            </CardContent>
          </Card>
        </motion.div>

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
              <div className="text-3xl font-bold text-success">{stats.answeredCalls}</div>
              <p className="text-xs text-muted-foreground mt-1">{stats.answeredPercent}% of total</p>
            </CardContent>
          </Card>
        </motion.div>

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
              <div className="text-3xl font-bold text-orange-600">{stats.unansweredCalls}</div>
              <p className="text-xs text-muted-foreground mt-1">{stats.unansweredPercent}% of total</p>
            </CardContent>
          </Card>
        </motion.div>

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
              <div className="text-3xl font-bold text-destructive">{stats.voicemailFailedCalls}</div>
              <p className="text-xs text-muted-foreground mt-1">{stats.voicemailFailedPercent}% of total</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Call Statistics Line Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.5 }}
      >
        <Card className="card-medium border-primary/20 transition-smooth hover:border-primary/30">
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
              ) : stats.totalCalls === 0 ? (
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
            ) : stageStats.length === 0 ? (
              <p className="text-muted-foreground">
                No answered calls with stage data for selected dates
              </p>
            ) : (
              <div className="space-y-4">
                {stageStats.map(({ stage, count, percent }, index) => (
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

      {/* Prompt Details */}
      {campaign.prompts && (
        <Card>
          <CardHeader>
            <CardTitle>Detail Prompt Yang Digunakan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="font-medium">Nama Prompt:</p>
                <p className="text-sm text-muted-foreground">{campaign.prompts.prompt_name}</p>
              </div>
              <div>
                <p className="font-medium">Mesej Pertama:</p>
                <ScrollArea className="max-h-32 w-full">
                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded">{campaign.prompts.first_message}</p>
                </ScrollArea>
              </div>
              <div>
                <p className="font-medium">Prompt:</p>
                <ScrollArea className="max-h-32 w-full">
                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded">{campaign.prompts.system_prompt}</p>
                </ScrollArea>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Call Logs Table - Filtered by Campaign */}
      <CallLogsTable campaignId={campaignId} />
    </div>
  );
}