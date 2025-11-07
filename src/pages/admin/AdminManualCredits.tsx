import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CreditCard, User, Plus, Minus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface User {
  id: string;
  username: string;
  email: string;
  account_type: string;
  trial_balance_minutes: number;
  pro_balance_minutes: number;
}

export default function AdminManualCredits() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState('');
  const [transactionType, setTransactionType] = useState<'topup' | 'deduction'>('topup');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  // Fetch all users
  const { data: users, isLoading: loadingUsers } = useQuery({
    queryKey: ['admin-users-credits'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, username, email, account_type, trial_balance_minutes, pro_balance_minutes')
        .order('username');

      if (error) throw error;
      return data as User[];
    },
  });

  const selectedUser = users?.find(u => u.id === selectedUserId);

  // Create manual transaction mutation
  const createTransactionMutation = useMutation({
    mutationFn: async (data: {
      user_id: string;
      transaction_type: string;
      amount: number;
      description: string;
    }) => {
      const { data: result, error } = await supabase.functions.invoke('admin-manual-credits', {
        body: data,
      });

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Manual credit transaction created successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['admin-users-credits'] });
      // Reset form
      setAmount('');
      setDescription('');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create transaction',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedUserId) {
      toast({
        title: 'Error',
        description: 'Please select a user',
        variant: 'destructive',
      });
      return;
    }

    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      toast({
        title: 'Error',
        description: 'Please enter a valid amount greater than 0',
        variant: 'destructive',
      });
      return;
    }

    if (!description.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a description',
        variant: 'destructive',
      });
      return;
    }

    createTransactionMutation.mutate({
      user_id: selectedUserId,
      transaction_type: transactionType,
      amount: numAmount,
      description: description.trim(),
    });
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Manual Credits Management</h1>
        <p className="text-muted-foreground mt-2">
          Add or deduct credits for users manually. All transactions are recorded for audit trail.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Create Manual Transaction
          </CardTitle>
          <CardDescription>
            Create a manual credit transaction that will be recorded in the user's transaction history
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* User Selection */}
            <div className="space-y-2">
              <Label htmlFor="user">Select User</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger id="user">
                  <SelectValue placeholder="Select a user..." />
                </SelectTrigger>
                <SelectContent>
                  {loadingUsers ? (
                    <div className="p-4 text-center">
                      <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                    </div>
                  ) : (
                    users?.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{user.username}</span>
                          <Badge variant={user.account_type === 'pro' ? 'default' : 'secondary'} className="ml-2">
                            {user.account_type}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Show user balance */}
            {selectedUser && (
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Account Type:</span>
                  <Badge variant={selectedUser.account_type === 'pro' ? 'default' : 'secondary'}>
                    {selectedUser.account_type.toUpperCase()}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Trial Balance:</span>
                  <span className="text-sm">{selectedUser.trial_balance_minutes.toFixed(2)} min</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Pro Balance:</span>
                  <span className="text-sm">{selectedUser.pro_balance_minutes.toFixed(2)} min</span>
                </div>
                <div className="flex items-center justify-between font-semibold border-t pt-2">
                  <span className="text-sm">Active Balance:</span>
                  <span className="text-sm text-primary">
                    {selectedUser.account_type === 'trial'
                      ? `${selectedUser.trial_balance_minutes.toFixed(2)} min`
                      : `${selectedUser.pro_balance_minutes.toFixed(2)} min`}
                  </span>
                </div>
              </div>
            )}

            {/* Transaction Type */}
            <div className="space-y-2">
              <Label htmlFor="type">Transaction Type</Label>
              <Select
                value={transactionType}
                onValueChange={(value) => setTransactionType(value as 'topup' | 'deduction')}
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="topup">
                    <div className="flex items-center gap-2">
                      <Plus className="h-4 w-4 text-green-600" />
                      <span>Add Credits (Top-up)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="deduction">
                    <div className="flex items-center gap-2">
                      <Minus className="h-4 w-4 text-red-600" />
                      <span>Deduct Credits</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Amount in Minutes */}
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (Minutes)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="Enter minutes (e.g., 100.00)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Enter the number of minutes to {transactionType === 'topup' ? 'add to' : 'deduct from'} the user's{' '}
                {selectedUser?.account_type === 'pro' ? 'PRO' : 'TRIAL'} balance
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description / Reason</Label>
              <Textarea
                id="description"
                placeholder="e.g., Manual adjustment for promotional campaign, Refund for issue #123, etc."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                required
              />
              <p className="text-xs text-muted-foreground">
                This will be visible to the user in their transaction history
              </p>
            </div>

            {/* Preview */}
            {selectedUser && amount && parseFloat(amount) > 0 && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-medium mb-2">Transaction Preview:</p>
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="font-medium">User:</span> {selectedUser.username} ({selectedUser.email})
                  </p>
                  <p>
                    <span className="font-medium">Type:</span>{' '}
                    <span className={transactionType === 'topup' ? 'text-green-600' : 'text-red-600'}>
                      {transactionType === 'topup' ? '+' : '-'}
                      {parseFloat(amount).toFixed(2)} min
                    </span>
                  </p>
                  <p>
                    <span className="font-medium">Balance Type:</span>{' '}
                    {selectedUser.account_type === 'pro' ? 'PRO' : 'TRIAL'}
                  </p>
                  <p>
                    <span className="font-medium">New Balance:</span>{' '}
                    {transactionType === 'topup'
                      ? (
                          (selectedUser.account_type === 'pro'
                            ? selectedUser.pro_balance_minutes
                            : selectedUser.trial_balance_minutes) + parseFloat(amount)
                        ).toFixed(2)
                      : (
                          (selectedUser.account_type === 'pro'
                            ? selectedUser.pro_balance_minutes
                            : selectedUser.trial_balance_minutes) - parseFloat(amount)
                        ).toFixed(2)}{' '}
                    min
                  </p>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSelectedUserId('');
                  setAmount('');
                  setDescription('');
                  setTransactionType('topup');
                }}
              >
                Reset
              </Button>
              <Button type="submit" disabled={createTransactionMutation.isPending || !selectedUserId}>
                {createTransactionMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Transaction
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
