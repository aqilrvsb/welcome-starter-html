import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Download, Calendar } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminReports() {
  const { data: allUsers } = useQuery({
    queryKey: ['admin-reports-users'],
    queryFn: async () => {
      const { data, error } = await supabase.from('users').select('*');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: allCallLogs } = useQuery({
    queryKey: ['admin-reports-calls'],
    queryFn: async () => {
      const { data, error } = await supabase.from('call_logs').select('*, users(username, email)');
      if (error) throw error;
      return data || [];
    },
  });

  const exportUsersCSV = () => {
    if (!allUsers || allUsers.length === 0) {
      toast.error('No users to export');
      return;
    }

    const headers = ['Username', 'Email', 'Pro Minutes', 'Trial Minutes', 'Minutes Used', 'Created Date'];
    const csvData = allUsers.map(user => [
      user.username,
      user.email || 'N/A',
      (user.pro_balance_minutes || 0).toFixed(1),
      (user.trial_balance_minutes || 0).toFixed(1),
      (user.total_minutes_used || 0).toFixed(1),
      new Date(user.created_at).toLocaleDateString(),
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `users-report-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast.success('Users report exported successfully!');
  };

  const exportCallLogsCSV = () => {
    if (!allCallLogs || allCallLogs.length === 0) {
      toast.error('No call logs to export');
      return;
    }

    const headers = ['User', 'Contact', 'Phone', 'Status', 'Duration (min)', 'Date/Time'];
    const csvData = allCallLogs.map(log => [
      log.users?.username || 'N/A',
      log.contact_name || 'N/A',
      log.phone_number || 'N/A',
      log.status || 'N/A',
      (log.duration_minutes || 0).toFixed(2),
      new Date(log.created_at).toLocaleString(),
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `call-logs-report-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast.success('Call logs report exported successfully!');
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 max-w-7xl">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-8 rounded-2xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 card-soft mb-8"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="p-3 rounded-lg bg-indigo-500/10">
            <FileText className="h-6 w-6 text-indigo-600" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Reports & Export
          </h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Generate and export comprehensive business reports
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="card-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Users Report
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Export complete user database with minutes balance and usage statistics
            </p>
            <Button onClick={exportUsersCSV} className="w-full gap-2">
              <Download className="h-4 w-4" />
              Export Users CSV
            </Button>
          </CardContent>
        </Card>

        <Card className="card-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Call Logs Report
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Export all call logs with user info, status, and duration details
            </p>
            <Button onClick={exportCallLogsCSV} className="w-full gap-2">
              <Download className="h-4 w-4" />
              Export Call Logs CSV
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
