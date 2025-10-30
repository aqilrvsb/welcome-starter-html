import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
  Edit,
  Pause,
  Play,
  Trash2
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
}

export function CampaignActions({ campaign }: CampaignActionsProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

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

  const canPause = campaign.status === 'in_progress';
  const canResume = campaign.status === 'paused';
  const canEdit = campaign.status === 'pending' || campaign.status === 'paused';

  return (
    <>
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