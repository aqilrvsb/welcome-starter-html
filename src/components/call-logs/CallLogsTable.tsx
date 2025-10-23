import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCustomAuth } from '@/contexts/CustomAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Phone, Calendar, Clock, Play, FileText, DollarSign, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AudioPlayerDialog } from '@/components/ui/audio-player-dialog';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { CallLogsFilters, CallLogsFilters as CallLogsFiltersType } from './CallLogsFilters';
import { useToast } from '@/hooks/use-toast';

interface CallLog {
  id: string;
  call_id: string;
  user_id: string;
  campaign_id?: string;
  agent_id: string;
  caller_number: string;
  phone_number: string;
  vapi_call_id?: string;
  start_time: string;
  duration?: number;
  status: string;
  stage_reached?: string;
  created_at: string;
  updated_at: string;
  end_of_call_report?: any;
  customer_name?: string;
  cost?: number;
  recording_url?: string;
  transcript?: string;
  metadata?: {
    recording_url?: string;
    transcript?: string;
    stage_reached?: string;
    vapi_cost?: number;
    twilio_cost?: number;
    total_cost?: number;
    call_cost?: number; // Legacy field for backward compatibility
    [key: string]: any;
  };
}

interface Campaign {
  id: string;
  prompt_id: string;
}

interface Prompt {
  id: string;
  prompt_name: string;
  first_message: string;
}

