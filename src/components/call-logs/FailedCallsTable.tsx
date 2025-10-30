import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCustomAuth } from '@/contexts/CustomAuthContext';
import { getSessionTokenFromStorage } from '@/lib/customAuth';
import { canMakeCalls } from '@/lib/billing';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Phone, Calendar, PhoneCall, Trash2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { FailedCallsFilters, type FailedCallsFilters as FailedCallsFiltersType } from './FailedCallsFilters';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface CallLog {
  id: string;
  phone_number: string;
  status: string;
  start_time: string;
  campaign_id?: string;
  contacts?: { name: string } | null;
}

export function FailedCallsTable() {
  const { user } = useCustomAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedNumbers, setSelectedNumbers] = useState<Set<string>>(new Set());
  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  
  const today = new Date().toISOString().split('T')[0];
  const [filters, setFilters] = useState<FailedCallsFiltersType>({
    search: '',
    dateFrom: '',
    dateTo: today
  });

  // Calculate date range from filters
  const getDateRange = () => {
    const now = new Date();
    let from = filters.dateFrom ? new Date(filters.dateFrom) : new Date();
    const to = filters.dateTo ? new Date(filters.dateTo) : now;
    
    // If no dateFrom is set, default to 30 days ago
    if (!filters.dateFrom) {
      from.setDate(now.getDate() - 30);
    }
    
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
    
    return { from, to };
  };

  const { from, to } = getDateRange();

  // Fetch available prompts
  const { data: prompts } = useQuery({
    queryKey: ['prompts', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('prompts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch failed call logs
  const { data: failedCalls, isLoading } = useQuery({
    queryKey: ['failed-calls', user?.id, from.toISOString(), to.toISOString(), filters.search],
    queryFn: async () => {
      if (!user) return [];
      
      // First, get all phone numbers that have ever been answered successfully
      const { data: successfulCalls, error: successError } = await supabase
        .from('call_logs')
        .select('phone_number')
        .eq('user_id', user.id)
        .in('status', ['answered', 'completed']);
      
      if (successError) throw successError;
      
      // Create a set of phone numbers that have been answered
      const answeredNumbers = new Set(successfulCalls?.map(call => call.phone_number) || []);
      
      // Now get failed calls
      let query = supabase
        .from('call_logs')
        .select(`*, contacts(name)`)
        .eq('user_id', user.id)
        .in('status', ['no_answer', 'failed', 'voicemail'])
        .gte('start_time', from.toISOString())
        .lte('start_time', to.toISOString())
        .order('start_time', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      
      // Deduplicate by phone number, keeping only the most recent call for each number
      // AND exclude numbers that have ever been answered
      const uniqueCallsMap = new Map<string, CallLog>();
      (data || []).forEach((call: CallLog) => {
        if (!uniqueCallsMap.has(call.phone_number) && !answeredNumbers.has(call.phone_number)) {
          uniqueCallsMap.set(call.phone_number, call);
        }
      });
      
      let results = Array.from(uniqueCallsMap.values());
      
      // Apply search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        results = results.filter(call => 
          call.phone_number.includes(filters.search) ||
          call.contacts?.name?.toLowerCase().includes(searchLower)
        );
      }
      
      return results;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  // Retry single call mutation
  const retrySingleMutation = useMutation({
    mutationFn: async ({ phoneNumber, promptId }: { phoneNumber: string; promptId: string | null }) => {
      // Check subscription status first
      if (!user?.id) {
        throw new Error("User not authenticated");
      }

      const hasAccess = await canMakeCalls(user.id);
      if (!hasAccess) {
        throw new Error("Your trial has expired. Please upgrade to Pro to continue making calls.");
      }

      const sessionToken = getSessionTokenFromStorage();
      if (!sessionToken) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('batch-call', {
        headers: {
          Authorization: `Bearer ${sessionToken}`
        },
        body: {
          phoneNumbers: [phoneNumber],
          campaignName: `Retry Call - ${format(new Date(), 'dd/MM/yyyy HH:mm')}`,
          promptId,
        }
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      toast({
        title: 'Panggilan berjaya dimulakan',
        description: 'AI sedang menghubungi nombor tersebut',
      });
      queryClient.invalidateQueries({ queryKey: ['failed-calls'] });
      queryClient.invalidateQueries({ queryKey: ['call-logs'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Gagal memulakan panggilan',
        description: error.message || 'Sila cuba lagi',
        variant: 'destructive',
      });
    },
  });

  // Delete single call mutation
  const deleteSingleMutation = useMutation({
    mutationFn: async (callId: string) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const { error } = await supabase
        .from('call_logs')
        .delete()
        .eq('id', callId)
        .eq('user_id', user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Panggilan berjaya dipadam',
      });
      queryClient.invalidateQueries({ queryKey: ['failed-calls'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Gagal memadam panggilan',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Retry batch calls mutation
  const retryBatchMutation = useMutation({
    mutationFn: async ({ phoneNumbers, promptId }: { phoneNumbers: string[]; promptId: string | null }) => {
      // Check subscription status first
      if (!user?.id) {
        throw new Error("User not authenticated");
      }

      const hasAccess = await canMakeCalls(user.id);
      if (!hasAccess) {
        throw new Error("Your trial has expired. Please upgrade to Pro to continue making calls.");
      }

      const sessionToken = getSessionTokenFromStorage();
      if (!sessionToken) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('batch-call', {
        headers: {
          Authorization: `Bearer ${sessionToken}`
        },
        body: {
          phoneNumbers,
          campaignName: `Retry Batch - ${format(new Date(), 'dd/MM/yyyy HH:mm')}`,
          promptId,
        }
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Panggilan batch berjaya dimulakan',
        description: `${selectedNumbers.size} nombor sedang dihubungi`,
      });
      setSelectedNumbers(new Set());
      setShowBatchDialog(false);
      queryClient.invalidateQueries({ queryKey: ['failed-calls'] });
      queryClient.invalidateQueries({ queryKey: ['call-logs'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Gagal memulakan panggilan batch',
        description: error.message || 'Sila cuba lagi',
        variant: 'destructive',
      });
    },
  });

  const handleSelectAll = () => {
    if (selectedNumbers.size === failedCalls?.length) {
      setSelectedNumbers(new Set());
    } else {
      setSelectedNumbers(new Set(failedCalls?.map(call => call.phone_number) || []));
    }
  };

  const handleSelectNumber = (phoneNumber: string) => {
    const newSelected = new Set(selectedNumbers);
    if (newSelected.has(phoneNumber)) {
      newSelected.delete(phoneNumber);
    } else {
      newSelected.add(phoneNumber);
    }
    setSelectedNumbers(newSelected);
  };

  const handleRetryAll = () => {
    if (!failedCalls || failedCalls.length === 0) return;
    const allNumbers = failedCalls.map(call => call.phone_number);
    retryBatchMutation.mutate({ phoneNumbers: allNumbers, promptId: selectedPromptId });
    setShowBatchDialog(false);
  };

  const handleRetrySelected = () => {
    if (selectedNumbers.size === 0) return;
    retryBatchMutation.mutate({ phoneNumbers: Array.from(selectedNumbers), promptId: selectedPromptId });
    setShowBatchDialog(false);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'destructive' | 'secondary' | 'outline'> = {
      no_answer: 'secondary',
      failed: 'destructive',
      voicemail: 'outline',
    };
    
    const labels: Record<string, string> = {
      no_answer: 'Tidak Angkat',
      failed: 'Gagal',
      voicemail: 'Voicemail',
    };

    return (
      <Badge variant={variants[status] || 'outline'}>
        {labels[status] || status}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <FailedCallsFilters
          filters={filters}
          onFiltersChange={setFilters}
          totalCalls={failedCalls?.length || 0}
        />

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  Failed Calls
                </CardTitle>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {/* Action Buttons */}
                {selectedNumbers.size > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowBatchDialog(true)}
                    disabled={retryBatchMutation.isPending}
                  >
                    <PhoneCall className="h-4 w-4 mr-2" />
                    Call Balik Pilihan ({selectedNumbers.size})
                  </Button>
                )}
                
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setShowBatchDialog(true)}
                  disabled={!failedCalls || failedCalls.length === 0 || retryBatchMutation.isPending}
                >
                  <PhoneCall className="h-4 w-4 mr-2" />
                  Call Balik Semua
                </Button>
              </div>
            </div>
          </CardHeader>

        <CardContent>
          {!failedCalls || failedCalls.length === 0 ? (
            <div className="text-center py-12">
              <Phone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Tiada panggilan gagal dalam tempoh dipilih</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedNumbers.size === failedCalls.length}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>Nombor Telefon</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tarikh</TableHead>
                    <TableHead className="text-right">Tindakan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {failedCalls.map((call) => (
                    <TableRow key={call.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedNumbers.has(call.phone_number)}
                          onCheckedChange={() => handleSelectNumber(call.phone_number)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {call.contacts?.name || '-'}
                      </TableCell>
                      <TableCell>{call.phone_number}</TableCell>
                      <TableCell>{getStatusBadge(call.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {format(new Date(call.start_time), 'dd/MM/yyyy HH:mm')}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => retrySingleMutation.mutate({ phoneNumber: call.phone_number, promptId: null })}
                            disabled={retrySingleMutation.isPending}
                          >
                            <PhoneCall className="h-4 w-4 mr-1" />
                            Call Balik
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (confirm('Padam panggilan ini?')) {
                                deleteSingleMutation.mutate(call.id);
                              }
                            }}
                            disabled={deleteSingleMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      </div>

      {/* Batch Retry Confirmation Dialog */}
      <AlertDialog open={showBatchDialog} onOpenChange={setShowBatchDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pilih Prompt & Call Balik</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedNumbers.size > 0 
                ? `Anda akan menghubungi semula ${selectedNumbers.size} nombor yang dipilih.`
                : `Anda akan menghubungi semula SEMUA ${failedCalls?.length || 0} nombor dalam senarai failed call.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="prompt-select">Pilih Prompt</Label>
              <Select value={selectedPromptId || 'default'} onValueChange={(value) => setSelectedPromptId(value === 'default' ? null : value)}>
                <SelectTrigger id="prompt-select">
                  <SelectValue placeholder="Pilih prompt untuk call balik" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Guna Prompt Terkini</SelectItem>
                  {prompts?.map((prompt) => (
                    <SelectItem key={prompt.id} value={prompt.id}>
                      {prompt.prompt_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedPromptId(null)}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={selectedNumbers.size > 0 ? handleRetrySelected : handleRetryAll}
              disabled={retryBatchMutation.isPending}
            >
              {retryBatchMutation.isPending ? 'Memproses...' : 'Ya, Teruskan'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
