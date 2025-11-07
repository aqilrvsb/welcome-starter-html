import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCustomAuth } from '@/contexts/CustomAuthContext';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useState } from 'react';
import { VapiClient } from '@/lib/vapiClient';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ExternalLink, Info, Eye, EyeOff } from 'lucide-react';

// Schema for form validation - CLIENTS DON'T NEED API KEYS
// The platform owner (you) manages Deepgram, OpenRouter, ElevenLabs as environment variables
// Clients only provide their Twilio credentials (in Phone Config section)
const apiKeysSchema = z.object({
  vapi_api_key: z.string().optional(), // Legacy VAPI (backward compatibility)
});

type ApiKeysFormData = z.infer<typeof apiKeysSchema>;

interface ApiKeysData {
  id: string;
  vapi_api_key?: string;
  status: string;
}

export function ApiKeysForm() {
  const { user } = useCustomAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isValidating, setIsValidating] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const form = useForm<ApiKeysFormData>({
    resolver: zodResolver(apiKeysSchema),
    defaultValues: {
      vapi_api_key: '',
    },
  });

  // Fetch existing API keys
  const { data, isLoading } = useQuery({
    queryKey: ['api-keys', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('api_keys')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as ApiKeysData | null;
    },
    enabled: !!user,
  });

  // Auto-populate form when data is loaded
  useEffect(() => {
    if (data) {
      form.reset({
        vapi_api_key: data.vapi_api_key || '',
      });
    }
  }, [data, form]);

  // Mutation for saving API keys
  const saveMutation = useMutation({
    mutationFn: async (data: ApiKeysFormData) => {
      if (!user) throw new Error('User not authenticated');

      // Check if user already has API keys
      const { data: existingKeys } = await supabase
        .from('api_keys')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      const apiKeyData = {
        vapi_api_key: data.vapi_api_key,
        assistant_id: '',
        phone_number_id: '',
        status: 'connected',
        updated_at: new Date().toISOString()
      };

      if (existingKeys) {
        // Update existing keys
        const { error } = await supabase
          .from('api_keys')
          .update(apiKeyData)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // Insert new keys
        const { error } = await supabase
          .from('api_keys')
          .insert({
            user_id: user.id,
            ...apiKeyData
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'API key saved successfully!',
      });
      queryClient.invalidateQueries({ queryKey: ['api-keys', user?.id] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: ApiKeysFormData) => {
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
          API Keys Configuration
          {data?.status === 'connected' ? (
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
          Configure your VAPI API key for batch calling.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert className="mb-6 border-primary/20 bg-primary/5">
          <Info className="h-4 w-4 text-primary" />
          <AlertDescription>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">
                  Perlukan email sementara untuk daftar? Guna temp-mail:
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-4"
                  asChild
                >
                  <a
                    href="https://temp-mail.org/en/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2"
                  >
                    Temp Mail
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-primary/10">
                <span className="text-sm">
                  Belum ada akaun VAPI? Daftar sekarang untuk dapatkan API key:
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-4"
                  asChild
                >
                  <a
                    href="https://vapi.ai/?aff=Aicall"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2"
                  >
                    Daftar VAPI
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-primary/10">
                <span className="text-sm">
                  Sudah daftar? Dapatkan API key anda di sini:
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-4"
                  asChild
                >
                  <a
                    href="https://dashboard.vapi.ai/org/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2"
                  >
                    VAPI Dashboard
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="vapi_api_key"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>VAPI API Key</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        {...field} 
                        type={showApiKey ? "text" : "password"}
                        placeholder="Enter your VAPI API key" 
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowApiKey(!showApiKey)}
                      >
                        {showApiKey ? (
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
                'Save API Key'
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}