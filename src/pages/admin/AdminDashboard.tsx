import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Users, Phone, CreditCard, Clock, TrendingUp, Target, MessageSquare } from 'lucide-react';

export default function AdminDashboard() {
  // Fetch all users
  const { data: allUsers } = useQuery({
    queryKey: ['admin-all-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch all call logs
  const { data: allCallLogs } = useQuery({
    queryKey: ['admin-all-call-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('call_logs')
        .select('*');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch all campaigns
  const { data: allCampaigns } = useQuery({
    queryKey: ['admin-all-campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch all contacts
  const { data: allContacts } = useQuery({
    queryKey: ['admin-all-contacts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('*');
      if (error) throw error;
      return data || [];
    },
  });

  // Calculate statistics
  const totalUsers = allUsers?.length || 0;
  const totalCalls = allCallLogs?.length || 0;
  const totalCampaigns = allCampaigns?.length || 0;
  const totalContacts = allContacts?.length || 0;

  // Calculate minutes used
  const totalMinutesUsed = allUsers?.reduce((sum, user) => sum + (user.total_minutes_used || 0), 0) || 0;
  const totalProMinutes = allUsers?.reduce((sum, user) => sum + (user.pro_balance_minutes || 0), 0) || 0;
  const totalTrialMinutes = allUsers?.reduce((sum, user) => sum + (user.trial_balance_minutes || 0), 0) || 0;

  // Count users who topped up (have pro minutes > 0)
  const usersWithTopUp = allUsers?.filter(user => (user.pro_balance_minutes || 0) > 0).length || 0;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
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
      },
    },
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 max-w-7xl">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="p-8 rounded-2xl bg-gradient-to-r from-red-500/10 to-orange-500/10 card-soft mb-8"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="p-3 rounded-lg bg-red-500/10">
            <Shield className="h-6 w-6 text-red-600" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
            Admin Dashboard
          </h1>
        </div>
        <p className="text-muted-foreground text-lg">
          System-wide statistics and monitoring
        </p>
      </motion.div>

      {/* Statistics Cards */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
      >
        {/* Total Users */}
        <motion.div variants={itemVariants}>
          <Card className="card-soft border-blue-200 hover:border-blue-400 transition-smooth">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Users className="h-4 w-4 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{totalUsers}</div>
              <p className="text-xs text-muted-foreground mt-1">Registered accounts</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Total Calls */}
        <motion.div variants={itemVariants}>
          <Card className="card-soft border-green-200 hover:border-green-400 transition-smooth">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
              <div className="p-2 rounded-lg bg-green-500/10">
                <Phone className="h-4 w-4 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{totalCalls}</div>
              <p className="text-xs text-muted-foreground mt-1">All time calls</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Total Campaigns */}
        <motion.div variants={itemVariants}>
          <Card className="card-soft border-purple-200 hover:border-purple-400 transition-smooth">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Target className="h-4 w-4 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600">{totalCampaigns}</div>
              <p className="text-xs text-muted-foreground mt-1">Active campaigns</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Total Contacts */}
        <motion.div variants={itemVariants}>
          <Card className="card-soft border-orange-200 hover:border-orange-400 transition-smooth">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
              <div className="p-2 rounded-lg bg-orange-500/10">
                <MessageSquare className="h-4 w-4 text-orange-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">{totalContacts}</div>
              <p className="text-xs text-muted-foreground mt-1">In database</p>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Minutes Statistics */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
      >
        {/* Users with Top-Up */}
        <Card className="card-soft border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Users Topped Up</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{usersWithTopUp}</div>
            <p className="text-xs text-muted-foreground mt-1">Have pro minutes</p>
          </CardContent>
        </Card>

        {/* Total Minutes Used */}
        <Card className="card-soft border-red-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Minutes Used</CardTitle>
            <Clock className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{totalMinutesUsed.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground mt-1">Total consumed</p>
          </CardContent>
        </Card>

        {/* Remaining Pro Minutes */}
        <Card className="card-soft border-green-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pro Minutes Left</CardTitle>
            <CreditCard className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{totalProMinutes.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground mt-1">Across all users</p>
          </CardContent>
        </Card>

        {/* Remaining Trial Minutes */}
        <Card className="card-soft border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trial Minutes Left</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{totalTrialMinutes.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground mt-1">Across all users</p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
