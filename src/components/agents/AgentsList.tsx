import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCustomAuth } from '@/contexts/CustomAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bot, Calendar } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { SortableTable } from '@/components/ui/sortable-table';

interface Agent {
  id: string;
  agent_id: string;
  name: string;
  voice: string;
  language: string;
  created_at: string;
}

export function AgentsList() {
  const { user } = useCustomAuth();

  const { data: agents, isLoading } = useQuery({
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

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Voice Agents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-[200px]" />
                <Skeleton className="h-4 w-[150px]" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Voice Agents</CardTitle>
        <CardDescription>
          {agents?.length || 0} agent(s) created
        </CardDescription>
      </CardHeader>
      <CardContent>
        {agents && agents.length > 0 ? (
          <SortableTable
            columns={[
              {
                key: 'icon',
                label: '',
                sortable: false,
                className: 'w-16',
                render: () => (
                  <div className="p-2 bg-primary/10 rounded-full">
                    <Bot className="h-6 w-6 text-primary" />
                  </div>
                )
              },
              {
                key: 'name',
                label: 'Name',
                render: (value, agent: Agent) => (
                  <div>
                    <h3 className="font-semibold text-foreground">{value}</h3>
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        Voice: {agent.voice}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {agent.language.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                )
              },
              {
                key: 'agent_id',
                label: 'Agent ID',
                render: (value) => (
                  <span className="text-xs font-mono">
                    {value.slice(0, 8)}...
                  </span>
                )
              },
              {
                key: 'created_at',
                label: 'Created',
                render: (value) => (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4 mr-1" />
                    {new Date(value).toLocaleDateString()}
                  </div>
                )
              }
            ]}
            data={agents}
          />
        ) : (
          <div className="text-center py-8">
            <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No voice agents created yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}