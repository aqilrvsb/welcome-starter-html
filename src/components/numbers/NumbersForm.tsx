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
const numberSchema = z.object({
  phone_number: z.string().min(1, 'Phone number is required'),
  agent_id: z.string().min(1, 'Agent selection is required'),
});

type NumberFormData = z.infer<typeof numberSchema>;

interface Agent {
  id: string;
  agent_id: string;
  name: string;
}

export function NumbersForm() {
  const { user } = useCustomAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<NumberFormData>({
    resolver: zodResolver(numberSchema),
    defaultValues: {
      phone_number: '',
      agent_id: '',
    },
  });

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

  // Get agents
  const { data: agents } = useQuery({
    queryKey: ['agents', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Agent[];
    },
    enabled: !!user,
  });

  // Mutation for adding number
  const addMutation = useMutation({
    mutationFn: async (data: NumberFormData) => {
      if (!user) throw new Error('User not authenticated');
      if (!apiKeyData?.vapi_api_key) throw new Error('API key not configured');

      const vapiClient = new VapiClient(apiKeyData.vapi_api_key);

      // Add number in Vapi
      const number = await vapiClient.addNumber({
        assistantId: data.agent_id,
        phoneNumber: data.phone_number,
      });

      // Save number to Supabase
      const { error } = await supabase
        .from('numbers')
        .insert({
          user_id: user.id,
          phone_number_id: number.id,
          agent_id: data.agent_id,
          phone_number: data.phone_number,
        });

      if (error) throw error;
      return number;
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Phone number added successfully!',
      });
      form.reset();
      queryClient.invalidateQueries({ queryKey: ['numbers', user?.id] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: NumberFormData) => {
    addMutation.mutate(data);
  };

  if (!apiKeyData?.vapi_api_key) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Add Phone Number</CardTitle>
          <CardDescription>
            You need to configure your API key first to add phone numbers.
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

  if (!agents || agents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Add Phone Number</CardTitle>
          <CardDescription>
            You need to create at least one voice agent first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to="/agents">Create Voice Agent</Link>
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
          Add Phone Number
        </CardTitle>
        <CardDescription>
          Tambah nombor telefon baharu dan assign kepada voice agent
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="phone_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter phone number (e.g., +1234567890)" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="agent_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assign to Agent</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an agent" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {agents.map((agent) => (
                        <SelectItem key={agent.id} value={agent.agent_id}>
                          {agent.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button 
              type="submit" 
              className="w-full"
              disabled={addMutation.isPending}
            >
              {addMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding Number...
                </>
              ) : (
                'Add Phone Number'
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}