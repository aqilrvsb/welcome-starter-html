import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { canMakeCalls } from "@/lib/billing";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  MoreHorizontal, 
  Copy, 
  Edit, 
  Pause, 
  Play, 
  Trash2, 
  Download,
  Calendar,
  RotateCcw
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface CampaignActionsProps {
  campaign: {
    id: string;
    campaign_name: string;
    status: string;
    prompt_id: string;
  };
  onEdit?: () => void;
}

export function CampaignActions({ campaign, onEdit }: CampaignActionsProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRepeatDialog, setShowRepeatDialog] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const duplicateMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('campaigns')
        .insert([{
          campaign_name: `${campaign.campaign_name} (Copy)`,
          prompt_id: campaign.prompt_id,
          status: 'pending',
          user_id: (await supabase.auth.getUser()).data.user?.id
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success("Campaign successfully duplicated");
    },
    onError: (error: any) => {
      toast.error("Failed to duplicate campaign: " + error.message);
    },
  });

  const pauseResumeMutation = useMutation({
    mutationFn: async (action: 'pause' | 'resume') => {
      const newStatus = action === 'pause' ? 'paused' : 'in_progress';
      const { error } = await supabase
        .from('campaigns')
        .update({ status: newStatus })
        .eq('id', campaign.id);

      if (error) throw error;
    },
    onSuccess: (_, action) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success(`Campaign ${action === 'pause' ? 'paused' : 'resumed'} successfully`);
    },
    onError: (error: any) => {
      toast.error("Action failed: " + error.message);
    },
  });

  const repeatMutation = useMutation({
    mutationFn: async () => {
      // Check user authentication
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) {
        throw new Error("User not authenticated");
      }

      // NOTE: Credits check is done in batch-call-v2 edge function
      // No trial subscription check needed - using credits-based billing

      // Get phone numbers from call logs of this campaign
      const { data: callLogs, error: callLogsError } = await supabase
        .from('call_logs')
        .select('phone_number')
        .eq('campaign_id', campaign.id)
        .order('created_at', { ascending: false});

      if (callLogsError) throw callLogsError;

      if (!callLogs || callLogs.length === 0) {
        throw new Error("No phone numbers found for this campaign");
      }

      const phoneNumbers = callLogs.map(log => log.phone_number).filter(Boolean);

      if (phoneNumbers.length === 0) {
        throw new Error("No valid phone numbers found");
      }

      // Call the batch-call-v2 edge function (credits-based billing)
      const { data: response, error } = await supabase.functions.invoke('batch-call-v2', {
        body: {
          userId: user.id, // Required for batch-call-v2
          campaignName: `${campaign.campaign_name} (Repeat)`,
          promptId: campaign.prompt_id,
          phoneNumbers: phoneNumbers,
        }
      });

      if (error) throw error;
      return response;
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success(`🎉 Campaign repeated successfully! 
        ✅ Successful: ${response.summary.successful_calls}, 
        ❌ Failed: ${response.summary.failed_calls}`);
      setShowRepeatDialog(false);
    },
    onError: (error: any) => {
      toast.error("Failed to repeat campaign: " + error.message);
      setShowRepeatDialog(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      // First delete related call logs
      await supabase
        .from('call_logs')
        .delete()
        .eq('campaign_id', campaign.id);

      // Then delete the campaign
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', campaign.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success("Campaign deleted successfully");
      setShowDeleteDialog(false);
    },
    onError: (error: any) => {
      toast.error("Failed to delete campaign: " + error.message);
    },
  });

  const handleExport = async () => {
    try {
      const { data: callLogs } = await supabase
        .from('call_logs')
        .select('*')
        .eq('campaign_id', campaign.id);

      if (!callLogs || callLogs.length === 0) {
        toast.error("No call logs to export");
        return;
      }

      // Create CSV content
      const headers = ['Phone Number', 'Status', 'Duration (seconds)', 'Start Time', 'End Time', 'Cost'];
      const csvContent = [
        headers.join(','),
        ...callLogs.map(log => [
          log.phone_number || log.caller_number || '',
          log.status || '',
          log.duration || '',
          log.start_time || '',
          log.created_at || '', // Use created_at instead of end_time
          (log.metadata as any)?.call_cost || ''
        ].join(','))
      ].join('\n');

      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${campaign.campaign_name}-call-logs.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast.success("Call logs exported successfully");
    } catch (error: any) {
      toast.error("Export failed: " + error.message);
    }
  };

  const canPause = campaign.status === 'in_progress';
  const canResume = campaign.status === 'paused';
  const canEdit = campaign.status === 'pending' || campaign.status === 'paused';

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowRepeatDialog(true)}
        disabled={repeatMutation.isPending}
        className="mr-2"
      >
        <RotateCcw className="h-4 w-4 mr-2" />
        {repeatMutation.isPending ? "Repeating..." : "Repeat"}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => navigate(`/campaigns/${campaign.id}/edit`)} disabled={!canEdit}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Campaign
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => duplicateMutation.mutate()}>
            <Copy className="h-4 w-4 mr-2" />
            Duplicate
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {canPause && (
            <DropdownMenuItem onClick={() => pauseResumeMutation.mutate('pause')}>
              <Pause className="h-4 w-4 mr-2" />
              Pause Campaign
            </DropdownMenuItem>
          )}

          {canResume && (
            <DropdownMenuItem onClick={() => pauseResumeMutation.mutate('resume')}>
              <Play className="h-4 w-4 mr-2" />
              Resume Campaign
            </DropdownMenuItem>
          )}

          <DropdownMenuItem onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export Logs
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem 
            onClick={() => setShowDeleteDialog(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Campaign
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showRepeatDialog} onOpenChange={setShowRepeatDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Repeat Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to repeat the campaign "{campaign.campaign_name}"? 
              This will create a new campaign with the same phone numbers and prompt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => repeatMutation.mutate()}
              disabled={repeatMutation.isPending}
            >
              {repeatMutation.isPending ? "Repeating..." : "Yes, Repeat"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{campaign.campaign_name}"? 
              This action cannot be undone and will also delete all related call logs.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive hover:bg-destructive/80"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}