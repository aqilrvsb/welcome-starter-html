import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCustomAuth } from "@/contexts/CustomAuthContext";
import { useDynamicPricing } from "@/hooks/useDynamicPricing";
import { toast } from "sonner";
import { canMakeCalls } from "@/lib/billing";
import Swal from 'sweetalert2';

const batchCallSchema = z.object({
  campaignName: z.string().optional(), // Optional: If empty, calls will only appear in Call Logs
  existingCampaignId: z.string().optional(), // ID of existing campaign if selected
  promptId: z.string().min(1, "Sila pilih prompt"),
  phoneNumbers: z.string().min(1, "Senarai nombor telefon diperlukan"),
  retryEnabled: z.boolean().default(false),
  retryIntervalMinutes: z.number().min(5).max(1440).default(30),
  maxRetryAttempts: z.number().min(1).max(10).default(3),
});

type BatchCallFormData = z.infer<typeof batchCallSchema>;

interface ContactWithNumber {
  phone_number: string;
  customer_name: string;
}

interface UseBatchCallOptions {
  onSuccess?: (response: any) => void;
  onError?: (error: any) => void;
  predefinedNumbers?: string[];
  contactsData?: ContactWithNumber[];
}

export function useBatchCall(options: UseBatchCallOptions = {}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastCampaign, setLastCampaign] = useState<any>(null);
  const [validNumbers, setValidNumbers] = useState<string[]>([]);
  const [invalidNumbers, setInvalidNumbers] = useState<string[]>([]);
  const [contactsMap, setContactsMap] = useState<Map<string, string>>(new Map());
  const { user } = useCustomAuth();
  const { pricingPerMinute } = useDynamicPricing();

  const form = useForm<BatchCallFormData>({
    resolver: zodResolver(batchCallSchema),
    defaultValues: {
      campaignName: "",
      existingCampaignId: undefined,
      promptId: "",
      phoneNumbers: "",
      retryEnabled: false,
      retryIntervalMinutes: 30,
      maxRetryAttempts: 3,
    },
  });

  // Fetch available prompts
  const { data: prompts, isLoading: promptsLoading } = useQuery({
    queryKey: ["prompts", user?.id],
    queryFn: async () => {
      if (!user) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from('prompts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch last campaign for repeat functionality with call logs
  const { data: lastCampaignData } = useQuery({
    queryKey: ["last-campaign", user?.id],
    queryFn: async () => {
      if (!user) throw new Error("User not authenticated");

      // Get the last campaign
      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .select('id, campaign_name, prompt_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (campaignError) throw campaignError;
      
      if (!campaign?.[0]) return null;

      // Get phone numbers from call logs of the last campaign
      const { data: callLogs, error: callLogsError } = await supabase
        .from('call_logs')
        .select('phone_number')
        .eq('campaign_id', campaign[0].id)
        .order('created_at', { ascending: false });

      if (callLogsError) throw callLogsError;

      const phoneNumbers = callLogs?.map(log => log.phone_number).join('\n') || '';

      return {
        ...campaign[0],
        phoneNumbers
      };
    },
    enabled: !!user,
  });

  // Auto-select first prompt if available
  useEffect(() => {
    if (prompts && prompts.length > 0 && !form.getValues('promptId')) {
      form.setValue('promptId', prompts[0].id);
    }
  }, [prompts, form]);

  // Set predefined numbers and contacts data if provided
  useEffect(() => {
    if (options.predefinedNumbers && options.predefinedNumbers.length > 0) {
      const numbersString = options.predefinedNumbers.join('\n');
      form.setValue('phoneNumbers', numbersString);
    }
    
    // Create a map of phone numbers to customer names
    if (options.contactsData && options.contactsData.length > 0) {
      const map = new Map<string, string>();
      options.contactsData.forEach(contact => {
        map.set(contact.phone_number, contact.customer_name);
      });
      setContactsMap(map);
    }
  }, [options.predefinedNumbers, options.contactsData, form]);

  // Validate phone numbers in real-time
  useEffect(() => {
    const phoneNumbers = form.watch("phoneNumbers");
    if (phoneNumbers) {
      const numbers = phoneNumbers
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      
      const valid: string[] = [];
      const invalid: string[] = [];
      
      numbers.forEach(number => {
        // Basic Malaysian phone number validation
        const cleanNumber = number.replace(/\D/g, '');
        if (cleanNumber.length >= 9 && cleanNumber.length <= 15) {
          valid.push(number);
        } else {
          invalid.push(number);
        }
      });
      
      setValidNumbers(valid);
      setInvalidNumbers(invalid);
    } else {
      setValidNumbers([]);
      setInvalidNumbers([]);
    }
  }, [form.watch("phoneNumbers")]);

  const batchCallMutation = useMutation({
    mutationFn: async (data: BatchCallFormData) => {
      // Check user authentication
      if (!user?.id) {
        throw new Error("User not authenticated");
      }

      // Check balance before creating batch call
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('account_type, trial_balance_minutes, pro_balance_minutes')
        .eq('id', user.id)
        .single();

      if (userError) {
        throw new Error('Failed to fetch user balance');
      }

      const accountType = userData?.account_type || 'trial';
      const estimatedMinutes = validNumbers.length * 2; // Rough estimate: 2 minutes per call

      if (accountType === 'trial') {
        const trialBalance = userData?.trial_balance_minutes || 0;

        if (trialBalance <= 0) {
          throw new Error('Trial balance insufficient. Please switch to Pro Account or top up credits.');
        }

        if (trialBalance < estimatedMinutes) {
          throw new Error(`Trial balance insufficient. You have ${trialBalance.toFixed(1)} minutes remaining but need approximately ${estimatedMinutes} minutes. Please switch to Pro Account or top up credits.`);
        }
      } else if (accountType === 'pro') {
        const proBalance = userData?.pro_balance_minutes || 0;

        if (proBalance <= 0) {
          throw new Error('Pro balance insufficient. Please top up credits to continue.');
        }

        if (proBalance < estimatedMinutes) {
          throw new Error(`Pro balance insufficient. You have ${proBalance.toFixed(1)} minutes but need approximately ${estimatedMinutes} minutes. Please top up credits.`);
        }
      }

      if (validNumbers.length === 0) {
        throw new Error("Tiada nombor telefon yang sah");
      }

      if (invalidNumbers.length > 0) {
        toast.warning(`${invalidNumbers.length} nombor tidak sah akan diabaikan`);
      }

      // Prepare phone numbers with customer names
      const phoneNumbersWithNames = validNumbers.map(phone => ({
        phone_number: phone,
        customer_name: contactsMap.get(phone) || null
      }));

      // 🎯 FRONTEND CAMPAIGN HANDLING: Create or update campaign BEFORE calling backend
      let campaignId: string | null = null;

      if (data.existingCampaignId) {
        // SCENARIO 1: Add to existing campaign
        campaignId = data.existingCampaignId;

        const { data: existingCampaign, error: fetchError } = await supabase
          .from('campaigns')
          .select('*')
          .eq('id', data.existingCampaignId)
          .eq('user_id', user.id)
          .single();

        if (fetchError || !existingCampaign) {
          throw new Error('Existing campaign not found or unauthorized');
        }

        // Update total numbers count
        await supabase
          .from('campaigns')
          .update({
            total_numbers: (existingCampaign.total_numbers || 0) + validNumbers.length,
            status: 'in_progress'
          })
          .eq('id', data.existingCampaignId);

        console.log(`✅ Adding ${validNumbers.length} calls to existing campaign: ${existingCampaign.campaign_name}`);

      } else if (data.campaignName?.trim()) {
        // SCENARIO 2: Create new campaign
        const { data: createdCampaign, error: campaignError } = await supabase
          .from('campaigns')
          .insert({
            user_id: user.id,
            campaign_name: data.campaignName.trim(),
            prompt_id: data.promptId,
            status: 'in_progress',
            total_numbers: validNumbers.length,
          })
          .select()
          .single();

        if (campaignError) {
          console.error('❌ Failed to create campaign:', campaignError);
          throw new Error('Failed to create campaign: ' + campaignError.message);
        }

        campaignId = createdCampaign.id;
        console.log(`✅ Campaign created: ${createdCampaign.campaign_name} (ID: ${campaignId})`);

      } else {
        // SCENARIO 3: No campaign - calls go directly to call_logs
        console.log(`⏭️  No campaign selected - calls will only appear in Call Logs`);
      }

      // 🚀 Call Deno Deploy - backend ONLY makes calls, doesn't handle campaigns
      const DENO_DEPLOY_URL = 'https://sifucall.deno.dev/batch-call';

      const payload = {
        userId: user.id,
        campaignId: campaignId, // Send campaignId (not campaignName!)
        promptId: data.promptId,
        phoneNumbers: validNumbers,
        phoneNumbersWithNames: phoneNumbersWithNames,
        retryEnabled: data.retryEnabled,
        retryIntervalMinutes: data.retryIntervalMinutes,
        maxRetryAttempts: data.maxRetryAttempts,
      };

      console.log('🚀 Sending batch call request to backend:', {
        campaignId: payload.campaignId,
        promptId: payload.promptId,
        phoneCount: payload.phoneNumbers.length
      });

      // Add timeout to prevent hanging (60 seconds max)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      try {
        const response = await fetch(DENO_DEPLOY_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Batch call failed');
        }

        return await response.json();
      } catch (error: any) {
        clearTimeout(timeoutId);

        if (error.name === 'AbortError') {
          throw new Error('Request timeout - batch call may still be processing in background. Please check Call Logs.');
        }
        throw error;
      }
    },
    onSuccess: (response) => {
      toast.success(`🎉 Kempen batch call berjaya dimulakan!
        ✅ Berjaya: ${response.summary?.successful || 0},
        ❌ Gagal: ${response.summary?.failed || 0}`);

      // Save this campaign for repeat functionality
      setLastCampaign({
        campaignName: form.getValues('campaignName'),
        promptId: form.getValues('promptId'),
        phoneNumbers: validNumbers.join('\n')
      });

      form.reset();
      setValidNumbers([]);
      setInvalidNumbers([]);

      // Call custom success handler if provided
      if (options.onSuccess) {
        options.onSuccess(response);
      }
    },
    onError: (error: any) => {
      console.error("Batch call error:", error);

      // Check if it's an insufficient balance error (trial or credits)
      if (error.message && (error.message.includes('balance insufficient') || error.message.includes('Insufficient credits'))) {
        const isTrial = error.message.includes('Trial balance');

        Swal.fire({
          icon: 'warning',
          title: isTrial ? '⏱️ Minit Percubaan Tidak Mencukupi' : '💳 Kredit Tidak Mencukupi',
          html: `
            <div style="text-align: left;">
              <p><strong>${error.message}</strong></p>
              <br/>
              ${isTrial ?
                `<p>Pilihan anda:</p><ul style="padding-left: 20px;"><li>Tukar ke Pro Account (RM${pricingPerMinute.toFixed(2)}/minit)</li><li>Top up kredit untuk teruskan</li></ul>` :
                '<p>Sila top up kredit anda untuk teruskan.</p>'
              }
            </div>
          `,
          confirmButtonText: isTrial ? 'Tukar ke Pro / Top Up' : 'Top Up Kredit',
          showCancelButton: true,
          cancelButtonText: 'Tutup',
          confirmButtonColor: '#10b981',
          customClass: {
            container: 'swal-high-z-index'
          }
        }).then((result) => {
          if (result.isConfirmed) {
            // Redirect to appropriate page
            if (isTrial) {
              // Redirect to settings to switch account type or credits page
              window.location.href = '/settings';
            } else {
              window.location.href = '/credits-topup';
            }
          }
        });
      } else {
        // Show generic error with SweetAlert
        Swal.fire({
          icon: 'error',
          title: 'Gagal Memulakan Kempen',
          text: error.message || 'An error occurred',
          confirmButtonText: 'OK',
          confirmButtonColor: '#ef4444',
          customClass: {
            container: 'swal-high-z-index'
          }
        });
      }

      // Call custom error handler if provided
      if (options.onError) {
        options.onError(error);
      }
    },
  });

  const onSubmit = (data: BatchCallFormData) => {
    if (invalidNumbers.length > 0) {
      toast.error(`Terdapat ${invalidNumbers.length} nombor tidak sah. Sila betulkan sebelum meneruskan.`);
      return;
    }
    setIsSubmitting(true);
    batchCallMutation.mutate(data);
    setIsSubmitting(false);
  };

  const handleRepeatLast = () => {
    if (lastCampaignData) {
      form.setValue('campaignName', `${lastCampaignData.campaign_name} (Repeat)`);
      form.setValue('promptId', lastCampaignData.prompt_id);
      form.setValue('phoneNumbers', lastCampaignData.phoneNumbers || '');
      
      toast.success("Kempen terakhir beserta nombor telefon telah dimuatkan!");
    } else {
      toast.error("Tiada kempen terakhir dijumpai");
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/plain') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        form.setValue('phoneNumbers', content);
      };
      reader.readAsText(file);
    }
  };

  return {
    form,
    prompts,
    promptsLoading,
    lastCampaignData,
    validNumbers,
    invalidNumbers,
    isSubmitting,
    batchCallMutation,
    onSubmit,
    handleRepeatLast,
    handleFileUpload,
  };
}