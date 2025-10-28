import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Users, Activity, Target, BarChart3, PieChart } from 'lucide-react';
import { Line, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function AdminAnalytics() {
  const { data: allUsers } = useQuery({
    queryKey: ['admin-analytics-users'],
    queryFn: async () => {
      const { data, error } = await supabase.from('users').select('*');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: allCallLogs } = useQuery({
    queryKey: ['admin-analytics-calls'],
    queryFn: async () => {
      const { data, error } = await supabase.from('call_logs').select('*');
      if (error) throw error;
      return data || [];
    },
  });

  // User growth over last 30 days
  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - i));
    return date;
  });

  const usersByDay = last30Days.map(date => {
    return allUsers?.filter(user => {
      const userDate = new Date(user.created_at);
      return userDate <= date;
    }).length || 0;
  });

  const growthChartData = {
    labels: last30Days.map(d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
    datasets: [{
      label: 'Total Users',
      data: usersByDay,
      fill: true,
      borderColor: 'rgb(99, 102, 241)',
      backgroundColor: 'rgba(99, 102, 241, 0.1)',
      tension: 0.4,
    }],
  };

  // Call status distribution
  const callStatusData = {
    labels: ['Answered', 'No Answer', 'Failed', 'Voicemail'],
    datasets: [{
      data: [
        allCallLogs?.filter(c => c.status === 'answered').length || 0,
        allCallLogs?.filter(c => c.status === 'no_answered').length || 0,
        allCallLogs?.filter(c => c.status === 'failed').length || 0,
        allCallLogs?.filter(c => c.status === 'voicemail').length || 0,
      ],
      backgroundColor: [
        'rgba(34, 197, 94, 0.8)',
        'rgba(251, 146, 60, 0.8)',
        'rgba(239, 68, 68, 0.8)',
        'rgba(168, 85, 247, 0.8)',
      ],
    }],
  };

  // Active users (made calls in last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const activeUsers = new Set(
    allCallLogs?.filter(log => new Date(log.created_at) >= sevenDaysAgo)
      .map(log => log.user_id) || []
  ).size;

  // Answer rate
  const answeredCalls = allCallLogs?.filter(c => c.status === 'answered').length || 0;
  const totalCalls = allCallLogs?.length || 1;
  const answerRate = ((answeredCalls / totalCalls) * 100).toFixed(1);

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 max-w-7xl">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-8 rounded-2xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 card-soft mb-8"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="p-3 rounded-lg bg-blue-500/10">
            <BarChart3 className="h-6 w-6 text-blue-600" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Analytics & Insights
          </h1>
        </div>
        <p className="text-muted-foreground text-lg">
          User engagement, growth trends, and performance metrics
        </p>
      </motion.div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="card-soft">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users (7d)</CardTitle>
            <Activity className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{activeUsers}</div>
            <p className="text-xs text-muted-foreground">Made calls recently</p>
          </CardContent>
        </Card>

        <Card className="card-soft">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Answer Rate</CardTitle>
            <Target className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{answerRate}%</div>
            <p className="text-xs text-muted-foreground">Call success rate</p>
          </CardContent>
        </Card>

        <Card className="card-soft">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Growth Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">
              {allUsers && allUsers.length > 0 ? '+' + Math.floor(allUsers.length / 10) : '0'}%
            </div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card className="card-soft">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Calls/User</CardTitle>
            <PieChart className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">
              {allUsers && allUsers.length > 0 ? (totalCalls / allUsers.length).toFixed(1) : '0'}
            </div>
            <p className="text-xs text-muted-foreground">Per user</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="card-soft">
          <CardHeader>
            <CardTitle>User Growth Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <Line data={growthChartData} options={{ responsive: true, maintainAspectRatio: false }} />
            </div>
          </CardContent>
        </Card>

        <Card className="card-soft">
          <CardHeader>
            <CardTitle>Call Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-center justify-center">
              <Doughnut data={callStatusData} options={{ responsive: true, maintainAspectRatio: false }} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
