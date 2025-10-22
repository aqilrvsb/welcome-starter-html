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
import { Phone, Users, Zap, HelpCircle, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useBatchCall } from "@/hooks/useBatchCall";

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

  // Auto-generate campaign name based on selected contacts
  useEffect(() => {
    if (contacts.length > 0 && !form.getValues('campaignName')) {
      const campaignName = `Batch Call - ${contacts.length} Contacts - ${new Date().toLocaleDateString()}`;
      form.setValue('campaignName', campaignName);
    }
  }, [contacts, form]);

  const handleClose = () => {
    form.reset();
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
                <FormField
                  control={form.control}
                  name="campaignName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        Nama Kempen (Campaign Name)
                        <Tooltip>
                          <TooltipTrigger>
                            <HelpCircle className="h-4 w-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Berikan nama yang mudah diingat untuk kempen anda</p>
                          </TooltipContent>
                        </Tooltip>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="Enter campaign name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
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