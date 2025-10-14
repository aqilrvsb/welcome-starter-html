import { useCustomAuth } from '@/contexts/CustomAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  CheckCircle, 
  XCircle,
  BarChart3,
  DollarSign,
  Sparkles,
  AlertCircle,
  CalendarDays
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { StatsCards } from '@/components/analytics/StatsCards';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  isCallSuccessful, 
  isCallFailed
} from '@/lib/statusUtils';
import { EndCallReasonStats } from '@/components/analytics/EndCallReasonStats';
import { StageAnalytics } from '@/components/analytics/StageAnalytics';
import { DashboardFilters, DashboardFilters as DashboardFiltersType } from '@/components/analytics/DashboardFilters';
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FailedCallsTable } from '@/components/call-logs/FailedCallsTable';

export default function Dashboard() {
  const { user } = useCustomAuth();
  const { showOnboarding } = useOnboarding();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Initialize filters with today as default
  const today = new Date().toISOString().split('T')[0];
  const [filters, setFilters] = useState<DashboardFiltersType>({
    search: '',
    dateFrom: '',
    dateTo: today
  });

  // Check for payment success parameter
  useEffect(() => {
    if (searchParams.get('payment') === 'success') {
      setShowPaymentSuccess(true);
      // Clean up URL
      navigate('/dashboard', { replace: true });
    }
  }, [searchParams, navigate]);

  // Fetch dashboard analytics with filtering
  const { data: campaignsData, isLoading: campaignsLoading, error: campaignsError } = useQuery({
    queryKey: ['dashboard-campaigns', user?.id, filters],
    queryFn: async () => {
      if (!user) return [];
      
      let query = supabase
        .from('campaigns')
        .select('*')
        .eq('user_id', user.id);
      
      // Apply date range filter
      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        query = query.gte('created_at', fromDate.toISOString());
      }
      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        query = query.lte('created_at', toDate.toISOString());
      }
      
      // Default sorting by created_at desc
      query = query.order('created_at', { ascending: false });
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    retry: 2,
  });

  const { data: callLogsData, isLoading: callLogsLoading, error: callLogsError } = useQuery({
    queryKey: ['dashboard-call-logs', user?.id, filters],
    queryFn: async () => {
      if (!user) return [];
      
      let query = supabase
        .from('call_logs')
        .select('*')
        .eq('user_id', user.id);
      
      // Apply date range filter
      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        query = query.gte('created_at', fromDate.toISOString());
      }
      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        query = query.lte('created_at', toDate.toISOString());
      }
      
      const { data, error } = await query
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    retry: 2,
  });

  const { data: contactsData, isLoading: contactsLoading, error: contactsError } = useQuery({
    queryKey: ['dashboard-contacts', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', user.id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    retry: 2,
  });

  // Apply search filtering
  const filteredCampaigns = campaignsData?.filter(campaign => 
    campaign.campaign_name?.toLowerCase().includes(filters.search.toLowerCase())
  ) || [];

  const filteredCallLogs = callLogsData?.filter(log => 
    log.caller_number?.toLowerCase().includes(filters.search.toLowerCase()) ||
    log.phone_number?.toLowerCase().includes(filters.search.toLowerCase())
  ) || [];

  // Calculate stats with improved logic
  const stats = {
    totalCampaigns: filteredCampaigns.length,
    totalCalls: filteredCallLogs.length,
    successfulCalls: filteredCallLogs.filter(log => isCallSuccessful(log.status)).length,
    failedCalls: filteredCallLogs.filter(log => isCallFailed(log.status)).length,
    totalContacts: contactsData?.length || 0,
    totalCost: filteredCallLogs.reduce((sum, log) => {
      const metadata = log.metadata as { vapi_cost?: number } | null;
      const cost = metadata?.vapi_cost || 0;
      return sum + (typeof cost === 'number' ? cost : parseFloat(String(cost)) || 0);
    }, 0),
  };

  const hasErrors = campaignsError || callLogsError || contactsError;

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
              Thank you for subscribing to Pro. Your account has been activated and you now have access to all premium features.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-4">
            <Button onClick={() => setShowPaymentSuccess(false)} className="w-full">
              Get Started
            </Button>
            <Button 
              onClick={() => {
                setShowPaymentSuccess(false);
                navigate('/invoices');
              }} 
              variant="outline"
              className="w-full"
            >
              View Invoices
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
          {/* Header */}
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
                  Welcome back, {user?.username}!
                </h1>
                <p className="text-muted-foreground">
                  Here's an overview of your voice AI campaigns and performance.
                </p>
              </div>
              <div className="flex items-center gap-4">
                <Button 
                  variant="outline" 
                  onClick={showOnboarding} 
                  className="flex items-center gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>Show Guide</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Tabs Navigation */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="failed">Failed Calls</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6 mt-6">
              {/* Dashboard Filters */}
              <DashboardFilters 
                filters={filters}
                onFiltersChange={setFilters}
                totalCampaigns={stats.totalCampaigns}
                totalCalls={stats.totalCalls}
                totalContacts={stats.totalContacts}
              />

              {/* Error Alert */}
              {hasErrors && (
                <Alert variant="destructive" className="mb-6">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Unable to load dashboard data. Please refresh the page or try again later.
                  </AlertDescription>
                </Alert>
              )}

              {/* Stats Cards */}
              <StatsCards 
                stats={stats} 
                isLoading={campaignsLoading || callLogsLoading || contactsLoading} 
              />

              {/* End Call Reason Stats */}
              <EndCallReasonStats 
                callLogs={filteredCallLogs} 
                isLoading={callLogsLoading} 
              />

              {/* Stage Analytics */}
              <StageAnalytics 
                callLogs={filteredCallLogs} 
                isLoading={callLogsLoading} 
              />
            </TabsContent>

            <TabsContent value="failed" className="mt-6">
              <FailedCallsTable />
            </TabsContent>
          </Tabs>

          {/* Getting Started (show only if no campaigns) */}
          {(!filteredCampaigns || filteredCampaigns.length === 0) && !campaignsLoading && (
            <div className="mt-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5" />
                    <span>Get Started</span>
                  </CardTitle>
                  <CardDescription>
                    Set up your first voice AI campaign in minutes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-4">
                      <h4 className="font-medium">1. Configure Your Settings</h4>
                      <p className="text-sm text-muted-foreground">
                        Set up your API keys and phone configuration to enable voice calling.
                      </p>
                      <Button variant="outline" asChild>
                        <Link to="/settings">Configure Settings</Link>
                      </Button>
                    </div>
                    <div className="space-y-4">
                      <h4 className="font-medium">2. Create Prompt</h4>
                      <p className="text-sm text-muted-foreground">
                        Create conversation script for your AI assistant.
                      </p>
                      <Button variant="outline" asChild>
                        <Link to="/prompts">Create Prompt</Link>
                      </Button>
                    </div>
                    <div className="space-y-4">
                      <h4 className="font-medium">3. Start Call</h4>
                      <p className="text-sm text-muted-foreground">
                        Launch your first batch calling campaign.
                      </p>
                      <Button asChild>
                        <Link to="/contacts">Start Call</Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
      <OnboardingWizard />
    </div>
    </>
  );
}