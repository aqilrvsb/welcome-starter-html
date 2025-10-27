import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, CheckCircle, XCircle, Users } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { isCallSuccessful, isCallFailed } from "@/lib/statusUtils";
import { useMemo } from "react";
import { CallLogsTable } from "@/components/call-logs/CallLogsTable";

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