import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AudioPlayerDialog } from "@/components/ui/audio-player-dialog";
import { ArrowLeft, Phone, CheckCircle, XCircle, Clock, BarChart3, Play, FileText, DollarSign, Users } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { isCallSuccessful, isCallFailed } from "@/lib/statusUtils";
import { useMemo } from "react";
import { StageAnalytics } from "@/components/analytics/StageAnalytics";

interface CampaignDetailsProps {
  campaignId: string;
  onBack: () => void;
}

export function CampaignDetails({ campaignId, onBack }: CampaignDetailsProps) {
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
    queryKey: ["call-logs", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('call_logs')
        .select(`
          *,
          contacts(name)
        `)
        .eq('campaign_id', campaignId)
        .order('start_time', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Calculate accurate statistics from call logs
  const stats = useMemo(() => {
    if (!callLogs || callLogs.length === 0) {
      return {
        totalCalls: campaign?.total_numbers || 0,
        successfulCalls: campaign?.successful_calls || 0,
        failedCalls: campaign?.failed_calls || 0,
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
  }, [callLogs, campaign]);

  const costBreakdown = useMemo(() => {
    if (!callLogs) return { totalCost: 0, vapiCost: 0, twilioCost: 0 };
    
    return callLogs.reduce((acc, log) => {
      const metadata = log.metadata as any;
      const vapiCost = metadata?.vapi_cost || 0;
      const twilioCost = metadata?.twilio_cost || 0;
      
      return {
        totalCost: acc.totalCost + vapiCost, // Only VAPI cost in total
        vapiCost: acc.vapiCost + vapiCost,
        twilioCost: acc.twilioCost + twilioCost
      };
    }, { totalCost: 0, vapiCost: 0, twilioCost: 0 });
  }, [callLogs]);


  const renderRecordingButton = (log: any) => {
    const recordingUrl = (log?.metadata as any)?.recording_url ||
      log?.end_of_call_report?.call?.recording?.url ||
      log?.end_of_call_report?.recording_url ||
      (log?.metadata as any)?.recordingUrl;

    if (!recordingUrl) return <span className="text-muted-foreground">Tiada rakaman</span>;

    return (
      <AudioPlayerDialog
        recordingUrl={recordingUrl}
        triggerButton={
          <Button variant="outline" size="sm" className="flex items-center gap-2">
            <Play className="h-4 w-4" />
            Main
          </Button>
        }
      />
    );
  };

  const renderTranscriptDialog = (transcript?: string) => {
    if (!transcript) return <span className="text-muted-foreground">Tiada transkrip</span>;
    
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Lihat
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Transkrip Panggilan</DialogTitle>
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
    if (!summary) return <span className="text-muted-foreground">Tiada ringkasan</span>;
    
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Lihat
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ringkasan AI</DialogTitle>
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
                <CardTitle>{campaign.campaign_name}</CardTitle>
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
                {campaign?.total_numbers !== stats.totalCalls && (
                  <p className="text-xs text-muted-foreground">
                    Expected: {campaign?.total_numbers}
                  </p>
                )}
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
      <StageAnalytics 
        callLogs={callLogs || []} 
        isLoading={callLogsLoading} 
      />

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

      {/* Call Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Log Panggilan Detail</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              Jumlah Kos VAPI: <span>${costBreakdown.totalCost.toFixed(4)} USD</span>
            </div>
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span>VAPI: ${costBreakdown.vapiCost.toFixed(4)}</span>
              <span>Twilio: ${costBreakdown.twilioCost.toFixed(4)} (not included in total)</span>
            </div>
          </div>
          {callLogsLoading ? (
            <div className="text-center py-8">
              <p>Memuat log panggilan...</p>
            </div>
          ) : !callLogs || callLogs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Tiada log panggilan dijumpai untuk kempen ini.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Customer</TableHead>
                  <TableHead>No. Telefon</TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                    >
                      Status
                    </Button>
                  </TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                    >
                      Durasi
                    </Button>
                  </TableHead>
                  <TableHead>Rakaman</TableHead>
                  <TableHead>Transkrip</TableHead>
                  <TableHead>Ringkasan AI</TableHead>
                  <TableHead>Kos</TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                    >
                      Masa Mula
                    </Button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {callLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">
                      {(log as any).contacts?.name || '-'}
                    </TableCell>
                    <TableCell className="font-medium">
                      {log.phone_number || log.caller_number}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={log.status} type="call" />
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium text-primary">
                        {log.stage_reached || (log.metadata as any)?.stage_reached || '-'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {log.duration ? `${Math.floor(log.duration / 60)}m ${log.duration % 60}s` : '-'}
                    </TableCell>
                    <TableCell>
                      {renderRecordingButton(log)}
                    </TableCell>
                    <TableCell>
                      {renderTranscriptDialog((log.metadata as any)?.transcript)}
                    </TableCell>
                    <TableCell>
                      {renderSummaryDialog((log.metadata as any)?.summary)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            ${((log.metadata as any)?.vapi_cost || 0 + (log.metadata as any)?.twilio_cost || 0).toFixed(4)}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          <span className="text-blue-600">V: ${((log.metadata as any)?.vapi_cost || 0).toFixed(4)}</span>
                          {" | "}
                          <span className="text-green-600">T: ${((log.metadata as any)?.twilio_cost || 0).toFixed(4)}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {log.start_time ? new Date(log.start_time).toLocaleString('ms-MY') : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}