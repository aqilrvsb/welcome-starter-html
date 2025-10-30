import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle, Phone, Info, Server } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCustomAuth } from '@/contexts/CustomAuthContext';
import { useToast } from '@/hooks/use-toast';
import { useDynamicPricing } from '@/hooks/useDynamicPricing';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

// Schema for form validation - AlienVOIP SIP only
const phoneConfigSchema = z.object({
  // MikoPBX fields (required)
  mikopbx_url: z.string().min(1, 'MikoPBX URL is required'),
  mikopbx_api_key: z.string().optional(),
  mikopbx_ami_username: z.string().optional(),
  mikopbx_ami_password: z.string().optional(),
  // AlienVOIP SIP trunk fields (required)
  sip_proxy_primary: z.string().min(1, 'Primary SIP proxy is required'),
  sip_proxy_secondary: z.string().optional(),
  sip_username: z.string().min(1, 'SIP username is required'),
  sip_password: z.string().min(1, 'SIP password is required'),
  sip_caller_id: z.string().optional(),
  sip_display_name: z.string().optional(),
  sip_codec: z.string().optional(),
});

type PhoneConfigFormData = z.infer<typeof phoneConfigSchema>;

interface PhoneConfigData {
  id: string;
  mikopbx_url: string;
  mikopbx_api_key: string | null;
  mikopbx_ami_username: string | null;
  mikopbx_ami_password: string | null;
  sip_proxy_primary: string;
  sip_proxy_secondary: string | null;
  sip_username: string;
  sip_password: string;
  sip_caller_id: string | null;
  sip_display_name: string | null;
  sip_codec: string | null;
}