export function CallLogsTable() {
  const { user } = useCustomAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<CallLogsFiltersType>({
    search: '',
    dateFrom: '',
    dateTo: '',
    sortBy: 'created_at',
    sortOrder: 'desc',
    callStatus: 'all',
    stage: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Get call logs from Supabase
  const { data: callLogs, isLoading, error } = useQuery({
    queryKey: ['call-logs', user?.id, filters],
    queryFn: async () => {
      if (!user) return [];
      
      // Build query with filtering and sorting, joining with contacts, campaigns, and prompts
      let query = supabase
        .from('call_logs')
        .select(`
          *,
          contacts(name, product),
          campaigns(campaign_name),
          prompts(prompt_name)
        `)
        .eq('user_id', user.id);

      // Add date range filter if provided
      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        query = query.gte('start_time', fromDate.toISOString());
      }
      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        query = query.lte('start_time', toDate.toISOString());
      }

      // Apply sorting
      const sortColumn = filters.sortBy;
      const ascending = filters.sortOrder === 'asc';
      query = query.order(sortColumn, { ascending });

      const { data, error } = await query;
      
      if (error) throw error;
      return data as CallLog[];
    },
    enabled: !!user,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Get campaigns and prompts
  const { data: campaigns } = useQuery({
    queryKey: ['campaigns', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('campaigns')
        .select('id, prompt_id')
        .eq('user_id', user.id);
      
      if (error) throw error;
      return data as Campaign[];
    },
    enabled: !!user,
  });

  const { data: prompts } = useQuery({
    queryKey: ['prompts', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('prompts')
        .select('*')
        .eq('user_id', user.id);
      
      if (error) throw error;
      return data as Prompt[];
    },
    enabled: !!user,
  });


  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (callLogId: string) => {
      // First get the call log to know which campaign to update
      const { data: callLog } = await supabase
        .from('call_logs')
        .select('campaign_id, status')
        .eq('id', callLogId)
        .single();

      // Delete the call log
      const { error } = await supabase
        .from('call_logs')
        .delete()
        .eq('id', callLogId)
        .eq('user_id', user?.id || '');
      
      if (error) throw error;

      // Update campaign statistics if there was a campaign
      if (callLog?.campaign_id) {
        // Determine if this was a successful or failed call
        const isSuccessful = ['completed', 'ended', 'answered'].includes(callLog.status);
        const isFailed = ['failed', 'cancelled'].includes(callLog.status);

        // Get current campaign stats
        const { data: campaign } = await supabase
          .from('campaigns')
          .select('successful_calls, failed_calls, total_numbers')
          .eq('id', callLog.campaign_id)
          .single();

        if (campaign) {
          // Decrement the appropriate counters
          const updates: any = {
            total_numbers: Math.max(0, (campaign.total_numbers || 0) - 1)
          };

          if (isSuccessful) {
            updates.successful_calls = Math.max(0, (campaign.successful_calls || 0) - 1);
          } else if (isFailed) {
            updates.failed_calls = Math.max(0, (campaign.failed_calls || 0) - 1);
          }

          await supabase
            .from('campaigns')
            .update(updates)
            .eq('id', callLog.campaign_id);
        }
      }

      return callLog;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-logs'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast({
        title: "Call log deleted",
        description: "The call log has been successfully deleted.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete call log: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const getPromptName = (log: any) => {
    // First try to get from the joined data
    if (log.campaigns?.prompts?.prompt_name) {
      return log.campaigns.prompts.prompt_name;
    }
    
    // Fallback to the old method
    if (!log.campaign_id) return 'No Campaign';
    
    const campaign = campaigns?.find(c => c.id === log.campaign_id);
    if (!campaign || !campaign.prompt_id) return 'No Prompt';
    
    const prompt = prompts?.find(p => p.id === campaign.prompt_id);
    return prompt?.prompt_name || 'Unknown Prompt';
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'ended': { variant: 'default' as const, label: 'Completed' },
      'in-progress': { variant: 'default' as const, label: 'In Progress' },
      'queued': { variant: 'secondary' as const, label: 'Queued' },
      'ringing': { variant: 'secondary' as const, label: 'Ringing' },
      'forwarding': { variant: 'outline' as const, label: 'Forwarding' },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || { variant: 'outline' as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatDuration = (duration?: number) => {
    if (!duration) return 'N/A';
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes} min ${seconds} sec`;
  };

  const filteredLogs = callLogs?.filter(log => {
    const searchLower = filters.search.toLowerCase();
    const customerName = (log.customer_name || (log as any).contacts?.name || '').toLowerCase();
    const matchesSearch = (
      log.caller_number.toLowerCase().includes(searchLower) ||
      getPromptName(log).toLowerCase().includes(searchLower) ||
      customerName.includes(searchLower)
    );

    // Apply call status filter
    const matchesStatus = 
      filters.callStatus === 'all' ? true :
      filters.callStatus === 'answered' ? log.status === 'answered' :
      log.status !== 'answered';

    // Apply stage filter
    const matchesStage = !filters.stage || 
      (log.stage_reached && log.stage_reached.toLowerCase().includes(filters.stage.toLowerCase()));

    return matchesSearch && matchesStatus && matchesStage;
  }) || [];

  const totalCost = filteredLogs.reduce(
    (sum, log) => sum + (log.metadata?.vapi_cost || 0), 
    0
  );

  const paginatedLogs = filteredLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);


  const renderRecordingButton = (log: any) => {
    // Check multiple possible locations for recording URL
    const recordingUrl = log?.recording_url ||
                        log?.metadata?.recording_url ||
                        log?.end_of_call_report?.call?.recording?.url ||
                        log?.end_of_call_report?.recording_url ||
                        log?.metadata?.recordingUrl;

    if (!recordingUrl) {
      return <span className="text-muted-foreground">No recording</span>;
    }

    return (
      <AudioPlayerDialog
        recordingUrl={recordingUrl}
        triggerButton={
          <Button variant="outline" size="sm" className="flex items-center gap-2">
            <Play className="h-4 w-4" />
            Play
          </Button>
        }
      />
    );
  };

  const renderTranscriptDialog = (log: any) => {
    const transcript = log?.transcript || log?.metadata?.transcript;
    if (!transcript) return <span className="text-muted-foreground">No transcript</span>;
    
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            View
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Call Transcript</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-96 w-full">
            <div className="whitespace-pre-wrap text-sm p-4 bg-muted rounded-md">
              {transcript}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    );
  };

  const renderSummaryDialog = (summary?: string) => {
    if (!summary) return <span className="text-muted-foreground">No summary</span>;
    
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            View
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>AI Summary</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-96 w-full">
            <div className="whitespace-pre-wrap text-sm p-4 bg-muted rounded-md">
              {summary}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    );
  };

  const renderErrorInfoDialog = (metadata: any) => {
    const endedReason = metadata?.ended_reason;
    const errorDetails = metadata?.error_details || metadata?.error;
    const twilioError = metadata?.twilio_error;
    
    if (!endedReason && !errorDetails && !twilioError) {
      return <span className="text-xs text-muted-foreground">-</span>;
    }
    
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 h-8 px-2 sm:px-3">
            <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-destructive" />
            <span className="hidden sm:inline text-xs">View</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-4 sm:p-6">
          <DialogHeader className="flex-shrink-0 pb-3">
            <DialogTitle className="text-base sm:text-lg">Information</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">Real call ended reason dari sistem</DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 -mr-4 pr-4">
            <div className="space-y-3 sm:space-y-4">
              {/* Real Error Details */}
              {endedReason && (
                <div className="p-3 sm:p-4 bg-destructive/10 border border-destructive/20 rounded-md">
                  <h3 className="font-semibold text-destructive mb-2 text-xs sm:text-sm flex items-center gap-1.5">
                    <span className="text-base sm:text-lg">🔴</span>
                    <span>Actual Ended Call Reason</span>
                  </h3>
                  <div className="p-2 sm:p-3 bg-background/50 rounded border">
                    <code className="text-[11px] sm:text-xs font-mono text-destructive break-all">
                      {endedReason}
                    </code>
                  </div>
                </div>
              )}
              
              {errorDetails && (
                <div className="p-3 sm:p-4 bg-destructive/10 border border-destructive/20 rounded-md">
                  <h3 className="font-semibold text-destructive mb-2 text-xs sm:text-sm flex items-center gap-1.5">
                    <span className="text-base sm:text-lg">⚠️</span>
                    <span>Error Details</span>
                  </h3>
                  <div className="p-2 sm:p-3 bg-background/50 rounded border">
                    <pre className="text-[10px] sm:text-xs font-mono whitespace-pre-wrap break-all leading-snug sm:leading-normal">{errorDetails}</pre>
                  </div>
                </div>
              )}
              
              {/* Kemungkinan Punca (Optional) */}
              {twilioError && (
                <div className="p-3 sm:p-4 bg-muted/50 border border-border rounded-md">
                  <h3 className="font-semibold text-muted-foreground mb-2 text-xs sm:text-sm flex items-center gap-1.5">
                    <span className="text-base sm:text-lg">💡</span>
                    <span>Kemungkinan Punca (AI Generated)</span>
                  </h3>
                  <p className="text-xs sm:text-sm mb-2 sm:mb-3 text-muted-foreground">
                    <strong className="text-[11px] sm:text-xs">Sebab:</strong>{' '}
                    <span className="text-[11px] sm:text-xs">{twilioError.sebab_utama}</span>
                  </p>
                  
                  {twilioError.kemungkinan_punca && twilioError.kemungkinan_punca.length > 0 && (
                    <div className="mb-2 sm:mb-3">
                      <p className="text-xs sm:text-sm font-semibold mb-1 text-muted-foreground">Kemungkinan Punca:</p>
                      <ul className="text-[10px] sm:text-xs list-disc list-inside space-y-0.5 sm:space-y-1 ml-2 text-muted-foreground">
                        {twilioError.kemungkinan_punca.map((punca: string, i: number) => (
                          <li key={i} className="leading-snug sm:leading-normal">{punca}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {twilioError.langkah_debug && twilioError.langkah_debug.length > 0 && (
                    <div>
                      <p className="text-xs sm:text-sm font-semibold mb-1 text-muted-foreground">Langkah Debug:</p>
                      <ul className="text-[10px] sm:text-xs list-disc list-inside space-y-0.5 sm:space-y-1 ml-2 text-muted-foreground">
                        {twilioError.langkah_debug.map((step: string, i: number) => (
                          <li key={i} className="leading-snug sm:leading-normal">{step}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    );
  };

  const renderCapturedDataDialog = (capturedData?: Record<string, any>) => {
    if (!capturedData || Object.keys(capturedData).length === 0) {
      return (
        <Button 
          variant="outline" 
          size="sm" 
          disabled
          className="flex items-center gap-1.5 text-xs h-9 px-3 w-full sm:w-auto opacity-50"
        >
          <FileText className="h-4 w-4 flex-shrink-0" />
          <span>No Data</span>
        </Button>
      );
    }
    
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className="flex items-center gap-1.5 text-xs h-9 px-3 w-full sm:w-auto font-medium"
          >
            <FileText className="h-4 w-4 flex-shrink-0" />
            <span className="whitespace-nowrap">View Data</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Data Captured dari Call</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] w-full pr-3">
            <div className="space-y-2 sm:space-y-3 p-1">
              {Object.entries(capturedData).map(([key, value]) => (
                <div key={key} className="p-2.5 sm:p-3 bg-muted rounded-md">
                  <div className="text-xs sm:text-sm font-semibold text-primary mb-1 capitalize">
                    {key.replace(/_/g, ' ')}
                  </div>
                  <div className="text-xs sm:text-sm break-words">
                    {value || '-'}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    );
  };


  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Call Logs</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-destructive">Error loading call logs: {(error as Error).message}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <CallLogsFilters 
        filters={filters}
        onFiltersChange={setFilters}
        totalCount={callLogs?.length || 0}
        filteredCount={filteredLogs.length}
        totalCost={totalCost}
      />
      
      <Card>
        <CardHeader>
          <CardTitle>Call Logs</CardTitle>
        </CardHeader>
        <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4 p-4">
                <Skeleton className="h-4 w-[150px]" />
                <Skeleton className="h-4 w-[120px]" />
                <Skeleton className="h-4 w-[100px]" />
                <Skeleton className="h-4 w-[80px]" />
              </div>
            ))}
          </div>
        ) : filteredLogs.length > 0 ? (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">No</TableHead>
                    <TableHead>Nama Customer</TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 font-semibold hover:bg-transparent"
                        onClick={() => setFilters({...filters, sortBy: 'caller_number', sortOrder: filters.sortBy === 'caller_number' && filters.sortOrder === 'asc' ? 'desc' : 'asc'})}
                      >
                        Prospect
                        {filters.sortBy === 'caller_number' && (
                          filters.sortOrder === 'asc' ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />
                        )}
                      </Button>
                    </TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Prompt</TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 font-semibold hover:bg-transparent"
                        onClick={() => setFilters({...filters, sortBy: 'status', sortOrder: filters.sortBy === 'status' && filters.sortOrder === 'asc' ? 'desc' : 'asc'})}
                      >
                        Status
                        {filters.sortBy === 'status' && (
                          filters.sortOrder === 'asc' ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />
                        )}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 font-semibold hover:bg-transparent"
                        onClick={() => setFilters({...filters, sortBy: 'start_time', sortOrder: filters.sortBy === 'start_time' && filters.sortOrder === 'asc' ? 'desc' : 'asc'})}
                      >
                        Started At
                        {filters.sortBy === 'start_time' && (
                          filters.sortOrder === 'asc' ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />
                        )}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 font-semibold hover:bg-transparent"
                        onClick={() => setFilters({...filters, sortBy: 'duration', sortOrder: filters.sortBy === 'duration' && filters.sortOrder === 'asc' ? 'desc' : 'asc'})}
                      >
                        Duration
                        {filters.sortBy === 'duration' && (
                          filters.sortOrder === 'asc' ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />
                        )}
                      </Button>
                    </TableHead>
                    <TableHead>Recording</TableHead>
                    <TableHead>Transcript</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedLogs.map((log, index) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-center font-medium">
                      {(currentPage - 1) * itemsPerPage + index + 1}
                    </TableCell>
                    <TableCell className="font-medium">
                      {log.customer_name || (log as any).contacts?.name || '-'}
                    </TableCell>
                    <TableCell className="font-medium">
                      {log.caller_number || 'Unknown'}
                    </TableCell>
                    <TableCell>
                      {(log as any).contacts?.product || '-'}
                    </TableCell>
                    <TableCell>
                      {(log as any).prompts?.prompt_name || '-'}
                    </TableCell>
                    <TableCell>
                      {(log as any).campaigns?.campaign_name || '-'}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium text-primary">
                        {log.stage_reached || log.metadata?.stage_reached || '-'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(log.status)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4 mr-1" />
                        {new Date(log.start_time).toLocaleDateString()}
                        <Clock className="h-4 w-4 ml-2 mr-1" />
                        {new Date(log.start_time).toLocaleTimeString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatDuration(log.duration)}
                    </TableCell>
                    <TableCell>
                      {renderRecordingButton(log)}
                    </TableCell>
                    <TableCell>
                      {renderTranscriptDialog(log)}
                    </TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Call Log?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this call log for {log.caller_number}? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(log.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden space-y-4">
              {paginatedLogs.map((log, index) => (
                <Card key={log.id} className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs bg-muted px-2 py-1 rounded">
                          #{(currentPage - 1) * itemsPerPage + index + 1}
                        </span>
                        {getStatusBadge(log.status)}
                      </div>
                      <h3 className="font-semibold text-sm">{log.customer_name || (log as any).contacts?.name || 'Unknown'}</h3>
                      <p className="text-xs text-muted-foreground">Phone: {log.caller_number}</p>
                      <p className="text-xs text-muted-foreground">Product: {(log as any).contacts?.product || '-'}</p>
                      <p className="text-xs text-muted-foreground">Prompt: {(log as any).prompts?.prompt_name || '-'}</p>
                      <p className="text-xs text-muted-foreground">Campaign: {(log as any).campaigns?.campaign_name || '-'}</p>
                      <p className="text-xs text-primary font-medium">Stage: {log.stage_reached || log.metadata?.stage_reached || '-'}</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Duration:</span>
                      <span className="font-medium">{formatDuration(log.duration)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Started:</span>
                      <div className="flex items-center gap-1 text-xs">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span>{new Date(log.start_time).toLocaleDateString()}</span>
                        <Clock className="h-3 w-3 text-muted-foreground ml-1" />
                        <span>{new Date(log.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
                    {renderRecordingButton(log)}
                    {renderTranscriptDialog(log)}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Call Log?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this call log for {log.caller_number}? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(log.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </Card>
              ))}
            </div>
          
          {filteredLogs.length > itemsPerPage && (
            <div className="flex justify-center mt-6">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (currentPage > 1) setCurrentPage(currentPage - 1);
                      }}
                      className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                  
                  {Array.from({ length: Math.ceil(filteredLogs.length / itemsPerPage) }, (_, i) => i + 1).map((page) => (
                    <PaginationItem key={page}>
                      <PaginationLink
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setCurrentPage(page);
                        }}
                        isActive={currentPage === page}
                        className="cursor-pointer"
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  
                  <PaginationItem>
                    <PaginationNext 
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (currentPage < Math.ceil(filteredLogs.length / itemsPerPage)) setCurrentPage(currentPage + 1);
                      }}
                      className={currentPage === Math.ceil(filteredLogs.length / itemsPerPage) ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
          </>
        ) : (
          <div className="text-center py-8">
            <Phone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {filters.search ? 'No call logs match your search' : 'No call logs found'}
            </p>
          </div>
        )}
        </CardContent>
      </Card>
    </div>
  );
}