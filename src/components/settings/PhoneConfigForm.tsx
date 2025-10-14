import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle, Phone, ExternalLink, Info, BookOpen } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCustomAuth } from '@/contexts/CustomAuthContext';
import { useToast } from '@/hooks/use-toast';
import { useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useNavigate } from 'react-router-dom';

// Schema for form validation
const phoneConfigSchema = z.object({
  twilio_phone_number: z.string().min(1, 'Twilio phone number is required'),
  twilio_account_sid: z.string().min(1, 'Twilio Account SID is required'),
  twilio_auth_token: z.string().min(1, 'Twilio Auth Token is required'),
});

type PhoneConfigFormData = z.infer<typeof phoneConfigSchema>;

interface PhoneConfigData {
  id: string;
  twilio_phone_number: string;
  twilio_account_sid: string;
  twilio_auth_token: string;
}

export function PhoneConfigForm() {
  const { user } = useCustomAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const form = useForm<PhoneConfigFormData>({
    resolver: zodResolver(phoneConfigSchema),
    defaultValues: {
      twilio_phone_number: '',
      twilio_account_sid: '',
      twilio_auth_token: '',
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

  // Auto-populate form when data is loaded
  useEffect(() => {
    if (data) {
      form.reset({
        twilio_phone_number: data.twilio_phone_number,
        twilio_account_sid: data.twilio_account_sid,
        twilio_auth_token: data.twilio_auth_token,
      });
    }
  }, [data, form]);

  // Mutation for saving phone config
  const saveMutation = useMutation({
    mutationFn: async (data: PhoneConfigFormData) => {
      if (!user) throw new Error('User not authenticated');

      // Check if user already has phone config
      const { data: existingConfig } = await supabase
        .from('phone_config')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      const phoneConfigData = {
        twilio_phone_number: data.twilio_phone_number,
        twilio_account_sid: data.twilio_account_sid,
        twilio_auth_token: data.twilio_auth_token,
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
          Configure your Twilio credentials for phone services.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert className="mb-6 border-primary/20 bg-primary/5">
          <Info className="h-4 w-4 text-primary" />
          <AlertDescription className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <span className="text-sm">
                Belum ada akaun Twilio? Daftar sekarang untuk dapatkan credentials:
              </span>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="w-full sm:w-auto"
              >
                <a
                  href="https://www.twilio.com/en-us"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2"
                >
                  Daftar Twilio
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <span className="text-sm">
                Dapatkan phone number anda:
              </span>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="w-full sm:w-auto"
              >
                <a
                  href="/twilio-tutorial"
                  className="inline-flex items-center justify-center gap-2"
                >
                  <Phone className="h-3 w-3" />
                  Get Phone Number
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <span className="text-sm">
                Dapatkan Account SID & Auth Token:
              </span>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="w-full sm:w-auto"
              >
                <a
                  href="/twilio-tutorial"
                  className="inline-flex items-center justify-center gap-2"
                >
                  <BookOpen className="h-3 w-3" />
                  Get Credentials
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <span className="text-sm">
                Panduan lengkap setup Twilio:
              </span>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="w-full sm:w-auto"
              >
                <a
                  href="/twilio-tutorial"
                  className="inline-flex items-center justify-center gap-2"
                >
                  <BookOpen className="h-3 w-3" />
                  Tutorial Page
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="twilio_phone_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Twilio Phone Number</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="+17755242070" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="twilio_account_sid"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Twilio Account SID</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="ACb04sasfa234bd27d7ee7be008cf4be5d" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="twilio_auth_token"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Twilio Auth Token</FormLabel>
                  <FormControl>
                    <Input {...field} type="password" placeholder="c9dcesa53f6b38b1c1a0b810dc5a3835" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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