export function PhoneConfigForm() {
  const { user } = useCustomAuth();
  const { toast } = useToast();
  const { pricingPerMinute } = useDynamicPricing();
  const queryClient = useQueryClient();
  const [accountType, setAccountType] = useState<'trial' | 'pro'>('trial');
  const [claimingTrial, setClaimingTrial] = useState(false);
  const [trialClaimed, setTrialClaimed] = useState(false);

  const form = useForm<PhoneConfigFormData>({
    resolver: zodResolver(phoneConfigSchema),
    defaultValues: {
      mikopbx_url: 'http://68.183.177.218',
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
    },
  });

  // Fetch existing phone config
  const { data, isLoading } = useQuery({
    queryKey: ['phone-config', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('phone_config')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data as PhoneConfigData | null;
    },
    enabled: !!user,
  });

  // Check if user has claimed trial
  useEffect(() => {
    if (user) {
      supabase
        .from('users')
        .select('trial_credits_claimed')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          setTrialClaimed(data?.trial_credits_claimed || false);
        });
    }
  }, [user]);

  // Auto-populate form when data is loaded
  useEffect(() => {
    if (data) {
      form.reset({
        mikopbx_url: data.mikopbx_url || 'http://68.183.177.218',
        mikopbx_api_key: data.mikopbx_api_key || '',
        mikopbx_ami_username: data.mikopbx_ami_username || 'admin',
        mikopbx_ami_password: data.mikopbx_ami_password || '',
        sip_proxy_primary: data.sip_proxy_primary || '',
        sip_proxy_secondary: data.sip_proxy_secondary || '',
        sip_username: data.sip_username || '',
        sip_password: data.sip_password || '',
        sip_caller_id: data.sip_caller_id || '',
        sip_display_name: data.sip_display_name || '',
        sip_codec: data.sip_codec || 'ulaw',
      });
    }
  }, [data, form]);

  // Mutation for saving phone config
  const saveMutation = useMutation({
    mutationFn: async (formData: PhoneConfigFormData) => {
      if (!user) throw new Error('User not authenticated');

      // Check if user already has phone config
      const { data: existingConfig } = await supabase
        .from('phone_config')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      const phoneConfigData = {
        mikopbx_url: formData.mikopbx_url,
        mikopbx_api_key: formData.mikopbx_api_key || null,
        mikopbx_ami_username: formData.mikopbx_ami_username || null,
        mikopbx_ami_password: formData.mikopbx_ami_password || null,
        sip_proxy_primary: formData.sip_proxy_primary,
        sip_proxy_secondary: formData.sip_proxy_secondary || null,
        sip_username: formData.sip_username,
        sip_password: formData.sip_password,
        sip_caller_id: formData.sip_caller_id || null,
        sip_display_name: formData.sip_display_name || null,
        sip_codec: formData.sip_codec || 'ulaw',
        updated_at: new Date().toISOString()
      };

      if (existingConfig) {
        // Update existing config
        const { error } = await supabase
          .from('phone_config')
          .update(phoneConfigData)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // Insert new config
        const { error } = await supabase
          .from('phone_config')
          .insert({
            user_id: user.id,
            ...phoneConfigData
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Phone configuration saved successfully!',
      });
      queryClient.invalidateQueries({ queryKey: ['phone-config', user?.id] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: PhoneConfigFormData) => {
    saveMutation.mutate(data);
  };

  const handleClaimTrial = async () => {
    if (!user || trialClaimed) return;

    try {
      setClaimingTrial(true);

      const { data, error } = await supabase.rpc('claim_trial_credits', {
        p_user_id: user.id
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: 'Trial Credits Claimed!',
          description: data.message,
        });
        setTrialClaimed(true);
        queryClient.invalidateQueries({ queryKey: ['credits-balance', user.id] });
      } else {
        toast({
          title: 'Already Claimed',
          description: data.message,
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to claim trial credits',
        variant: 'destructive',
      });
    } finally {
      setClaimingTrial(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center">
            <Phone className="mr-2 h-5 w-5" />
            Phone Configuration
          </span>
          {data ? (
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
        <CardDescription>
          Configure your SIP trunk for AI voice calls.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert className="mb-6 border-blue-200 bg-blue-50">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-sm text-blue-800">
            <strong>Free Trial:</strong> Get 10 minutes free (one-time only) to test the system.
            <br />
            <strong>Pro Account:</strong> Only RM{pricingPerMinute.toFixed(2)} per minute - pay as you go!
          </AlertDescription>
        </Alert>

        {/* Account Type Selection */}
        <div className="mb-6 p-4 border rounded-lg bg-muted/30">
          <Label className="text-base font-semibold mb-3 block">Select Account Type</Label>
          <RadioGroup value={accountType} onValueChange={(value: 'trial' | 'pro') => setAccountType(value)} className="space-y-3">
            <div className="flex items-center space-x-3 p-3 border rounded-lg bg-background hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="trial" id="trial" />
              <Label htmlFor="trial" className="cursor-pointer flex-1">
                <div className="font-medium">Trial Account</div>
                <div className="text-sm text-muted-foreground">10 minutes free calling for testing</div>
              </Label>
            </div>
            <div className="flex items-center space-x-3 p-3 border rounded-lg bg-background hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="pro" id="pro" />
              <Label htmlFor="pro" className="cursor-pointer flex-1">
                <div className="font-medium">Pro Account</div>
                <div className="text-sm text-muted-foreground">RM{pricingPerMinute.toFixed(2)} per minute - unlimited calling</div>
              </Label>
            </div>
          </RadioGroup>

          {/* Trial Credits Claim Button */}
          {accountType === 'trial' && (
            <div className="mt-4 pt-4 border-t">
              {trialClaimed ? (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    Trial credits already claimed! You received 10 minutes (RM1.50) free.
                  </AlertDescription>
                </Alert>
              ) : (
                <Button
                  onClick={handleClaimTrial}
                  disabled={claimingTrial}
                  className="w-full"
                  variant="default"
                >
                  {claimingTrial ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Claiming...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Claim 10 Minutes Free Trial
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* AlienVOIP SIP + MikoPBX Configuration */}
            <div className="space-y-4">
                {/* MikoPBX Section - Hidden for both trial and pro */}
                {false && (
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-4">
                    <Server className="h-5 w-5" />
                    <h3 className="font-semibold">MikoPBX Server (Digital Ocean)</h3>
                  </div>

                  <Alert className="mb-4 border-blue-200 bg-blue-50">
                    <Info className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-sm text-blue-800">
                      Your MikoPBX server on Digital Ocean acts as the bridge between your SIP trunk and the AI handler.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="mikopbx_url"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>MikoPBX URL *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="http://68.183.177.218" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="mikopbx_api_key"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>MikoPBX API Key (Optional)</FormLabel>
                          <FormControl>
                            <Input {...field} type="password" placeholder="API key if using REST API" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="mikopbx_ami_username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>AMI Username</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="admin" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="mikopbx_ami_password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>AMI Password</FormLabel>
                            <FormControl>
                              <Input {...field} type="password" placeholder="AMI password" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>
                )}

                {/* SIP Trunk Section */}
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-4">
                    <Phone className="h-5 w-5" />
                    <h3 className="font-semibold">SIP Trunk Configuration</h3>
                  </div>

                  <Alert className="mb-4 border-green-200 bg-green-50">
                    <Info className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-sm text-green-800">
                      Enter your SIP trunk credentials. Each user has their own SIP account.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="sip_proxy_primary"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>SIP Proxy Primary *</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Enter your SIP proxy domain" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="sip_proxy_secondary"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>SIP Proxy Secondary</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Enter secondary proxy (optional)" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="sip_username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>SIP Username *</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Enter your SIP username" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="sip_password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>SIP Password *</FormLabel>
                            <FormControl>
                              <Input {...field} type="password" placeholder="Enter your SIP password" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="sip_caller_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Caller ID Number</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="+60123456789" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="sip_display_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Display Name</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="My Company" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="sip_codec"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Codec</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select codec" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="ulaw">ulaw (G.711)</SelectItem>
                              <SelectItem value="alaw">alaw (G.711a)</SelectItem>
                              <SelectItem value="gsm">GSM</SelectItem>
                              <SelectItem value="g729">G.729</SelectItem>
                              <SelectItem value="g723">G.723</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>

            <Button
              type="submit"
              className="w-full"
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Phone Configuration'
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}