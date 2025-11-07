import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Eye, CheckCircle, XCircle, FileText, Building2, Image as ImageIcon, UserCheck, Phone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';

interface ProApplication {
  id: string;
  user_id: string;
  status: string;
  full_name: string | null;
  business_type: string | null;
  business_name: string | null;
  ic_number: string | null;
  whatsapp_contact: string | null;
  masking_number: string | null;
  rejection_reason: string | null;
  admin_notes: string | null;
  submitted_at: string;
  users: {
    username: string;
    email: string;
    phone_number: string | null;
  };
}

interface PhoneConfig {
  sip_proxy_primary: string;
  sip_proxy_secondary: string | null;
  sip_username: string;
  sip_password: string;
  sip_caller_id: string | null;
  sip_display_name: string | null;
  sip_codec: string;
}

export default function AdminWaitingList() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState<ProApplication[]>([]);
  const [selectedApp, setSelectedApp] = useState<ProApplication | null>(null);
  const [processing, setProcessing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sipDialogOpen, setSipDialogOpen] = useState(false);

  // Review form state
  const [reviewStatus, setReviewStatus] = useState<'approved' | 'rejected'>('approved');
  const [rejectionReason, setRejectionReason] = useState('');
  const [adminNotes, setAdminNotes] = useState('');

  // SIP config form state
  const [sipConfig, setSipConfig] = useState<PhoneConfig>({
    sip_proxy_primary: 'sip1.alienvoip.com',
    sip_proxy_secondary: 'sip3.alienvoip.com',
    sip_username: '',
    sip_password: '',
    sip_caller_id: '',
    sip_display_name: '',
    sip_codec: 'ulaw',
  });

  useEffect(() => {
    loadApplications();
  }, []);

  const loadApplications = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('pro_applications')
        .select(`
          *,
          users!pro_applications_user_id_fkey (
            username,
            email,
            phone_number
          )
        `)
        .order('submitted_at', { ascending: false });

      if (error) throw error;

      setApplications(data as any);
    } catch (error: any) {
      console.error('Error loading applications:', error);
      toast({
        title: 'Error',
        description: 'Failed to load applications',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewApplication = (app: ProApplication) => {
    setSelectedApp(app);
    setReviewStatus(app.status === 'rejected' ? 'rejected' : 'approved');
    setRejectionReason(app.rejection_reason || '');
    setAdminNotes(app.admin_notes || '');
    setDialogOpen(true);
  };

  const handleReviewSubmit = async () => {
    if (!selectedApp) return;

    if (reviewStatus === 'rejected' && !rejectionReason.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a rejection reason',
        variant: 'destructive',
      });
      return;
    }

    try {
      setProcessing(true);

      const updateData: any = {
        status: reviewStatus,
        admin_notes: adminNotes.trim() || null,
        rejection_reason: reviewStatus === 'rejected' ? rejectionReason.trim() : null,
        reviewed_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('pro_applications')
        .update(updateData)
        .eq('id', selectedApp.id);

      if (error) throw error;

      // If approved, also upgrade user account type
      if (reviewStatus === 'approved') {
        const { error: userError } = await supabase
          .from('users')
          .update({ account_type: 'pro' })
          .eq('id', selectedApp.user_id);

        if (userError) throw userError;
      }

      toast({
        title: 'Success',
        description: `Application ${reviewStatus}`,
      });

      setDialogOpen(false);
      await loadApplications();
    } catch (error: any) {
      console.error('Error reviewing application:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update application',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleOpenSipConfig = async (app: ProApplication) => {
    setSelectedApp(app);

    // Load existing SIP config if any
    const { data: existingConfig } = await supabase
      .from('phone_config')
      .select('*')
      .eq('user_id', app.user_id)
      .maybeSingle();

    if (existingConfig) {
      setSipConfig({
        sip_proxy_primary: existingConfig.sip_proxy_primary || 'sip1.alienvoip.com',
        sip_proxy_secondary: existingConfig.sip_proxy_secondary || 'sip3.alienvoip.com',
        sip_username: existingConfig.sip_username || '',
        sip_password: existingConfig.sip_password || '',
        sip_caller_id: existingConfig.sip_caller_id || '',
        sip_display_name: existingConfig.sip_display_name || '',
        sip_codec: existingConfig.sip_codec || 'ulaw',
      });
    } else {
      // Reset to defaults
      setSipConfig({
        sip_proxy_primary: 'sip1.alienvoip.com',
        sip_proxy_secondary: 'sip3.alienvoip.com',
        sip_username: '',
        sip_password: '',
        sip_caller_id: '',
        sip_display_name: '',
        sip_codec: 'ulaw',
      });
    }

    setSipDialogOpen(true);
  };

  const handleSaveSipConfig = async () => {
    if (!selectedApp) return;

    if (!sipConfig.sip_username || !sipConfig.sip_password) {
      toast({
        title: 'Validation Error',
        description: 'SIP Username and Password are required',
        variant: 'destructive',
      });
      return;
    }

    try {
      setProcessing(true);

      // Check if phone_config already exists
      const { data: existingConfig } = await supabase
        .from('phone_config')
        .select('id')
        .eq('user_id', selectedApp.user_id)
        .maybeSingle();

      const phoneConfigData = {
        freeswitch_url: 'http://68.183.177.218',
        mikopbx_ami_username: 'admin',
        ...sipConfig,
        updated_at: new Date().toISOString(),
      };

      if (existingConfig) {
        // Update existing
        const { error } = await supabase
          .from('phone_config')
          .update(phoneConfigData)
          .eq('user_id', selectedApp.user_id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('phone_config')
          .insert({
            user_id: selectedApp.user_id,
            ...phoneConfigData,
          });

        if (error) throw error;
      }

      // Update sip_configured to true when SIP is configured
      const { error: userError } = await supabase
        .from('users')
        .update({ sip_configured: true })
        .eq('id', selectedApp.user_id);

      if (userError) throw userError;

      toast({
        title: 'Success',
        description: 'SIP configuration saved successfully',
      });

      setSipDialogOpen(false);
    } catch (error: any) {
      console.error('Error saving SIP config:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save SIP configuration',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    under_review: 'bg-blue-100 text-blue-800 border-blue-300',
    approved: 'bg-green-100 text-green-800 border-green-300',
    rejected: 'bg-red-100 text-red-800 border-red-300',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Pro Account Waiting List</h1>
        <p className="text-muted-foreground mt-2">
          Review and approve Pro account applications from clients
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Applications ({applications.length})</CardTitle>
          <CardDescription>Manage client Pro account applications</CardDescription>
        </CardHeader>
        <CardContent>
          {applications.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No applications yet
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell className="font-medium">{app.users.username}</TableCell>
                    <TableCell>{app.users.email}</TableCell>
                    <TableCell>
                      {format(parseISO(app.submitted_at), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusColors[app.status] || ''}
                      >
                        {app.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewApplication(app)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Review
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenSipConfig(app)}
                        >
                          <Phone className="h-4 w-4 mr-1" />
                          SIP Config
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Review Application Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Application</DialogTitle>
            <DialogDescription>
              Review documents and approve/reject the Pro account application
            </DialogDescription>
          </DialogHeader>

          {selectedApp && (
            <div className="space-y-6">
              {/* Client Info */}
              <div className="p-4 bg-muted rounded-lg">
                <h3 className="font-semibold mb-2">Client Information</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Username:</span> {selectedApp.users.username}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Email:</span> {selectedApp.users.email}
                  </div>
                  {selectedApp.users.phone_number && (
                    <div>
                      <span className="text-muted-foreground">Phone:</span> {selectedApp.users.phone_number}
                    </div>
                  )}
                </div>
              </div>

              {/* Application Details */}
              <div className="space-y-3">
                <h3 className="font-semibold">Application Details</h3>
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                  <div>
                    <span className="text-sm text-muted-foreground">Full Name:</span>
                    <p className="font-medium">{selectedApp.full_name || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Jenis Bisnes:</span>
                    <p className="font-medium">{selectedApp.business_type || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Nama Bisnes:</span>
                    <p className="font-medium">{selectedApp.business_name || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">IC:</span>
                    <p className="font-medium">{selectedApp.ic_number || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Whatsapp Contact:</span>
                    <p className="font-medium">{selectedApp.whatsapp_contact || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">No Untuk Masking:</span>
                    <p className="font-medium">{selectedApp.masking_number || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Review Form */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Decision</Label>
                  <Select
                    value={reviewStatus}
                    onValueChange={(value: 'approved' | 'rejected') => setReviewStatus(value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="approved">Approve</SelectItem>
                      <SelectItem value="rejected">Reject</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {reviewStatus === 'rejected' && (
                  <div className="space-y-2">
                    <Label>Rejection Reason *</Label>
                    <Textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Explain why the application is rejected..."
                      rows={3}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Admin Notes (Optional)</Label>
                  <Textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Any additional notes for the client..."
                    rows={2}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={processing}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleReviewSubmit}
                  disabled={processing}
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      {reviewStatus === 'approved' ? (
                        <CheckCircle className="w-4 h-4 mr-2" />
                      ) : (
                        <XCircle className="w-4 h-4 mr-2" />
                      )}
                      {reviewStatus === 'approved' ? 'Approve' : 'Reject'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* SIP Configuration Dialog */}
      <Dialog open={sipDialogOpen} onOpenChange={setSipDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configure SIP Trunk</DialogTitle>
            <DialogDescription>
              Set up SIP configuration for {selectedApp?.users.username}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>SIP Proxy Primary *</Label>
                <Input
                  value={sipConfig.sip_proxy_primary}
                  onChange={(e) =>
                    setSipConfig({ ...sipConfig, sip_proxy_primary: e.target.value })
                  }
                  placeholder="sip1.alienvoip.com"
                />
              </div>
              <div className="space-y-2">
                <Label>SIP Proxy Secondary</Label>
                <Input
                  value={sipConfig.sip_proxy_secondary || ''}
                  onChange={(e) =>
                    setSipConfig({ ...sipConfig, sip_proxy_secondary: e.target.value })
                  }
                  placeholder="sip3.alienvoip.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>SIP Username *</Label>
                <Input
                  value={sipConfig.sip_username}
                  onChange={(e) =>
                    setSipConfig({ ...sipConfig, sip_username: e.target.value })
                  }
                  placeholder="Enter SIP username"
                />
              </div>
              <div className="space-y-2">
                <Label>SIP Password *</Label>
                <Input
                  type="password"
                  value={sipConfig.sip_password}
                  onChange={(e) =>
                    setSipConfig({ ...sipConfig, sip_password: e.target.value })
                  }
                  placeholder="Enter SIP password"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Caller ID</Label>
                <Input
                  value={sipConfig.sip_caller_id || ''}
                  onChange={(e) =>
                    setSipConfig({ ...sipConfig, sip_caller_id: e.target.value })
                  }
                  placeholder="+60123456789"
                />
              </div>
              <div className="space-y-2">
                <Label>Display Name</Label>
                <Input
                  value={sipConfig.sip_display_name || ''}
                  onChange={(e) =>
                    setSipConfig({ ...sipConfig, sip_display_name: e.target.value })
                  }
                  placeholder="Company Name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Codec</Label>
              <Select
                value={sipConfig.sip_codec}
                onValueChange={(value) => setSipConfig({ ...sipConfig, sip_codec: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ulaw">ulaw (G.711)</SelectItem>
                  <SelectItem value="alaw">alaw (G.711a)</SelectItem>
                  <SelectItem value="gsm">GSM</SelectItem>
                  <SelectItem value="g729">G.729</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <Button
                variant="outline"
                onClick={() => setSipDialogOpen(false)}
                disabled={processing}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveSipConfig} disabled={processing}>
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Save Configuration
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
