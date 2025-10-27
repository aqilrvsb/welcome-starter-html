import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, CheckCircle, XCircle, PhoneCall, AlertCircle } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { isCallSuccessful, isCallFailed } from "@/lib/statusUtils";
import { useMemo } from "react";
import { CallLogsTable } from "@/components/call-logs/CallLogsTable";
import { motion } from "framer-motion";

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
        answeredCalls: 0,
        unansweredCalls: 0,
        voicemailFailedCalls: 0,
        answeredPercent: '0.0',
        unansweredPercent: '0.0',
        voicemailFailedPercent: '0.0'
      };
    }

    const totalCalls = callLogs.length;
    const answeredCalls = callLogs.filter(log => log.status === 'answered').length;
    const unansweredCalls = callLogs.filter(log => log.status === 'no_answered').length;
    const voicemailCalls = callLogs.filter(log => log.status === 'voicemail').length;
    const failedCalls = callLogs.filter(log => log.status === 'failed').length;
    const voicemailFailedCalls = voicemailCalls + failedCalls;

    const answeredPercent = totalCalls > 0 ? ((answeredCalls / totalCalls) * 100).toFixed(1) : '0.0';
    const unansweredPercent = totalCalls > 0 ? ((unansweredCalls / totalCalls) * 100).toFixed(1) : '0.0';
    const voicemailFailedPercent = totalCalls > 0 ? ((voicemailFailedCalls / totalCalls) * 100).toFixed(1) : '0.0';

    return {
      totalCalls,
      answeredCalls,
      unansweredCalls,
      voicemailFailedCalls,
      answeredPercent,
      unansweredPercent,
      voicemailFailedPercent
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

      {/* Statistics - Dashboard Style */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div
          whileHover={{ scale: 1.02, y: -4 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="card-soft border-primary/20 transition-smooth hover:border-primary/40">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
              <div className="p-2 rounded-lg bg-blue-500/10">
                <PhoneCall className="h-4 w-4 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{stats.totalCalls}</div>
              <p className="text-xs text-muted-foreground mt-1">Filtered by date</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02, y: -4 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="card-soft border-success/20 transition-smooth hover:border-success/40">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Answered</CardTitle>
              <div className="p-2 rounded-lg bg-success/10">
                <CheckCircle className="h-4 w-4 text-success" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success">{stats.answeredCalls}</div>
              <p className="text-xs text-muted-foreground mt-1">{stats.answeredPercent}% of total</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02, y: -4 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="card-soft border-orange-200 transition-smooth hover:border-orange-400">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unanswered</CardTitle>
              <div className="p-2 rounded-lg bg-orange-500/10">
                <AlertCircle className="h-4 w-4 text-orange-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">{stats.unansweredCalls}</div>
              <p className="text-xs text-muted-foreground mt-1">{stats.unansweredPercent}% of total</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02, y: -4 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="card-soft border-destructive/20 transition-smooth hover:border-destructive/40">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Voicemail/Failed</CardTitle>
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertCircle className="h-4 w-4 text-destructive" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-destructive">{stats.voicemailFailedCalls}</div>
              <p className="text-xs text-muted-foreground mt-1">{stats.voicemailFailedPercent}% of total</p>
            </CardContent>
          </Card>
        </motion.div>
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