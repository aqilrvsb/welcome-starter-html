import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCustomAuth } from "@/contexts/CustomAuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, TrendingUp, BarChart3, Phone, Calendar, Clock, Play, FileText, Trash2, Info, Users, CheckCircle, XCircle } from "lucide-react";
import { isCallSuccessful, isCallFailed } from "@/lib/statusUtils";
import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AudioPlayerDialog } from "@/components/ui/audio-player-dialog";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface CampaignBatchDetailProps {
  campaignName: string;
  onBack: () => void;
}

interface Campaign {
  id: string;
  campaign_name: string;
  status: string;
  total_numbers: number;
  successful_calls: number;
  failed_calls: number;
  created_at: string;
  updated_at: string;
  prompt_id: string | null;
}

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
  captured_data?: Record<string, any>;
  metadata?: {
    recording_url?: string;
    transcript?: string;
    summary?: string;
    stage_reached?: string;
    vapi_cost?: number;
    twilio_cost?: number;
    total_cost?: number;
    call_cost?: number;
    ended_reason?: string;
    error_details?: string;
    error?: string;
    twilio_error?: any;
    [key: string]: any;
  };
  contacts?: {
    name: string;
  };
}

export function CampaignBatchDetail({ campaignName, onBack }: CampaignBatchDetailProps) {
  const { user } = useCustomAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Fetch all campaigns with this name
  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["campaign-batch-detail", campaignName, user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("user_id", user.id)
        .eq("campaign_name", campaignName)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Campaign[];
    },
    enabled: !!user && !!campaignName,
  });

  // Fetch prompts to show prompt names and details
  const { data: prompts } = useQuery({
    queryKey: ["prompts", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase.from("prompts").select("*").eq("user_id", user.id);

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Get the first campaign's prompt for displaying details
  const firstCampaignPrompt = campaigns && campaigns.length > 0 && campaigns[0].prompt_id 
    ? prompts?.find(p => p.id === campaigns[0].prompt_id)
    : null;

  // Fetch ALL call logs for this campaign name
  const { data: callLogs, isLoading: callLogsLoading } = useQuery({
    queryKey: ["campaign-batch-calls", campaignName, user?.id],
    queryFn: async () => {
      if (!user?.id || !campaigns) return [];

      const campaignIds = campaigns.map((c) => c.id);

      const { data, error } = await supabase
        .from("call_logs")
        .select(
          `
          *,
          contacts(name)
        `,
        )
        .eq("user_id", user.id)
        .in("campaign_id", campaignIds)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as CallLog[];
    },
    enabled: !!user && !!campaigns && campaigns.length > 0,
  });

  // Calculate stage statistics from call logs
  const stageStats = useMemo(() => {
    if (!callLogs) return [];

    const answeredCalls = callLogs.filter((log) => log.status === "answered");
    const stageMap = new Map<string, { count: number; first_occurrence: number }>();

    answeredCalls.forEach((log, index) => {
      const metadata = log.metadata as any;
      const stageReached = metadata?.stage_reached;

      if (!stageReached) return;

      const stageName = String(stageReached).trim();

      if (stageMap.has(stageName)) {
        stageMap.get(stageName)!.count++;
      } else {
        stageMap.set(stageName, {
          count: 1,
          first_occurrence: index,
        });
      }
    });

    const stageArray = Array.from(stageMap.entries()).map(([stage_name, data]) => ({
      stage_name,
      count: data.count,
      first_occurrence: data.first_occurrence,
    }));

    stageArray.sort((a, b) => a.first_occurrence - b.first_occurrence);

    return stageArray;
  }, [callLogs]);

  const totalStages = useMemo(() => {
    return stageStats.reduce((sum, stage) => sum + stage.count, 0);
  }, [stageStats]);

  const getStagePercentage = (count: number) => {
    return totalStages > 0 ? ((count / totalStages) * 100).toFixed(1) : "0.0";
  };

  const getStageColor = (index: number) => {
    const colors = [
      { text: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/30" },
      { text: "text-green-500", bg: "bg-green-50 dark:bg-green-950/30" },
      { text: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-950/30" },
      { text: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-950/30" },
      { text: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
      { text: "text-pink-500", bg: "bg-pink-50 dark:bg-pink-950/30" },
      { text: "text-indigo-500", bg: "bg-indigo-50 dark:bg-indigo-950/30" },
      { text: "text-teal-500", bg: "bg-teal-50 dark:bg-teal-950/30" },
      { text: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950/30" },
      { text: "text-cyan-500", bg: "bg-cyan-50 dark:bg-cyan-950/30" },
    ];
    return colors[index % colors.length];
  };

  const getPromptName = (campaignId?: string) => {
    if (!campaignId) return "No Campaign";

    const campaign = campaigns?.find((c) => c.id === campaignId);
    if (!campaign || !campaign.prompt_id) return "No Prompt";

    const prompt = prompts?.find((p) => p.id === campaign.prompt_id);
    return prompt?.prompt_name || "Unknown Prompt";
  };

  const getBatchNumber = (campaignId?: string) => {
    if (!campaignId || !campaigns) return "-";

    // Find the index of this campaign in the sorted list (newest first)
    const index = campaigns.findIndex((c) => c.id === campaignId);
    if (index === -1) return "-";

    // Return batch number (counting from 1, with newest being #1)
    return `#${index + 1}`;
  };

  // Calculate totals from campaigns
  const totals = campaigns?.reduce(
    (acc, campaign) => ({
      batches: acc.batches + 1,
      calls: acc.calls + (campaign.total_numbers || 0),
      successful: acc.successful + (campaign.successful_calls || 0),
      failed: acc.failed + (campaign.failed_calls || 0),
    }),
    { batches: 0, calls: 0, successful: 0, failed: 0 },
  );

  // Calculate accurate statistics from call logs
  const stats = useMemo(() => {
    if (!callLogs || callLogs.length === 0) {
      return {
        totalCalls: totals?.calls || 0,
        successfulCalls: totals?.successful || 0,
        failedCalls: totals?.failed || 0,
        successRate: 0
      };
    }

    const successfulCalls = callLogs.filter(log => isCallSuccessful(log.status)).length;
    const failedCalls = callLogs.filter(log => isCallFailed(log.status)).length;
    const totalCalls = callLogs.length;
    const successRate = totalCalls > 0 ? (successfulCalls / totalCalls * 100) : 0;

    return {
      totalCalls,
      successfulCalls,
      failedCalls,
      successRate: Math.round(successRate * 10) / 10
    };
  }, [callLogs, totals]);

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (callLogId: string) => {
      const { data: callLog } = await supabase
        .from("call_logs")
        .select("campaign_id, status")
        .eq("id", callLogId)
        .single();

      const { error } = await supabase
        .from("call_logs")
        .delete()
        .eq("id", callLogId)
        .eq("user_id", user?.id || "");

      if (error) throw error;

      if (callLog?.campaign_id) {
        const isSuccessful = ["completed", "ended", "answered"].includes(callLog.status);
        const isFailed = ["failed", "cancelled"].includes(callLog.status);

        const { data: campaign } = await supabase
          .from("campaigns")
          .select("successful_calls, failed_calls, total_numbers")
          .eq("id", callLog.campaign_id)
          .single();

        if (campaign) {
          const updates: any = {
            total_numbers: Math.max(0, (campaign.total_numbers || 0) - 1),
          };

          if (isSuccessful) {
            updates.successful_calls = Math.max(0, (campaign.successful_calls || 0) - 1);
          } else if (isFailed) {
            updates.failed_calls = Math.max(0, (campaign.failed_calls || 0) - 1);
          }

          await supabase.from("campaigns").update(updates).eq("id", callLog.campaign_id);
        }
      }

      return callLog;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-batch-calls"] });
      queryClient.invalidateQueries({ queryKey: ["campaign-batch-detail"] });
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

  // Helper functions
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      ended: { variant: "default" as const, label: "Completed" },
      answered: { variant: "default" as const, label: "Answered" },
      "in-progress": { variant: "default" as const, label: "In Progress" },
      queued: { variant: "secondary" as const, label: "Queued" },
      ringing: { variant: "secondary" as const, label: "Ringing" },
      failed: { variant: "destructive" as const, label: "Failed" },
      cancelled: { variant: "outline" as const, label: "Cancelled" },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || { variant: "outline" as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatDuration = (duration?: number) => {
    if (!duration) return "N/A";
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const renderRecordingButton = (log: CallLog) => {
    const recordingUrl =
      log?.metadata?.recording_url ||
      log?.end_of_call_report?.call?.recording?.url ||
      log?.end_of_call_report?.recording_url ||
      log?.metadata?.recordingUrl;

    if (!recordingUrl) {
      return <span className="text-xs text-muted-foreground">No recording</span>;
    }

    return (
      <AudioPlayerDialog
        recordingUrl={recordingUrl}
        triggerButton={
          <Button variant="outline" size="sm" className="flex items-center gap-2 h-8">
            <Play className="h-3 w-3" />
            <span className="text-xs">Play</span>
          </Button>
        }
      />
    );
  };

  const renderTranscriptDialog = (transcript?: string) => {
    if (!transcript) return <span className="text-xs text-muted-foreground">No transcript</span>;

    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="flex items-center gap-2 h-8">
            <FileText className="h-3 w-3" />
            <span className="text-xs">View</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Call Transcript</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-96 w-full">
            <div className="whitespace-pre-wrap text-sm p-4 bg-muted rounded-md">{transcript}</div>
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
          <Button variant="outline" size="sm" className="gap-1.5 h-8 px-2">
            <Info className="h-3 w-3 text-destructive" />
            <span className="text-xs">Info</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Call Information</DialogTitle>
            <DialogDescription>Ended reason dan error details</DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1">
            <div className="space-y-4">
              {endedReason && (
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md">
                  <h3 className="font-semibold text-destructive mb-2 text-sm">Ended Reason</h3>
                  <code className="text-xs font-mono break-all">{endedReason}</code>
                </div>
              )}
              {errorDetails && (
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md">
                  <h3 className="font-semibold text-destructive mb-2 text-sm">Error Details</h3>
                  <pre className="text-xs font-mono whitespace-pre-wrap break-all">{errorDetails}</pre>
                </div>
              )}
              {twilioError && (
                <div className="p-4 bg-muted/50 border rounded-md">
                  <h3 className="font-semibold mb-2 text-sm">Twilio Error Analysis</h3>
                  <p className="text-sm mb-2">
                    <strong>Sebab:</strong> {twilioError.sebab_utama}
                  </p>
                  {twilioError.kemungkinan_punca && (
                    <div className="mb-2">
                      <p className="text-sm font-semibold">Kemungkinan Punca:</p>
                      <ul className="text-xs list-disc list-inside space-y-1 ml-2">
                        {twilioError.kemungkinan_punca.map((punca: string, i: number) => (
                          <li key={i}>{punca}</li>
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
      return <span className="text-xs text-muted-foreground">No data</span>;
    }

    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="flex items-center gap-2 h-8">
            <FileText className="h-3 w-3" />
            <span className="text-xs">View</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Captured Data</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-3">
              {Object.entries(capturedData).map(([key, value]) => (
                <div key={key} className="p-3 bg-muted rounded-md">
                  <p className="font-semibold text-sm mb-1">{key}</p>
                  <p className="text-sm">
                    {typeof value === "object" ? JSON.stringify(value, null, 2) : String(value)}
                  </p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    );
  };

  // Filter and paginate call logs
  const filteredLogs =
    callLogs?.filter((log) => {
      const searchLower = searchQuery.toLowerCase();
      const customerName = (log.contacts?.name || "").toLowerCase();
      return (
        log.caller_number.toLowerCase().includes(searchLower) ||
        customerName.includes(searchLower) ||
        getPromptName(log.campaign_id).toLowerCase().includes(searchLower)
      );
    }) || [];

  const paginatedLogs = filteredLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={onBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Kembali
              </Button>
              <div>
                <CardTitle>{campaignName}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Dicipta pada {campaigns && campaigns.length > 0 ? new Date(campaigns[0].created_at).toLocaleDateString('ms-MY', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : '-'}
                </p>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Jumlah Nombor</p>
                <p className="text-2xl font-bold">{stats.totalCalls}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-success" />
              <div>
                <p className="text-sm text-muted-foreground">Angkat Call</p>
                <p className="text-2xl font-bold text-success">{stats.successfulCalls}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive" />
              <div>
                <p className="text-sm text-muted-foreground">Tak Angkat Call</p>
                <p className="text-2xl font-bold text-destructive">{stats.failedCalls}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stage Analytics */}
      {stageStats.length > 0 && (
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span>Stage Analytics</span>
            </CardTitle>
            <CardDescription>Distribution of answered calls by conversation stage reached</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stageStats.map((stage, index) => {
                const colorScheme = getStageColor(index);
                return (
                  <div key={index} className={`flex items-center justify-between p-4 rounded-lg ${colorScheme.bg}`}>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-background">
                        <BarChart3 className={`h-5 w-5 ${colorScheme.text}`} />
                      </div>
                      <div>
                        <span className="text-sm font-medium">{stage.stage_name}</span>
                        <p className="text-xs text-muted-foreground">
                          Stage {index + 1} of {stageStats.length}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">{stage.count}</p>
                      <p className="text-xs text-muted-foreground">{getStagePercentage(stage.count)}% of calls</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {totalStages > 0 && (
              <div className="mt-6 pt-4 border-t">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Answered Calls Analyzed</span>
                  <span className="font-medium">{totalStages}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Prompt Details */}
      {firstCampaignPrompt && (
        <Card>
          <CardHeader>
            <CardTitle>Detail Prompt Yang Digunakan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="font-medium">Nama Prompt:</p>
                <p className="text-sm text-muted-foreground">{firstCampaignPrompt.prompt_name}</p>
              </div>
              <div>
                <p className="font-medium">Mesej Pertama:</p>
                <ScrollArea className="max-h-32 w-full">
                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded">{firstCampaignPrompt.first_message}</p>
                </ScrollArea>
              </div>
              <div>
                <p className="font-medium">Prompt:</p>
                <ScrollArea className="max-h-32 w-full">
                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded">{firstCampaignPrompt.system_prompt}</p>
                </ScrollArea>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Call Logs List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle>Senarai Call Logs</CardTitle>
            <Input
              placeholder="Cari nombor, nama, atau prompt..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-64"
            />
          </div>
          <CardDescription>Semua panggilan untuk kempen "{campaignName}"</CardDescription>
        </CardHeader>
        <CardContent>
          {callLogsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? "Tiada call logs dijumpai untuk carian ini" : "Tiada call logs dijumpai"}
            </div>
          ) : (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">Batch</TableHead>
                      <TableHead className="w-[140px]">Nombor</TableHead>
                      <TableHead className="w-[120px]">Nama</TableHead>
                      <TableHead className="w-[100px]">Status</TableHead>
                      <TableHead className="w-[140px]">Masa Mula</TableHead>
                      <TableHead className="w-[80px]">Durasi</TableHead>
                      <TableHead className="w-[120px]">Prompt</TableHead>
                      <TableHead className="w-[100px]">Recording</TableHead>
                      <TableHead className="w-[100px]">Transcript</TableHead>
                      <TableHead className="w-[100px]">Captured Data</TableHead>
                      <TableHead className="w-[80px]">Info</TableHead>
                      <TableHead className="w-[80px]">Tindakan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-semibold text-xs">{getBatchNumber(log.campaign_id)}</TableCell>
                        <TableCell className="font-mono text-xs">{log.caller_number}</TableCell>
                        <TableCell className="text-xs">{log.contacts?.name || "-"}</TableCell>
                        <TableCell>{getStatusBadge(log.status)}</TableCell>
                        <TableCell className="text-xs">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(log.start_time).toLocaleDateString("ms-MY", {
                              day: "2-digit",
                              month: "short",
                            })}
                          </div>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {new Date(log.start_time).toLocaleTimeString("ms-MY", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">{formatDuration(log.duration)}</TableCell>
                        <TableCell className="text-xs">{getPromptName(log.campaign_id)}</TableCell>
                        <TableCell>{renderRecordingButton(log)}</TableCell>
                        <TableCell>{renderTranscriptDialog(log.metadata?.transcript)}</TableCell>
                        <TableCell>{renderCapturedDataDialog(log.captured_data)}</TableCell>
                        <TableCell>{renderErrorInfoDialog(log.metadata)}</TableCell>
                        <TableCell>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Padam Call Log?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tindakan ini tidak boleh dibatalkan. Call log akan dipadam secara kekal.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Batal</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate(log.id)}
                                  className="bg-destructive hover:bg-destructive/90"
                                >
                                  Padam
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

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <PaginationItem key={page}>
                          <PaginationLink
                            onClick={() => setCurrentPage(page)}
                            isActive={currentPage === page}
                            className="cursor-pointer"
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}

              {/* Summary Info */}
              <div className="mt-4 text-sm text-muted-foreground">
                Menunjukkan {paginatedLogs.length} daripada {filteredLogs.length} call logs
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
