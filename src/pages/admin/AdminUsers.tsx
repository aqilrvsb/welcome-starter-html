import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Mail, Clock, CreditCard, Edit, Phone, Eye, EyeOff } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

interface PhoneConfig {
  id: string;
  user_id: string;
  sip_proxy_primary: string;
  sip_proxy_secondary: string | null;
  sip_username: string;
  sip_password: string;
  sip_caller_id: string | null;
}

interface User {
  id: string;
  username: string;
  email: string;
  pro_balance_minutes: number;
  trial_balance_minutes: number;
  total_minutes_used: number;
  account_type: string;
  created_at: string;
}

export default function AdminUsers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [sipDialogOpen, setSipDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [sipConfig, setSipConfig] = useState({
    sip_proxy_primary: '',
    sip_proxy_secondary: '',
    sip_username: '',
    sip_password: '',
    sip_caller_id: '',
  });

  const { data: allUsers, isLoading } = useQuery({
    queryKey: ['admin-all-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as User[] || [];
    },
  });

  const { data: phoneConfigs } = useQuery({
    queryKey: ['admin-phone-configs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('phone_config')
        .select('*');
      if (error) throw error;
      return data as PhoneConfig[] || [];
    },
  });

  const saveSipMutation = useMutation({
    mutationFn: async ({ userId, config }: { userId: string; config: any }) => {
      // Check if config exists
      const { data: existingConfig } = await supabase
        .from('phone_config')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (existingConfig) {
        // Update existing
        const { error } = await supabase
          .from('phone_config')
          .update(config)
          .eq('user_id', userId);
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('phone_config')
          .insert({ user_id: userId, ...config });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'SIP configuration saved successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['admin-phone-configs'] });
      setSipDialogOpen(false);
      setSelectedUser(null);
      setSipConfig({
        sip_proxy_primary: '',
        sip_proxy_secondary: '',
        sip_username: '',
        sip_password: '',
        sip_caller_id: '',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save SIP configuration',
        variant: 'destructive',
      });
    },
  });

  const handleEditSip = (user: User) => {
    setSelectedUser(user);

    // Load existing SIP config if available
    const existingConfig = phoneConfigs?.find(pc => pc.user_id === user.id);
    if (existingConfig) {
      setSipConfig({
        sip_proxy_primary: existingConfig.sip_proxy_primary || '',
        sip_proxy_secondary: existingConfig.sip_proxy_secondary || '',
        sip_username: existingConfig.sip_username || '',
        sip_password: existingConfig.sip_password || '',
        sip_caller_id: existingConfig.sip_caller_id || '',
      });
    } else {
      // Set defaults
      setSipConfig({
        sip_proxy_primary: 'sip1.alienvoip.com',
        sip_proxy_secondary: 'sip3.alienvoip.com',
        sip_username: '',
        sip_password: '',
        sip_caller_id: '',
      });
    }

    setSipDialogOpen(true);
  };

  const handleSaveSip = () => {
    if (!selectedUser) return;

    // Validate required fields
    if (!sipConfig.sip_proxy_primary || !sipConfig.sip_username || !sipConfig.sip_password) {
      toast({
        title: 'Validation Error',
        description: 'Primary proxy, username, and password are required',
        variant: 'destructive',
      });
      return;
    }

    saveSipMutation.mutate({
      userId: selectedUser.id,
      config: sipConfig,
    });
  };

  const getUserSipStatus = (userId: string) => {
    const config = phoneConfigs?.find(pc => pc.user_id === userId);
    return config ? (
      <Badge variant="default" className="bg-green-500">Configured</Badge>
    ) : (
      <Badge variant="secondary">Not Configured</Badge>
    );
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 max-w-7xl">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="p-8 rounded-2xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 card-soft mb-8"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="p-3 rounded-lg bg-blue-500/10">
            <Users className="h-6 w-6 text-blue-600" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            User Management
          </h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Manage users and configure their SIP trunk settings
        </p>
      </motion.div>

      {/* Users Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Card className="card-soft">
          <CardHeader>
            <CardTitle>Registered Users ({allUsers?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center py-8 text-muted-foreground">Loading users...</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Account Type</TableHead>
                      <TableHead>Pro Minutes</TableHead>
                      <TableHead>Trial Minutes</TableHead>
                      <TableHead>SIP Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allUsers?.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.username}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            {user.email || 'N/A'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.account_type === 'pro' ? 'default' : 'secondary'}>
                            {user.account_type || 'trial'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-green-600" />
                            <span className="font-medium text-green-600">
                              {(user.pro_balance_minutes || 0).toFixed(1)} min
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-blue-600" />
                            <span className="font-medium text-blue-600">
                              {(user.trial_balance_minutes || 0).toFixed(1)} min
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getUserSipStatus(user.id)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditSip(user)}
                          >
                            <Phone className="h-4 w-4 mr-2" />
                            Configure SIP
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* SIP Configuration Dialog */}
      <Dialog open={sipDialogOpen} onOpenChange={setSipDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configure SIP Trunk for {selectedUser?.username}</DialogTitle>
            <DialogDescription>
              Set up SIP trunk configuration for this user's Pro account
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sip_proxy_primary">SIP Proxy Primary *</Label>
                <Input
                  id="sip_proxy_primary"
                  value={sipConfig.sip_proxy_primary}
                  onChange={(e) => setSipConfig({ ...sipConfig, sip_proxy_primary: e.target.value })}
                  placeholder="sip1.alienvoip.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sip_proxy_secondary">SIP Proxy Secondary</Label>
                <Input
                  id="sip_proxy_secondary"
                  value={sipConfig.sip_proxy_secondary}
                  onChange={(e) => setSipConfig({ ...sipConfig, sip_proxy_secondary: e.target.value })}
                  placeholder="sip3.alienvoip.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sip_username">SIP Username *</Label>
                <Input
                  id="sip_username"
                  value={sipConfig.sip_username}
                  onChange={(e) => setSipConfig({ ...sipConfig, sip_username: e.target.value })}
                  placeholder="646006395"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sip_password">SIP Password *</Label>
                <div className="relative">
                  <Input
                    id="sip_password"
                    type={showPassword ? "text" : "password"}
                    value={sipConfig.sip_password}
                    onChange={(e) => setSipConfig({ ...sipConfig, sip_password: e.target.value })}
                    placeholder="Enter SIP password"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sip_caller_id">Caller ID (Optional)</Label>
              <Input
                id="sip_caller_id"
                value={sipConfig.sip_caller_id}
                onChange={(e) => setSipConfig({ ...sipConfig, sip_caller_id: e.target.value })}
                placeholder="+60123456789"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSipDialogOpen(false);
                setSelectedUser(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveSip}
              disabled={saveSipMutation.isPending}
            >
              {saveSipMutation.isPending ? 'Saving...' : 'Save Configuration'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
