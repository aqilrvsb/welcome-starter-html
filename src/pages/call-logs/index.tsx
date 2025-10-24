import { Link } from 'react-router-dom';
import { useState } from 'react';
import { ArrowLeft, Phone, Users, CheckCircle, AlertCircle, Clock, Target, Download } from 'lucide-react';
import { CallLogsTable } from '@/components/call-logs/CallLogsTable';
import { motion } from 'framer-motion';
import { useCustomAuth } from '@/contexts/CustomAuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

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

export default function CallLogsPage() {
  const { user } = useCustomAuth();

  // Fetch all call logs data (filtering will be done by the table component)
  const { data: callLogsData, isLoading: callLogsLoading } = useQuery({
    queryKey: ['call-logs-stats', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('call_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch contacts data
  const { data: contactsData } = useQuery({
    queryKey: ['contacts-count', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from('contacts').select('*').eq('user_id', user.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch user data for total minutes
  const { data: userData } = useQuery({
    queryKey: ['user-minutes', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('users')
        .select('total_minutes_used')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Calculate statistics
  const totalContacts = contactsData?.length || 0;
  const totalCalls = callLogsData?.length || 0;
  const answeredCalls = callLogsData?.filter(log => log.status === 'answered').length || 0;
  const unansweredCalls = callLogsData?.filter(log => log.status === 'no_answered').length || 0;
  const failedCalls = callLogsData?.filter(log => log.status === 'failed').length || 0;
  const voicemailCalls = callLogsData?.filter(log => log.status === 'voicemail').length || 0;
  const totalMinutesUsed = userData?.total_minutes_used || 0;

  // Calculate stage statistics
  const stageStats = new Map<string, number>();
  const answeredCallLogs = callLogsData?.filter(log => log.status === 'answered') || [];
  answeredCallLogs.forEach(log => {
    const stage = log.stage_reached || 'Unknown';
    stageStats.set(stage, (stageStats.get(stage) || 0) + 1);
  });

  const stageData = Array.from(stageStats.entries()).map(([stage, count]) => ({
    stage,
    count,
    percent: answeredCallLogs.length > 0 ? ((count / answeredCallLogs.length) * 100).toFixed(1) : '0.0'
  })).sort((a, b) => b.count - a.count);

  // Export to CSV function
  const exportToCSV = () => {
    if (!callLogsData || callLogsData.length === 0) {
      alert('No data to export');
      return;
    }

    // Define CSV headers
    const headers = [
      'Date/Time',
      'Contact Name',
      'Phone Number',
      'Status',
      'Duration (min)',
      'Stage Reached',
      'Recording URL',
      'Campaign ID'
    ];

    // Convert data to CSV rows
    const csvRows = callLogsData.map(log => {
      const date = new Date(log.created_at).toLocaleString('en-MY', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      return [
        date,
        log.contact_name || 'N/A',
        log.phone_number || 'N/A',
        log.status || 'N/A',
        log.duration_minutes?.toFixed(2) || '0.00',
        log.stage_reached || 'N/A',
        log.recording_url || 'N/A',
        log.campaign_id || 'N/A'
      ];
    });

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `call-logs-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 max-w-7xl">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-4 sm:mb-6"
      >
        <Link
          to="/dashboard"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-smooth px-3 py-2 rounded-lg hover:bg-primary/5"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Kembali ke Dashboard
        </Link>
      </motion.div>

      {/* Header with gradient */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] as any }}
        className="p-8 rounded-2xl gradient-card card-soft mb-6 sm:mb-8"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-3 rounded-lg bg-primary/10">
                <Phone className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary via-primary-light to-primary-dark bg-clip-text text-transparent">
                Call Logs
              </h1>
            </div>
            <p className="text-muted-foreground text-base sm:text-lg">
              Lihat semua rekod panggilan dari voice agent
            </p>
          </div>
          <Button
            onClick={exportToCSV}
            className="gap-2 bg-gradient-to-r from-primary to-primary-dark hover:from-primary-dark hover:to-primary"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </motion.div>

      {/* Statistics Cards Row 1 */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6"
      >
        {/* Total Contacts */}
        <motion.div variants={itemVariants}>
          <motion.div whileHover={{ scale: 1.02, y: -4 }} transition={{ duration: 0.3 }}>
            <Card className="card-soft border-primary/20 transition-smooth hover:border-primary/40">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
                <div className="p-2 rounded-lg bg-primary/10">
                  <Users className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">{totalContacts}</div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* Total Calls */}
        <motion.div variants={itemVariants}>
          <motion.div whileHover={{ scale: 1.02, y: -4 }} transition={{ duration: 0.3 }}>
            <Card className="card-soft border-primary/20 transition-smooth hover:border-primary/40">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Phone className="h-4 w-4 text-blue-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{totalCalls}</div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* Answered Calls */}
        <motion.div variants={itemVariants}>
          <motion.div whileHover={{ scale: 1.02, y: -4 }} transition={{ duration: 0.3 }}>
            <Card className="card-soft border-success/20 transition-smooth hover:border-success/40">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Answered</CardTitle>
                <div className="p-2 rounded-lg bg-success/10">
                  <CheckCircle className="h-4 w-4 text-success" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-success">{answeredCalls}</div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* Unanswered Calls */}
        <motion.div variants={itemVariants}>
          <motion.div whileHover={{ scale: 1.02, y: -4 }} transition={{ duration: 0.3 }}>
            <Card className="card-soft border-orange-200 transition-smooth hover:border-orange-400">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Unanswered</CardTitle>
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{unansweredCalls}</div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* Failed Calls */}
        <motion.div variants={itemVariants}>
          <motion.div whileHover={{ scale: 1.02, y: -4 }} transition={{ duration: 0.3 }}>
            <Card className="card-soft border-destructive/20 transition-smooth hover:border-destructive/40">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Failed</CardTitle>
                <div className="p-2 rounded-lg bg-destructive/10">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{failedCalls}</div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* Voicemail Calls */}
        <motion.div variants={itemVariants}>
          <motion.div whileHover={{ scale: 1.02, y: -4 }} transition={{ duration: 0.3 }}>
            <Card className="card-soft border-purple-200 transition-smooth hover:border-purple-400">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Voicemail</CardTitle>
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Phone className="h-4 w-4 text-purple-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">{voicemailCalls}</div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* Total Minutes Used */}
        <motion.div variants={itemVariants}>
          <motion.div whileHover={{ scale: 1.02, y: -4 }} transition={{ duration: 0.3 }}>
            <Card className="card-soft border-primary/20 transition-smooth hover:border-primary/40">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Minutes</CardTitle>
                <div className="p-2 rounded-lg bg-primary/10">
                  <Clock className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">{totalMinutesUsed.toFixed(1)} min</div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Dynamic Stage Analytics Row */}
      {stageData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Card className="mb-6 card-medium border-primary/20">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Dynamic Stage Analytics</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Distribution of answered calls by conversation stage
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {stageData.map(({ stage, count, percent }, index) => (
                  <motion.div
                    key={stage}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                  >
                    <Card className="card-soft border-primary/10 transition-smooth hover:border-primary/30">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-muted-foreground">Stage</span>
                          <span className="text-xs text-muted-foreground">{percent}%</span>
                        </div>
                        <div className="text-xl font-bold text-primary mb-1">{stage}</div>
                        <div className="text-sm text-muted-foreground">{count} calls</div>
                        <div className="mt-3 w-full bg-muted rounded-full h-2 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${percent}%` }}
                            transition={{ duration: 0.8, delay: index * 0.1 + 0.2 }}
                            className="bg-gradient-to-r from-primary to-primary-light h-2 rounded-full"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Call Logs Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        <CallLogsTable />
      </motion.div>
    </div>
  );
}
