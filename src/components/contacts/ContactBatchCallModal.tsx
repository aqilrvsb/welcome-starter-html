import React, { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Phone, Users, Zap, HelpCircle, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useBatchCall } from "@/hooks/useBatchCall";
import { useQuery } from "@tanstack/react-query";
import { useCustomAuth } from "@/contexts/CustomAuthContext";

interface Contact {
  id: string;
  name: string;
  phone_number: string;
}

interface ContactWithNumber {
  phone_number: string;
  customer_name: string;
}

interface ContactBatchCallModalProps {
  open: boolean;
  onClose: () => void;
  selectedContacts: string[];
  userId: string;
  onSuccess: () => void;
}

export function ContactBatchCallModal({ 
  open, 
  onClose, 
  selectedContacts, 
  userId, 
  onSuccess 
}: ContactBatchCallModalProps) {
  const [contacts, setContacts] = React.useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = React.useState(false);
  const [campaignMode, setCampaignMode] = React.useState<'none' | 'new' | 'existing'>('none');
  const { user } = useCustomAuth();

  // Fetch concurrent call limit based on account type
  const { data: callLimitData } = useQuery({
    queryKey: ["call-limit", user?.id],
    queryFn: async () => {
      if (!user) return null;

      // Get user account type
      const { data: userData } = await supabase
        .from('users')
        .select('account_type')
        .eq('id', user.id)
        .single();

      const accountType = userData?.account_type || 'trial';

      // Get the appropriate limit from system settings
      const settingKey = accountType === 'pro' ? 'pro_max_concurrent_calls' : 'max_concurrent_calls';
      const { data: setting } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', settingKey)
        .single();

      return {
        maxConcurrentCalls: setting ? parseInt(setting.setting_value) : (accountType === 'pro' ? 10 : 3),
        accountType
      };
    },
    enabled: !!user && open,
  });

  // Fetch existing campaigns for dropdown
  const { data: existingCampaigns, isLoading: campaignsLoading } = useQuery({
    queryKey: ["campaigns-list", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('campaigns')
        .select('id, campaign_name, total_numbers, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user && open,
  });

  // Get selected contacts with phone numbers and names
  const selectedContactsData: ContactWithNumber[] = contacts
    .filter(contact => selectedContacts.includes(contact.id))
    .map(contact => ({
      phone_number: contact.phone_number,
      customer_name: contact.name
    }));

  const selectedPhoneNumbers = selectedContactsData.map(c => c.phone_number);

  // Use the shared batch call logic
  const {
    form,
    prompts,
    promptsLoading,
    validNumbers,
    invalidNumbers,
    isSubmitting,
    batchCallMutation,
    onSubmit,
  } = useBatchCall({
    predefinedNumbers: selectedPhoneNumbers,
    contactsData: selectedContactsData,
    onSuccess: (response) => {
      onSuccess();
      onClose();
    },
    onError: (error) => {
      // Error is already handled by the hook
    }
  });

  // Fetch selected contacts details
  const fetchSelectedContacts = async () => {
    if (selectedContacts.length === 0 || !open) return;
    
    setLoadingContacts(true);
    try {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .in("id", selectedContacts)
        .eq("user_id", userId);

      if (error) {
        console.error("Error fetching contacts:", error);
        return;
      }

      setContacts(data || []);
    } catch (error) {
      console.error("Error fetching contacts:", error);
    } finally {
      setLoadingContacts(false);
    }
  };

  useEffect(() => {
    fetchSelectedContacts();
  }, [open, selectedContacts, userId]);

  // Don't auto-generate campaign name - let user decide
  // If empty, calls will only appear in Call Logs (no campaign created)

  const handleClose = () => {
    form.reset();
    setCampaignMode('none');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Create Batch Call Campaign
          </DialogTitle>
        </DialogHeader>
        
        <TooltipProvider>
          <div className="py-4 space-y-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {/* Campaign Selection with 3 Options */}
                <Card className="bg-muted/30">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      Kempen (Optional)
                      <Tooltip>
                        <TooltipTrigger>
                          <HelpCircle className="h-4 w-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Pilih sama ada nak cipta kempen baru, guna kempen sedia ada, atau tanpa kempen</p>
                        </TooltipContent>
                      </Tooltip>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <RadioGroup value={campaignMode} onValueChange={(value: any) => {
                      setCampaignMode(value);
                      if (value === 'none') {
                        form.setValue('campaignName', '');
                        form.setValue('existingCampaignId', undefined);
                      } else if (value === 'existing') {
                        form.setValue('campaignName', '');
                        form.setValue('existingCampaignId', undefined);
                      } else if (value === 'new') {
                        form.setValue('campaignName', '');
                        form.setValue('existingCampaignId', undefined);
                      }
                    }}>
                      {/* Option 1: No Campaign */}
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="none" id="none" />
                        <Label htmlFor="none" className="font-normal cursor-pointer">
                          Tanpa Kempen (Call logs sahaja)
                        </Label>
                      </div>

                      {/* Option 2: Create New Campaign */}
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="new" id="new" />
                          <Label htmlFor="new" className="font-normal cursor-pointer">
                            Cipta Kempen Baru
                          </Label>
                        </div>
                        {campaignMode === 'new' && (
                          <div className="ml-6">
                            <FormField
                              control={form.control}
                              name="campaignName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input
                                      placeholder="Contoh: Panggilan Promo VTEC Sept 2025"
                                      {...field}
                                      onChange={async (e) => {
                                        field.onChange(e);
                                        if (e.target.value.trim()) {
                                          const exists = existingCampaigns?.some(
                                            c => c.campaign_name.toLowerCase() === e.target.value.toLowerCase()
                                          );
                                          if (exists) {
                                            form.setError('campaignName', {
                                              message: '⚠️ Nama kempen ini sudah wujud. Sila guna nama lain atau pilih "Guna Kempen Sedia Ada"'
                                            });
                                          } else {
                                            form.clearErrors('campaignName');
                                          }
                                        }
                                      }}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        )}
                      </div>

                      {/* Option 3: Use Existing Campaign */}
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="existing" id="existing" />
                          <Label htmlFor="existing" className="font-normal cursor-pointer">
                            Guna Kempen Sedia Ada
                          </Label>
                        </div>
                        {campaignMode === 'existing' && (
                          <div className="ml-6">
                            <FormField
                              control={form.control}
                              name="existingCampaignId"
                              render={({ field }) => (
                                <FormItem>
                                  <Select
                                    onValueChange={(value) => {
                                      field.onChange(value);
                                      // Don't set campaignName - backend will use existingCampaignId
                                      // Clear campaignName to ensure backend uses existingCampaignId
                                      form.setValue('campaignName', '');
                                    }}
                                    value={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Pilih kempen sedia ada" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {campaignsLoading ? (
                                        <SelectItem value="loading" disabled>
                                          Memuat kempen...
                                        </SelectItem>
                                      ) : existingCampaigns?.length === 0 ? (
                                        <SelectItem value="no-campaigns" disabled>
                                          Tiada kempen dijumpai. Cipta kempen baru.
                                        </SelectItem>
                                      ) : (
                                        existingCampaigns?.map((campaign) => (
                                          <SelectItem key={campaign.id} value={campaign.id}>
                                            {campaign.campaign_name} ({campaign.total_numbers} calls)
                                          </SelectItem>
                                        ))
                                      )}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        )}
                      </div>
                    </RadioGroup>
                  </CardContent>
                </Card>

                <FormField
                  control={form.control}
                  name="promptId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        Pilih Skrip Prompt
                        <Tooltip>
                          <TooltipTrigger>
                            <HelpCircle className="h-4 w-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>AI akan menggunakan skrip ini untuk semua panggilan</p>
                          </TooltipContent>
                        </Tooltip>
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={promptsLoading ? "Loading prompts..." : "Select a prompt"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {promptsLoading ? (
                            <SelectItem value="loading" disabled>
                              Loading prompts...
                            </SelectItem>
                          ) : prompts?.length === 0 ? (
                            <SelectItem value="no-prompts" disabled>
                              No prompts found. Create prompts first.
                            </SelectItem>
                          ) : (
                            prompts?.map((prompt) => (
                              <SelectItem key={prompt.id} value={prompt.id}>
                                {prompt.prompt_name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Auto Retry Configuration - Hidden */}
                {/* <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <RefreshCw className="h-4 w-4" />
                      Auto Retry Configuration
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="retryEnabled"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between space-y-0">
                          <div className="space-y-0.5">
                            <FormLabel>Enable Auto Retry</FormLabel>
                            <div className="text-sm text-muted-foreground">
                              Automatically call back numbers that didn't answer
                            </div>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    {form.watch("retryEnabled") && (
                      <>
                        <FormField
                          control={form.control}
                          name="retryIntervalMinutes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-2">
                                Retry Interval (Minutes)
                                <Tooltip>
                                  <TooltipTrigger>
                                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Berapa minit nak tunggu sebelum call balik (5-1440 minit)</p>
                                  </TooltipContent>
                                </Tooltip>
                              </FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  min={5}
                                  max={1440}
                                  placeholder="30"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="maxRetryAttempts"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-2">
                                Max Retry Attempts
                                <Tooltip>
                                  <TooltipTrigger>
                                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Berapa kali nak cuba call balik (1-10 kali)</p>
                                  </TooltipContent>
                                </Tooltip>
                              </FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  min={1}
                                  max={10}
                                  placeholder="3"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}
                  </CardContent>
                </Card> */}

                {/* Selected Contacts Preview */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Selected Contacts ({selectedContacts.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loadingContacts ? (
                      <div className="text-sm text-muted-foreground">Loading contacts...</div>
                    ) : (
                      <div className="space-y-2">
                        {contacts.slice(0, 5).map((contact) => (
                          <div key={contact.id} className="flex justify-between text-sm p-2 bg-muted/50 rounded">
                            <span>{contact.name}</span>
                            <span className="text-muted-foreground">{contact.phone_number}</span>
                          </div>
                        ))}
                        {contacts.length > 5 && (
                          <div className="text-sm text-muted-foreground text-center">
                            ... and {contacts.length - 5} more contacts
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Concurrent Call Limit Warning */}
                {callLimitData && validNumbers.length > 0 && (
                  <Card className={validNumbers.length > callLimitData.maxConcurrentCalls ? "border-destructive" : "border-green-500"}>
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        {validNumbers.length > callLimitData.maxConcurrentCalls ? (
                          <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                        ) : (
                          <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-1">
                          <p className={`text-sm font-medium ${validNumbers.length > callLimitData.maxConcurrentCalls ? "text-destructive" : "text-green-600"}`}>
                            {validNumbers.length > callLimitData.maxConcurrentCalls
                              ? `⚠️ Concurrent Call Limit Exceeded!`
                              : `✓ Within Call Limit`
                            }
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Your {callLimitData.accountType === 'pro' ? 'Pro' : 'Trial'} account allows maximum <strong>{callLimitData.maxConcurrentCalls} concurrent calls</strong>.
                            {validNumbers.length > callLimitData.maxConcurrentCalls && (
                              <> You selected <strong>{validNumbers.length} contacts</strong>. Please reduce by {validNumbers.length - callLimitData.maxConcurrentCalls} contacts.</>
                            )}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="flex justify-end space-x-2 pt-4">
                  <Button variant="outline" onClick={handleClose} type="button">
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={
                      isSubmitting || 
                      batchCallMutation.isPending || 
                      !prompts || 
                      prompts.length === 0 || 
                      validNumbers.length === 0 || 
                      invalidNumbers.length > 0
                    }
                  >
                    {isSubmitting || batchCallMutation.isPending 
                      ? "Creating Campaign..." 
                      : `Start Batch Call (${validNumbers.length} numbers)`
                    }
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </TooltipProvider>
      </DialogContent>
    </Dialog>
  );
}