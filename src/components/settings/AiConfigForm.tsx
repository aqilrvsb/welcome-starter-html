import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  CheckCircle,
  XCircle,
  Phone,
  Mic,
  Settings,
  Edit3,
  ExternalLink,
  Info,
  Eye,
  EyeOff,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCustomAuth } from "@/contexts/CustomAuthContext";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ApiKeysForm } from "@/components/api-keys/ApiKeysForm";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Schema for phone configuration - FreeSWITCH + SIP Trunk
const phoneConfigSchema = z.object({
  freeswitch_url: z.string().min(1, 'FreeSWITCH URL is required'),
  mikopbx_api_key: z.string().optional(),
  mikopbx_ami_username: z.string().optional(),
  mikopbx_ami_password: z.string().optional(),
  sip_proxy_primary: z.string().min(1, 'Primary SIP proxy is required'),
  sip_proxy_secondary: z.string().optional(),
  sip_username: z.string().min(1, 'SIP username is required'),
  sip_password: z.string().min(1, 'SIP password is required'),
  sip_caller_id: z.string().optional(),
  sip_display_name: z.string().optional(),
  sip_codec: z.string().optional(),
  whacenter_device_id: z.string().optional(),
});

// Voice options from the list
const VOICE_OPTIONS = [
  { id: "UcqZLa941Kkt8ZhEEybf", name: "Afifah", description: "Female voice (Default)", isDefault: true },
  { id: "QDwlG1e3yL8LkVHOemYW", name: "Tasha", description: "Female voice" },
  { id: "Wt2NFmwNEkwzfOyc7VGK", name: "Puan Nurul", description: "Female voice" },
  { id: "qAJVXEQ6QgjOQ25KuoU8", name: "Aisyah", description: "Female voice" },
  { id: "lMSqoJeA0cBBNA9FeHAs", name: "Rizq Khalid", description: "Male voice" },
  { id: "Wc6X61hTD7yucJMheuLN", name: "Faizal", description: "Male voice" },
  { id: "NpVSXJvYSdIbjOaMbShj", name: "Jawid Iqbal", description: "Male voice" },
];

// Schema for voice configuration
const voiceConfigSchema = z.object({
  selected_voice: z.string().min(1, "Please select a voice"),
  speed: z.number().min(0.7).max(1.2).optional(),
});

type PhoneConfigFormData = z.infer<typeof phoneConfigSchema>;
type VoiceConfigFormData = z.infer<typeof voiceConfigSchema>;

