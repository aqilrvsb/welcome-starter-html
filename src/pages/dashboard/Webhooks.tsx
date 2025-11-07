import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCustomAuth } from "@/contexts/CustomAuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Webhook, Copy, Trash2, BarChart3, Eye, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Webhook {
  id: string;
  webhook_name: string;
  webhook_type: "lead_only" | "lead_and_call";
  webhook_token: string;
  webhook_url: string;
  default_prompt_name: string | null;
  default_campaign_name: string | null;
  is_active: boolean;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  last_request_at: string | null;
  created_at: string;
}

interface WebhookLog {
  id: string;
  request_payload: any;
  response_status: "success" | "error";
  contact_id: string | null;
  call_id: string | null;
  error_message: string | null;
  processing_time_ms: number;
  ip_address: string;
  created_at: string;
}

export default function Webhooks() {
  const { user } = useCustomAuth();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedWebhookId, setSelectedWebhookId] = useState<string | null>(null);

  // Form state
  const [webhookName, setWebhookName] = useState("");
  const [webhookType, setWebhookType] = useState<"lead_only" | "lead_and_call">("lead_only");
  const [defaultPromptName, setDefaultPromptName] = useState("");
  const [defaultCampaignName, setDefaultCampaignName] = useState("");

  // Fetch webhooks
  const { data: webhooks, isLoading: isLoadingWebhooks } = useQuery({
    queryKey: ["webhooks", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("webhooks")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Webhook[];
    },
    enabled: !!user,
  });

  // Fetch webhook logs for selected webhook
  const { data: logs, isLoading: isLoadingLogs } = useQuery({
    queryKey: ["webhook_logs", selectedWebhookId],
    queryFn: async () => {
      if (!selectedWebhookId) return [];
      const { data, error } = await supabase
        .from("webhook_logs")
        .select("*")
        .eq("webhook_id", selectedWebhookId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as WebhookLog[];
    },
    enabled: !!selectedWebhookId,
  });

  // Fetch prompts for dropdown
  const { data: prompts } = useQuery({
    queryKey: ["prompts", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("prompts")
        .select("prompt_name")
        .eq("user_id", user.id)
        .order("prompt_name");

      if (error) throw error;
      return data.map((p) => p.prompt_name);
    },
    enabled: !!user,
  });

  // Fetch campaigns for dropdown
  const { data: campaigns } = useQuery({
    queryKey: ["campaigns", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("campaigns")
        .select("campaign_name")
        .eq("user_id", user.id)
        .order("campaign_name");

      if (error) throw error;
      return data.map((c) => c.campaign_name);
    },
    enabled: !!user,
  });

  // Create webhook mutation
  const createWebhook = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("User not authenticated");

      // Check if user already has a webhook (limit: 1 per user)
      if (webhooks && webhooks.length >= 1) {
        throw new Error("WEBHOOK_LIMIT_REACHED");
      }

      const { data, error } = await supabase
        .from("webhooks")
        .insert({
          user_id: user.id,
          webhook_name: webhookName,
          webhook_type: webhookType,
          default_prompt_name: webhookType === "lead_and_call" ? defaultPromptName : null,
          default_campaign_name: defaultCampaignName || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      toast.success("✅ Webhook dibuat berjaya!");
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      if (error.message === "WEBHOOK_LIMIT_REACHED") {
        toast.error("❌ Had webhook tercapai! Anda hanya boleh mempunyai 1 webhook sahaja.");
      } else if (error.message?.includes("webhooks_user_id_webhook_name_unique") ||
          error.message?.includes("duplicate key")) {
        toast.error("❌ Nama webhook sudah wujud! Sila gunakan nama yang berbeza.");
      } else {
        toast.error("❌ Gagal membuat webhook: " + error.message);
      }
    },
  });

  // Delete webhook mutation
  const deleteWebhook = useMutation({
    mutationFn: async (webhookId: string) => {
      const { error } = await supabase
        .from("webhooks")
        .delete()
        .eq("id", webhookId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      toast.success("✅ Webhook dipadam berjaya!");
    },
    onError: (error: any) => {
      toast.error("❌ Gagal memadam webhook: " + error.message);
    },
  });

  // Toggle active status mutation
  const toggleWebhook = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("webhooks")
        .update({ is_active: !isActive })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      toast.success("✅ Status webhook dikemaskini!");
    },
    onError: (error: any) => {
      toast.error("❌ Gagal mengemas kini status: " + error.message);
    },
  });

  const resetForm = () => {
    setWebhookName("");
    setWebhookType("lead_only");
    setDefaultPromptName("");
    setDefaultCampaignName("");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("✅ Disalin ke clipboard!");
  };

  if (isLoadingWebhooks) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Webhook className="h-8 w-8" />
            Webhooks
          </h1>
          <p className="text-muted-foreground mt-2">
            Integrasikan sistem anda dengan webhook untuk lead dan auto-call
          </p>
        </div>
        {(!webhooks || webhooks.length === 0) && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2">
                <Plus className="h-5 w-5" />
                Cipta Webhook
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Cipta Webhook Baru</DialogTitle>
              <DialogDescription>
                Webhooks membolehkan integrasi sistem luar untuk membuat lead dan auto-call
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="webhook-name">Nama Webhook</Label>
                <Input
                  id="webhook-name"
                  placeholder="contoh: Website Form"
                  value={webhookName}
                  onChange={(e) => setWebhookName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="webhook-type">Jenis Webhook</Label>
                <Select value={webhookType} onValueChange={(value: any) => setWebhookType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead_only">Lead Sahaja</SelectItem>
                    <SelectItem value="lead_and_call">Lead + Auto Call</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {webhookType === "lead_and_call" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="default-prompt">Default Prompt (diperlukan)</Label>
                    <Select value={defaultPromptName} onValueChange={setDefaultPromptName}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih prompt" />
                      </SelectTrigger>
                      <SelectContent>
                        {prompts?.map((promptName) => (
                          <SelectItem key={promptName} value={promptName}>
                            {promptName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="default-campaign">Default Campaign (pilihan)</Label>
                    <Select value={defaultCampaignName} onValueChange={setDefaultCampaignName}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih campaign" />
                      </SelectTrigger>
                      <SelectContent>
                        {campaigns?.map((campaignName) => (
                          <SelectItem key={campaignName} value={campaignName}>
                            {campaignName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Batal
              </Button>
              <Button
                onClick={() => createWebhook.mutate()}
                disabled={!webhookName || (webhookType === "lead_and_call" && !defaultPromptName)}
              >
                Cipta Webhook
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        )}
      </div>

      {/* Webhooks Grid */}
      {webhooks && webhooks.length > 0 ? (
        <div className="grid gap-6">
          {webhooks.map((webhook) => (
            <Card key={webhook.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {webhook.webhook_name}
                      <Badge variant={webhook.is_active ? "default" : "secondary"}>
                        {webhook.is_active ? "Aktif" : "Tidak Aktif"}
                      </Badge>
                      <Badge variant="outline">
                        {webhook.webhook_type === "lead_only" ? "Lead Sahaja" : "Lead + Call"}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="mt-2">
                      Dibuat: {new Date(webhook.created_at).toLocaleDateString("ms-MY")}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        toggleWebhook.mutate({ id: webhook.id, isActive: webhook.is_active })
                      }
                    >
                      {webhook.is_active ? "Nyahaktif" : "Aktifkan"}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        if (confirm("Adakah anda pasti mahu memadam webhook ini?")) {
                          deleteWebhook.mutate(webhook.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Webhook URL */}
                <div>
                  <Label className="text-xs text-muted-foreground">Webhook URL</Label>
                  <div className="flex gap-2 mt-1">
                    <Input value={webhook.webhook_url} readOnly className="font-mono text-sm" />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(webhook.webhook_url)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Configuration */}
                <div className="grid grid-cols-2 gap-4">
                  {webhook.default_prompt_name && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Default Prompt</Label>
                      <p className="font-medium mt-1">{webhook.default_prompt_name}</p>
                    </div>
                  )}
                  {webhook.default_campaign_name && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Default Campaign</Label>
                      <p className="font-medium mt-1">{webhook.default_campaign_name}</p>
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-4 pt-4 border-t">
                  <div>
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <BarChart3 className="h-3 w-3" />
                      Total
                    </Label>
                    <p className="text-2xl font-bold">{webhook.total_requests}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-green-600">Berjaya</Label>
                    <p className="text-2xl font-bold text-green-600">{webhook.successful_requests}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-red-600">Gagal</Label>
                    <p className="text-2xl font-bold text-red-600">{webhook.failed_requests}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Terakhir</Label>
                    <p className="text-sm font-medium">
                      {webhook.last_request_at
                        ? new Date(webhook.last_request_at).toLocaleString("ms-MY")
                        : "-"}
                    </p>
                  </div>
                </div>

                {/* View Logs */}
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setSelectedWebhookId(webhook.id)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Lihat Logs
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Webhook Logs: {webhook.webhook_name}</DialogTitle>
                      <DialogDescription>
                        50 request terkini untuk webhook ini
                      </DialogDescription>
                    </DialogHeader>

                    {isLoadingLogs ? (
                      <div className="flex items-center justify-center h-32">
                        <RefreshCw className="h-6 w-6 animate-spin" />
                      </div>
                    ) : logs && logs.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Status</TableHead>
                            <TableHead>Masa</TableHead>
                            <TableHead>Payload</TableHead>
                            <TableHead>Contact ID</TableHead>
                            <TableHead>Processing</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {logs.map((log) => (
                            <TableRow key={log.id}>
                              <TableCell>
                                <Badge variant={log.response_status === "success" ? "default" : "destructive"}>
                                  {log.response_status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs">
                                {new Date(log.created_at).toLocaleString("ms-MY")}
                              </TableCell>
                              <TableCell>
                                <code className="text-xs bg-muted px-2 py-1 rounded">
                                  {JSON.stringify(log.request_payload).substring(0, 50)}...
                                </code>
                              </TableCell>
                              <TableCell className="text-xs font-mono">
                                {log.contact_id ? log.contact_id.substring(0, 8) : "-"}
                              </TableCell>
                              <TableCell className="text-xs">
                                {log.processing_time_ms}ms
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        Tiada logs lagi
                      </div>
                    )}
                  </DialogContent>
                </Dialog>

                {/* Example Payload */}
                <div className="bg-muted p-4 rounded-lg">
                  <Label className="text-xs text-muted-foreground mb-2 block">
                    Contoh Request (cURL):
                  </Label>
                  <pre className="text-xs overflow-x-auto">
                    <code>
{`curl -X POST ${webhook.webhook_url} \\
  -H "Content-Type: application/json" \\
  -d '{
  "name": "Ahmad Ali",
  "phone_number": "+60123456789"${webhook.webhook_type === "lead_and_call" ? `,
  "prompt_name": "${webhook.default_prompt_name || 'optional'}"` : ""}
}'`}
                    </code>
                  </pre>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <Webhook className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Tiada Webhook Lagi</h3>
            <p className="text-muted-foreground mb-6">
              Cipta webhook pertama anda untuk mula mengintegrasikan sistem luar
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-5 w-5 mr-2" />
              Cipta Webhook
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
