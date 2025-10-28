import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, User, Clock, CheckCircle, XCircle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export default function AdminCallLogs() {
  const { data: allCallLogs, isLoading } = useQuery({
    queryKey: ['admin-all-call-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('call_logs')
        .select('*, users!call_logs_user_id_fkey(username, email)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'answered':
        return <Badge className="bg-green-500">Answered</Badge>;
      case 'no_answered':
        return <Badge className="bg-orange-500">No Answer</Badge>;
      case 'failed':
        return <Badge className="bg-red-500">Failed</Badge>;
      case 'voicemail':
        return <Badge className="bg-purple-500">Voicemail</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 max-w-7xl">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="p-8 rounded-2xl bg-gradient-to-r from-green-500/10 to-blue-500/10 card-soft mb-8"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="p-3 rounded-lg bg-green-500/10">
            <Phone className="h-6 w-6 text-green-600" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
            All Call Logs
          </h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Complete call history from all users across the system
        </p>
      </motion.div>

      {/* Summary Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"
      >
        <Card className="card-soft">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">{allCallLogs?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Total Calls</p>
          </CardContent>
        </Card>
        <Card className="card-soft">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">
              {allCallLogs?.filter(log => log.status === 'answered').length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Answered</p>
          </CardContent>
        </Card>
        <Card className="card-soft">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-orange-600">
              {allCallLogs?.filter(log => log.status === 'no_answered').length || 0}
            </div>
            <p className="text-xs text-muted-foreground">No Answer</p>
          </CardContent>
        </Card>
        <Card className="card-soft">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">
              {allCallLogs?.filter(log => log.status === 'failed').length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Failed</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Call Logs Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <Card className="card-soft">
          <CardHeader>
            <CardTitle>Call Logs ({allCallLogs?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center py-8 text-muted-foreground">Loading call logs...</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Date/Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allCallLogs?.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="font-medium">{log.users?.username}</div>
                              <div className="text-xs text-muted-foreground">{log.users?.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{log.contact_name || 'N/A'}</TableCell>
                        <TableCell>{log.phone_number || 'N/A'}</TableCell>
                        <TableCell>{getStatusBadge(log.status)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            {log.duration_minutes?.toFixed(2) || '0.00'} min
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(log.created_at).toLocaleString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