export function AiConfigForm() {
  const { user } = useCustomAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAccountSid, setShowAccountSid] = useState(false);
  const [showAuthToken, setShowAuthToken] = useState(false);
  const [accountType, setAccountType] = useState<'trial' | 'pro'>('trial');

  const phoneForm = useForm<PhoneConfigFormData>({
    resolver: zodResolver(phoneConfigSchema),
    defaultValues: {
      freeswitch_url: 'http://159.223.45.224',
      mikopbx_api_key: '',
      mikopbx_ami_username: 'admin',
      mikopbx_ami_password: '',
      sip_proxy_primary: '',
      sip_proxy_secondary: '',
      sip_username: '',
      sip_password: '',
      sip_caller_id: '',
      sip_display_name: '',
      sip_codec: 'ulaw',
      whacenter_device_id: "",
    },
  });

  const voiceForm = useForm<VoiceConfigFormData>({
    resolver: zodResolver(voiceConfigSchema),
    defaultValues: {
      selected_voice: "UcqZLa941Kkt8ZhEEybf",
      speed: 0.8,
    },
  });

  // Fetch existing AI config
  const { data: aiConfig, isLoading } = useQuery({
    queryKey: ["ai-config", user?.id],
    queryFn: async () => {
      if (!user) return null;

      try {
        // Get phone config
        const { data: phoneData, error: phoneError } = await supabase
          .from("phone_config")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (phoneError && phoneError.code !== "PGRST116") {
          console.error("Phone config error:", phoneError);
        }

        // Get voice config using a direct query - cast to any to bypass TypeScript
        let voiceData = null;
        try {
          const { data: vData, error: voiceError } = await (supabase as any)
            .from("voice_config")
            .select("*")
            .eq("user_id", user.id)
            .maybeSingle();

          if (!voiceError) {
            voiceData = vData;
          }
        } catch (error) {
          console.log("Voice config table not ready yet");
        }

        return {
          phone_config: phoneData,
          voice_config: voiceData,
        };
      } catch (error) {
        console.error("Error fetching AI config:", error);
        return {
          phone_config: null,
          voice_config: null,
        };
      }
    },
    enabled: !!user,
  });

  // Auto-populate forms when data is loaded
  useEffect(() => {
    if (aiConfig) {
      const phoneConfig = aiConfig.phone_config;
      const voiceConfig = aiConfig.voice_config;

      // Reset phone form
      phoneForm.reset({
        freeswitch_url: phoneConfig?.freeswitch_url || 'http://159.223.45.224',
        mikopbx_api_key: phoneConfig?.mikopbx_api_key || '',
        mikopbx_ami_username: phoneConfig?.mikopbx_ami_username || 'admin',
        mikopbx_ami_password: phoneConfig?.mikopbx_ami_password || '',
        sip_proxy_primary: phoneConfig?.sip_proxy_primary || '',
        sip_proxy_secondary: phoneConfig?.sip_proxy_secondary || '',
        sip_username: phoneConfig?.sip_username || '',
        sip_password: phoneConfig?.sip_password || '',
        sip_caller_id: phoneConfig?.sip_caller_id || '',
        sip_display_name: phoneConfig?.sip_display_name || '',
        sip_codec: phoneConfig?.sip_codec || 'ulaw',
        whacenter_device_id: phoneConfig?.whacenter_device_id || "",
      });

      // Reset voice form with selected voice from manual_voice_id
      const manualVoiceId = voiceConfig?.manual_voice_id || "";
      const predefinedVoices = [
        "UcqZLa941Kkt8ZhEEybf",
        "QDwlG1e3yL8LkVHOemYW",
        "qAJVXEQ6QgjOQ25KuoU8",
        "lMSqoJeA0cBBNA9FeHAs",
        "Wc6X61hTD7yucJMheuLN",
        "SrWU271vZiNf2mrBhzL5",
        "NpVSXJvYSdIbjOaMbShj",
        "Wt2NFmwNEkwzfOyc7VGK",
      ];

      voiceForm.reset({
        selected_voice: predefinedVoices.includes(manualVoiceId) ? manualVoiceId : "UcqZLa941Kkt8ZhEEybf",
        speed: voiceConfig?.speed ?? 0.8,
      });
    }
  }, [aiConfig, phoneForm, voiceForm]);

  // Mutation for saving phone config
  const savePhoneMutation = useMutation({
    mutationFn: async (data: PhoneConfigFormData) => {
      if (!user) throw new Error("User not authenticated");

      const phoneConfigData = {
        freeswitch_url: data.freeswitch_url,
        mikopbx_api_key: data.mikopbx_api_key || null,
        mikopbx_ami_username: data.mikopbx_ami_username || null,
        mikopbx_ami_password: data.mikopbx_ami_password || null,
        sip_proxy_primary: data.sip_proxy_primary,
        sip_proxy_secondary: data.sip_proxy_secondary || null,
        sip_username: data.sip_username,
        sip_password: data.sip_password,
        sip_caller_id: data.sip_caller_id || null,
        sip_display_name: data.sip_display_name || null,
        sip_codec: data.sip_codec || 'ulaw',
        whacenter_device_id: data.whacenter_device_id || null,
        updated_at: new Date().toISOString(),
      };

      const { data: existingPhoneConfig } = await supabase
        .from("phone_config")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingPhoneConfig) {
        await supabase.from("phone_config").update(phoneConfigData).eq("user_id", user.id);
      } else {
        await supabase.from("phone_config").insert({
          user_id: user.id,
          ...phoneConfigData,
        });
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Phone configuration saved successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["ai-config", user?.id] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation for saving voice config
  const saveVoiceMutation = useMutation({
    mutationFn: async (data: VoiceConfigFormData) => {
      if (!user) throw new Error("User not authenticated");

      try {
        // Check if voice config exists for this user
        const { data: existingConfig, error: checkError } = await (supabase as any)
          .from("voice_config")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (checkError) {
          console.error("Error checking existing voice config:", checkError);
          throw new Error(`Failed to check voice configuration: ${checkError.message}`);
        }

        // Map selected voice to voice ID
        const voiceMap: { [key: string]: string } = {
          UcqZLa941Kkt8ZhEEybf: "UcqZLa941Kkt8ZhEEybf",
          QDwlG1e3yL8LkVHOemYW: "QDwlG1e3yL8LkVHOemYW",
          Wt2NFmwNEkwzfOyc7VGK: "Wt2NFmwNEkwzfOyc7VGK",
          qAJVXEQ6QgjOQ25KuoU8: "qAJVXEQ6QgjOQ25KuoU8",
          lMSqoJeA0cBBNA9FeHAs: "lMSqoJeA0cBBNA9FeHAs",
          Wc6X61hTD7yucJMheuLN: "Wc6X61hTD7yucJMheuLN",
          SrWU271vZiNf2mrBhzL5: "SrWU271vZiNf2mrBhzL5",
          NpVSXJvYSdIbjOaMbShj: "NpVSXJvYSdIbjOaMbShj",
        };
        const voiceIdToSave = voiceMap[data.selected_voice] || "UcqZLa941Kkt8ZhEEybf";

        const voiceConfigData = {
          manual_voice_id: voiceIdToSave,
          speed: data.speed ?? 0.8,
          updated_at: new Date().toISOString(),
        };

        if (existingConfig) {
          // Update existing config
          const { error: updateError } = await (supabase as any)
            .from("voice_config")
            .update(voiceConfigData)
            .eq("user_id", user.id);

          if (updateError) {
            console.error("Voice config update error:", updateError);
            throw new Error(`Failed to update voice configuration: ${updateError.message}`);
          }
        } else {
          // Insert new config
          const { error: insertError } = await (supabase as any).from("voice_config").insert({
            user_id: user.id,
            ...voiceConfigData,
          });

          if (insertError) {
            console.error("Voice config insert error:", insertError);
            throw new Error(`Failed to create voice configuration: ${insertError.message}`);
          }
        }
      } catch (error) {
        console.error("Error saving voice config:", error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Voice configuration saved successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["ai-config", user?.id] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Helper function to get current voice name
  const getCurrentVoiceName = () => {
    const selectedVoice = voiceForm.getValues("selected_voice");

    if (selectedVoice && selectedVoice !== "") {
      const voice = VOICE_OPTIONS.find((v) => v.id === selectedVoice);
      return voice ? voice.name : selectedVoice;
    }

    return "Afifah (Default)";
  };

  const onSubmitPhone = (data: PhoneConfigFormData) => {
    savePhoneMutation.mutate(data);
  };

  const onSubmitVoice = (data: VoiceConfigFormData) => {
    saveVoiceMutation.mutate(data);
  };

  const isConfigured = aiConfig?.phone_config || aiConfig?.voice_config;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Unified AI Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center">
              <Settings className="mr-2 h-5 w-5" />
              AI Configuration
            </span>
            {isConfigured ? (
              <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                <CheckCircle className="w-3 h-3 mr-1" />
                Configured
              </Badge>
            ) : (
              <Badge variant="secondary">
                <XCircle className="w-3 h-3 mr-1" />
                Not Configured
              </Badge>
            )}
          </CardTitle>
          <CardDescription>Configure phone services and voice settings for your AI assistant.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Phone Configuration Section */}
          <div className="space-y-6">
            <div className="flex items-center space-x-2">
              <Phone className="h-4 w-4" />
              <h3 className="text-lg font-medium">Phone Configuration</h3>
            </div>

            <Alert className="border-blue-200 bg-blue-50">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-sm text-blue-800">
                <strong>Free Trial:</strong> Get 10 minutes free (one-time only) to test the system.
                <br />
                <strong>Pro Account:</strong> Only RM0.15 per minute - pay as you go!
              </AlertDescription>
            </Alert>

            {/* Account Type Selection */}
            <div className="mb-6 p-4 border rounded-lg bg-muted/30">
              <Label className="text-base font-semibold mb-3 block">Select Account Type</Label>
              <RadioGroup value={accountType} onValueChange={(value: 'trial' | 'pro') => setAccountType(value)} className="space-y-3">
                <div className="flex items-center space-x-3 p-3 border rounded-lg bg-background hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="trial" id="ai-trial" />
                  <Label htmlFor="ai-trial" className="cursor-pointer flex-1">
                    <div className="font-medium">Trial Account</div>
                    <div className="text-sm text-muted-foreground">10 minutes free calling for testing</div>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-3 border rounded-lg bg-background hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="pro" id="ai-pro" />
                  <Label htmlFor="ai-pro" className="cursor-pointer flex-1">
                    <div className="font-medium">Pro Account</div>
                    <div className="text-sm text-muted-foreground">RM0.15 per minute - unlimited calling</div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <Form {...phoneForm}>
              <form onSubmit={phoneForm.handleSubmit(onSubmitPhone)} className="space-y-6">
                {/* SIP Trunk Section - Only show for Pro Account */}
                {accountType === 'pro' && (
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    SIP Trunk Configuration
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={phoneForm.control}
                      name="sip_proxy_primary"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SIP Proxy Primary *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="sip1.alienvoip.com" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={phoneForm.control}
                      name="sip_proxy_secondary"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SIP Proxy Secondary</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="sip3.alienvoip.com" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={phoneForm.control}
                      name="sip_username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SIP Username *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="646006395" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={phoneForm.control}
                      name="sip_password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SIP Password *</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                {...field}
                                type={showAuthToken ? "text" : "password"}
                                placeholder="Xh7Yk5Ydcg"
                                className="pr-10"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                onClick={() => setShowAuthToken(!showAuthToken)}
                              >
                                {showAuthToken ? (
                                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <Eye className="h-4 w-4 text-muted-foreground" />
                                )}
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Caller ID field */}
                  <FormField
                    control={phoneForm.control}
                    name="sip_caller_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Caller ID (Optional)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="+60123456789" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                )}

                {accountType === 'pro' && (
                  <Button type="submit" className="w-full" disabled={savePhoneMutation.isPending}>
                    {savePhoneMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Phone Configuration"
                    )}
                  </Button>
                )}
              </form>
            </Form>
          </div>

          <Separator />

          {/* Voice Configuration Section */}
          <div className="space-y-6">
            <div className="flex items-center space-x-2">
              <Mic className="h-4 w-4" />
              <h3 className="text-lg font-medium">Voice Configuration</h3>
            </div>

            <Form {...voiceForm}>
              <form onSubmit={voiceForm.handleSubmit(onSubmitVoice)} className="space-y-4">
                <FormField
                  control={voiceForm.control}
                  name="selected_voice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Select Voice</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a voice" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {VOICE_OPTIONS.map((voice) => (
                            <SelectItem key={voice.id} value={voice.id}>
                              <div className="flex items-center justify-between w-full">
                                <span>{voice.name}</span>
                                {voice.isDefault && (
                                  <Badge variant="secondary" className="ml-2 text-xs">
                                    Default
                                  </Badge>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={voiceForm.control}
                  name="speed"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Voice Speed: {field.value?.toFixed(2) ?? "0.80"}</FormLabel>
                      <FormControl>
                        <Slider
                          min={0.7}
                          max={1.2}
                          step={0.05}
                          value={[field.value ?? 0.8]}
                          onValueChange={(vals) => field.onChange(vals[0])}
                          className="w-full"
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Adjust the speaking speed (0.7 = slower, 1.2 = faster)
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    <strong>Current Voice:</strong> {getCurrentVoiceName()}
                  </p>
                </div>

                <Button type="submit" className="w-full" disabled={saveVoiceMutation.isPending}>
                  {saveVoiceMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving Voice Config...
                    </>
                  ) : (
                    "Save Voice Configuration"
                  )}
                </Button>
              </form>
            </Form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
