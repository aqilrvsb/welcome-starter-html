import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Loader2,
  Upload,
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { useCustomAuth } from '@/contexts/CustomAuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ProApplication {
  id: string;
  status: 'pending' | 'under_review' | 'approved' | 'rejected';
  full_name: string | null;
  business_type: string | null;
  business_name: string | null;
  ic_number: string | null;
  whatsapp_contact: string | null;
  masking_number: string | null;
  rejection_reason: string | null;
  admin_notes: string | null;
  submitted_at: string;
}

const statusConfig = {
  pending: {
    label: 'Pending Review',
    icon: Clock,
    color: 'bg-yellow-500',
    textColor: 'text-yellow-600',
    description: 'Your application is waiting for admin review',
  },
  under_review: {
    label: 'Under Review',
    icon: AlertCircle,
    color: 'bg-blue-500',
    textColor: 'text-blue-600',
    description: 'Admin is reviewing your application',
  },
  approved: {
    label: 'Approved',
    icon: CheckCircle2,
    color: 'bg-green-500',
    textColor: 'text-green-600',
    description: 'Your Pro account is approved!',
  },
  rejected: {
    label: 'Rejected',
    icon: XCircle,
    color: 'bg-red-500',
    textColor: 'text-red-600',
    description: 'Application rejected. Please resubmit',
  },
};

export function ProApplicationForm() {
  const { user } = useCustomAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [application, setApplication] = useState<ProApplication | null>(null);
  const [sipConfigured, setSipConfigured] = useState(false);

  // Form states
  const [fullName, setFullName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [icNumber, setIcNumber] = useState('');
  const [whatsappContact, setWhatsappContact] = useState('');
  const [maskingNumber, setMaskingNumber] = useState('');

  useEffect(() => {
    if (user) {
      loadApplication();
      checkSipConfigured();
    }
  }, [user]);

  const checkSipConfigured = async () => {
    if (!user) return;

    try {
      // Check if user has SIP credentials in phone_config
      const { data, error } = await supabase
        .from('phone_config')
        .select('sip_username, sip_password')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      // User is configured if they have both username and password
      const hasCredentials = data && data.sip_username && data.sip_password;
      setSipConfigured(!!hasCredentials);
    } catch (error: any) {
      console.error('Error checking SIP configuration:', error);
    }
  };

  const loadApplication = async () => {
    if (!user) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('pro_applications')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      setApplication(data);

      // Load existing form data if application exists
      if (data) {
        setFullName(data.full_name || '');
        setBusinessType(data.business_type || '');
        setBusinessName(data.business_name || '');
        setIcNumber(data.ic_number || '');
        setWhatsappContact(data.whatsapp_contact || '');
        setMaskingNumber(data.masking_number || '');
      }
    } catch (error: any) {
      console.error('Error loading application:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;

    // Validate form fields
    if (!fullName.trim() || !businessType.trim() || !businessName.trim() ||
        !icNumber.trim() || !whatsappContact.trim() || !maskingNumber.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      const applicationData = {
        full_name: fullName.trim(),
        business_type: businessType.trim(),
        business_name: businessName.trim(),
        ic_number: icNumber.trim(),
        whatsapp_contact: whatsappContact.trim(),
        masking_number: maskingNumber.trim(),
        status: 'pending',
        submitted_at: new Date().toISOString(),
      };

      // Check if application exists
      if (application) {
        // Update existing
        const { error } = await supabase
          .from('pro_applications')
          .update(applicationData)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('pro_applications')
          .insert({
            user_id: user.id,
            ...applicationData,
          });

        if (error) throw error;
      }

      toast({
        title: 'Success',
        description: 'Pro account application submitted successfully!',
      });

      // Reload application
      await loadApplication();
    } catch (error: any) {
      console.error('Error submitting application:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit application',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  // Show success message if SIP is configured by admin
  if (sipConfigured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Pro Account Configured
            <Badge className="bg-green-500">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Configured
            </Badge>
          </CardTitle>
          <CardDescription>Your Pro account has been successfully configured!</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              <strong>Great news!</strong> Your SIP configuration has been set up by our admin. You can now start making calls using your Pro account at RM0.15 per minute.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Show application status if exists
  if (application && application.status !== 'rejected') {
    const config = statusConfig[application.status];
    const StatusIcon = config.icon;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Pro Account Application Status
            <Badge className={config.color}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {config.label}
            </Badge>
          </CardTitle>
          <CardDescription>{config.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {application.admin_notes && (
            <Alert>
              <AlertDescription>
                <strong>Admin Notes:</strong> {application.admin_notes}
              </AlertDescription>
            </Alert>
          )}

          {application.status === 'approved' && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Your Pro account is now active! Please contact admin to configure your SIP settings, then you can start making calls.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    );
  }

  // Show application form
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pro Account Application</CardTitle>
        <CardDescription>
          Fill in the form below to apply for a Pro account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="full-name">Full Name *</Label>
              <Input
                id="full-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
                required
              />
            </div>

            {/* Business Type */}
            <div className="space-y-2">
              <Label htmlFor="business-type">Jenis Bisnes *</Label>
              <Input
                id="business-type"
                type="text"
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                placeholder="E.g., Retail, Services, Manufacturing"
                required
              />
            </div>

            {/* Business Name */}
            <div className="space-y-2">
              <Label htmlFor="business-name">Nama Bisnes *</Label>
              <Input
                id="business-name"
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Enter your business name"
                required
              />
            </div>

            {/* IC Number */}
            <div className="space-y-2">
              <Label htmlFor="ic-number">IC *</Label>
              <Input
                id="ic-number"
                type="text"
                value={icNumber}
                onChange={(e) => setIcNumber(e.target.value)}
                placeholder="E.g., 123456-12-1234"
                required
              />
            </div>

            {/* WhatsApp Contact */}
            <div className="space-y-2">
              <Label htmlFor="whatsapp">Whatsapp Contact *</Label>
              <Input
                id="whatsapp"
                type="text"
                value={whatsappContact}
                onChange={(e) => setWhatsappContact(e.target.value)}
                placeholder="E.g., 60123456789"
                required
              />
            </div>

            {/* Masking Number */}
            <div className="space-y-2">
              <Label htmlFor="masking-number">No Untuk Masking *</Label>
              <Input
                id="masking-number"
                type="text"
                value={maskingNumber}
                onChange={(e) => setMaskingNumber(e.target.value)}
                placeholder="E.g., 60387654321"
                required
              />
            </div>
          </div>

          <Alert>
            <AlertDescription>
              After submission, please wait for admin approval. Once approved, your SIP configuration will be set up and you can start using your Pro account.
            </AlertDescription>
          </Alert>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting Application...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Submit Application
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
