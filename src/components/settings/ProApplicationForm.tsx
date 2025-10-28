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
  registration_service_form_url: string | null;
  company_registration_form_url: string | null;
  ssm_document_url: string | null;
  telco_profile_image_url: string | null;
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

  // File states
  const [registrationServiceFile, setRegistrationServiceFile] = useState<File | null>(null);
  const [companyRegistrationFile, setCompanyRegistrationFile] = useState<File | null>(null);
  const [ssmFile, setSsmFile] = useState<File | null>(null);
  const [telcoProfileFile, setTelcoProfileFile] = useState<File | null>(null);

  useEffect(() => {
    if (user) {
      loadApplication();
    }
  }, [user]);

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
    } catch (error: any) {
      console.error('Error loading application:', error);
    } finally {
      setLoading(false);
    }
  };

  const uploadFile = async (file: File, folder: string): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${user!.id}/${folder}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('pro-applications')
      .upload(filePath, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('pro-applications')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;

    // Validate files
    if (!registrationServiceFile || !companyRegistrationFile || !ssmFile || !telcoProfileFile) {
      toast({
        title: 'Missing Files',
        description: 'Please upload all 4 required documents',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      // Upload files
      const [regServiceUrl, companyRegUrl, ssmUrl, telcoUrl] = await Promise.all([
        uploadFile(registrationServiceFile, 'registration_service_form'),
        uploadFile(companyRegistrationFile, 'company_registration_form'),
        uploadFile(ssmFile, 'ssm_document'),
        uploadFile(telcoProfileFile, 'telco_profile_image'),
      ]);

      // Check if application exists
      if (application) {
        // Update existing
        const { error } = await supabase
          .from('pro_applications')
          .update({
            registration_service_form_url: regServiceUrl,
            company_registration_form_url: companyRegUrl,
            ssm_document_url: ssmUrl,
            telco_profile_image_url: telcoUrl,
            status: 'pending',
            submitted_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('pro_applications')
          .insert({
            user_id: user.id,
            registration_service_form_url: regServiceUrl,
            company_registration_form_url: companyRegUrl,
            ssm_document_url: ssmUrl,
            telco_profile_image_url: telcoUrl,
            status: 'pending',
            submitted_at: new Date().toISOString(),
          });

        if (error) throw error;
      }

      toast({
        title: 'Success',
        description: 'Pro account application submitted successfully!',
      });

      // Reload application
      await loadApplication();

      // Clear files
      setRegistrationServiceFile(null);
      setCompanyRegistrationFile(null);
      setSsmFile(null);
      setTelcoProfileFile(null);
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
          Upload the following 4 documents to apply for a Pro account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            {/* Document 1 */}
            <div className="space-y-2">
              <Label htmlFor="reg-service">
                <FileText className="w-4 h-4 inline mr-2" />
                1. Registration Service Form (PDF) *
              </Label>
              <Input
                id="reg-service"
                type="file"
                accept="application/pdf"
                onChange={(e) => setRegistrationServiceFile(e.target.files?.[0] || null)}
                required
              />
            </div>

            {/* Document 2 */}
            <div className="space-y-2">
              <Label htmlFor="company-reg">
                <FileText className="w-4 h-4 inline mr-2" />
                2. Company Registration Form (PDF) *
              </Label>
              <Input
                id="company-reg"
                type="file"
                accept="application/pdf"
                onChange={(e) => setCompanyRegistrationFile(e.target.files?.[0] || null)}
                required
              />
            </div>

            {/* Document 3 */}
            <div className="space-y-2">
              <Label htmlFor="ssm">
                <FileText className="w-4 h-4 inline mr-2" />
                3. SSM Document (PDF) *
              </Label>
              <Input
                id="ssm"
                type="file"
                accept="application/pdf"
                onChange={(e) => setSsmFile(e.target.files?.[0] || null)}
                required
              />
            </div>

            {/* Document 4 */}
            <div className="space-y-2">
              <Label htmlFor="telco">
                <Upload className="w-4 h-4 inline mr-2" />
                4. Profile Telco App (Image: JPG/PNG) *
              </Label>
              <Input
                id="telco"
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                onChange={(e) => setTelcoProfileFile(e.target.files?.[0] || null)}
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
