import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCustomAuth } from '@/contexts/CustomAuthContext';
import { useToast } from '@/hooks/use-toast';
import { VapiClient } from '@/lib/vapiClient';
import { Link } from 'react-router-dom';

// Schema for form validation
const agentSchema = z.object({
  name: z.string().min(1, 'Agent name is required'),
  provider: z.string().min(1, 'Voice provider is required'),
  voice: z.string().min(1, 'Voice selection is required'),
  language: z.string().min(1, 'Language is required'),
  firstMessage: z.string().optional(),
});

type AgentFormData = z.infer<typeof agentSchema>;

const VOICE_PROVIDERS = [
  { id: 'elevenlabs', name: 'ElevenLabs' },
  { id: 'openai', name: 'OpenAI' },
  { id: 'playht', name: 'PlayHT' },
  { id: 'azure', name: 'Azure' },
];

const VOICE_OPTIONS = {
  elevenlabs: [
    { id: 'charlotte', name: 'Charlotte (Female, English)' },
    { id: 'daniel', name: 'Daniel (Male, English)' },
    { id: 'alice', name: 'Alice (Female, English)' },
    { id: 'sarah', name: 'Sarah (Female, English)' },
    { id: 'liam', name: 'Liam (Male, English)' },
    { id: 'pmXDuKsKkdOYyHRPhJcm', name: 'Pn Nurul' },
  ],
  openai: [
    { id: 'alloy', name: 'Alloy (Neutral)' },
    { id: 'echo', name: 'Echo (Male)' },
    { id: 'fable', name: 'Fable (Female)' },
    { id: 'onyx', name: 'Onyx (Male)' },
    { id: 'nova', name: 'Nova (Female)' },
    { id: 'shimmer', name: 'Shimmer (Female)' },
  ],
  playht: [
    { id: 'jennifer', name: 'Jennifer (Female, English)' },
    { id: 'melissa', name: 'Melissa (Female, English)' },
    { id: 'will', name: 'Will (Male, English)' },
    { id: 'chris', name: 'Chris (Male, English)' },
  ],
  azure: [
    { id: 'aria', name: 'Aria (Female, English)' },
    { id: 'guy', name: 'Guy (Male, English)' },
    { id: 'jane', name: 'Jane (Female, English)' },
    { id: 'jason', name: 'Jason (Male, English)' },
  ],
};

const LANGUAGE_OPTIONS = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
];

export function AgentsForm() {
  const { user } = useCustomAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<AgentFormData>({
    resolver: zodResolver(agentSchema),
    defaultValues: {
      name: '',
      provider: '',
      voice: '',
      language: 'en',
      firstMessage: '',
    },
  });

  const selectedProvider = form.watch('provider');

  // Get API key
  const { data: apiKeyData } = useQuery({
    queryKey: ['api-keys', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('api_keys')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Mutation for creating agent
  const createMutation = useMutation({
    mutationFn: async (data: AgentFormData) => {
      if (!user) throw new Error('User not authenticated');
      if (!apiKeyData?.vapi_api_key) throw new Error('API key not configured');

      const vapiClient = new VapiClient(apiKeyData.vapi_api_key);

      // Create agent in Vapi
      const agent = await vapiClient.createAgent({
        name: data.name,
        voice: {
          provider: data.provider,
          voiceId: data.voice,
        },
        language: data.language,
        firstMessage: data.firstMessage || `Hello! I'm ${data.name}. How can I help you today?`,
      });

      // Save agent to Supabase
      const { error } = await supabase
        .from('agents')
        .insert({
          user_id: user.id,
          agent_id: agent.id,
          name: data.name,
          voice_provider: data.provider,
          voice: data.voice,
          language: data.language,
        });

      if (error) throw error;
      return agent;
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Voice agent created successfully!',
      });
      form.reset();
      queryClient.invalidateQueries({ queryKey: ['agents', user?.id] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: AgentFormData) => {
    createMutation.mutate(data);
  };

  if (!apiKeyData?.vapi_api_key) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Create Voice Agent</CardTitle>
          <CardDescription>
            You need to configure your API key first to create agents.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to="/api-keys">Configure API Key</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Plus className="mr-2 h-5 w-5" />
          Create Voice Agent
        </CardTitle>
        <CardDescription>
          Buat voice agent baharu untuk mengendalikan panggilan automatik
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Agent Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter agent name (e.g., Customer Support Bot)" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="provider"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Voice Provider</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select voice provider" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {VOICE_PROVIDERS.map((provider) => (
                        <SelectItem key={provider.id} value={provider.id}>
                          {provider.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="voice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Voice</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                    disabled={!selectedProvider}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={selectedProvider ? "Select a voice" : "Select provider first"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {selectedProvider && VOICE_OPTIONS[selectedProvider as keyof typeof VOICE_OPTIONS]?.map((voice) => (
                        <SelectItem key={voice.id} value={voice.id}>
                          {voice.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="language"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Language</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {LANGUAGE_OPTIONS.map((lang) => (
                        <SelectItem key={lang.code} value={lang.code}>
                          {lang.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="firstMessage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Message (Optional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Hello! How can I help you today?" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button 
              type="submit" 
              className="w-full"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Agent...
                </>
              ) : (
                'Create Agent'
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}