import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Loader2,
  Upload,
  FileText,
  Building2,
  Image as ImageIcon,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  FileCheck,
} from 'lucide-react';
import { useCustomAuth } from '@/contexts/CustomAuthContext';
import { useToast } from '@/hooks/use-toast';
import { useDynamicPricing } from '@/hooks/useDynamicPricing';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { motion } from 'framer-motion';

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
  created_at: string;
  updated_at: string;
}

const statusConfig = {
  pending: {
    label: 'Pending Review',
    icon: Clock,
    color: 'bg-yellow-500',
    textColor: 'text-yellow-600',
    description: 'Your application has been submitted and is waiting for admin review',
  },
  under_review: {
    label: 'Under Review',
    icon: AlertCircle,
    color: 'bg-blue-500',
    textColor: 'text-blue-600',
    description: 'Admin is currently reviewing your application',
  },
  approved: {
    label: 'Approved',
    icon: CheckCircle2,
    color: 'bg-green-500',
    textColor: 'text-green-600',
    description: 'Your Pro account has been approved! You can now top up and make calls',
  },
  rejected: {
    label: 'Rejected',
    icon: XCircle,
    color: 'bg-red-500',
    textColor: 'text-red-600',
    description: 'Your application was rejected. Please review the reason below and resubmit',
  },
};

export default function ProApplication() {
  const { user } = useCustomAuth();
  const { toast } = useToast();
  const { pricingPerMinute } = useDynamicPricing();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
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
      toast({
        title: 'Error',
        description: 'Failed to load application status',
        variant: 'destructive',
      });
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
      setUploadProgress(0);

      // Upload files
      setUploadProgress(10);
      const registrationServiceUrl = await uploadFile(registrationServiceFile, 'registration_service');

      setUploadProgress(30);
      const companyRegistrationUrl = await uploadFile(companyRegistrationFile, 'company_registration');

      setUploadProgress(50);
      const ssmUrl = await uploadFile(ssmFile, 'ssm_document');

      setUploadProgress(70);
      const telcoProfileUrl = await uploadFile(telcoProfileFile, 'telco_profile');

      setUploadProgress(85);

      // Create or update application
      const applicationData = {
        user_id: user.id,
        status: 'pending',
        registration_service_form_url: registrationServiceUrl,
        company_registration_form_url: companyRegistrationUrl,
        ssm_document_url: ssmUrl,
        telco_profile_image_url: telcoProfileUrl,
        submitted_at: new Date().toISOString(),
      };

      if (application) {
        // Update existing application (resubmit)
        const { error } = await supabase
          .from('pro_applications')
          .update(applicationData)
          .eq('id', application.id);

        if (error) throw error;
      } else {
        // Create new application
        const { error } = await supabase
          .from('pro_applications')
          .insert(applicationData);

        if (error) throw error;
      }

      setUploadProgress(100);

      toast({
        title: 'Success',
        description: 'Your Pro account application has been submitted!',
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
      setUploadProgress(0);
    }
  };

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<File | null>>
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      setter(file);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </div>
    );
  }

  // If application exists and is approved or pending, show status
  const showForm = !application || application.status === 'rejected';
  const statusInfo = application ? statusConfig[application.status] : null;

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="p-8 rounded-2xl gradient-card card-soft"
      >
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-primary-light to-primary-dark bg-clip-text text-transparent mb-3">
          Pro Account Application
        </h1>
        <p className="text-muted-foreground text-lg">
          Apply for a Pro account to access unlimited calling at RM{pricingPerMinute.toFixed(2)}/minute
        </p>
      </motion.div>

      {/* Application Status Card */}
      {application && statusInfo && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="card-soft">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <statusInfo.icon className={`h-5 w-5 ${statusInfo.textColor}`} />
                  Application Status
                </CardTitle>
                <Badge className={`${statusInfo.color} text-white`}>
                  {statusInfo.label}
                </Badge>
              </div>
              <CardDescription>{statusInfo.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {application.status === 'pending' || application.status === 'under_review' ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Waiting for admin configuration...</span>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <Progress value={application.status === 'under_review' ? 60 : 30} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    Submitted on {format(parseISO(application.submitted_at), 'MMM dd, yyyy HH:mm')}
                  </p>
                </div>
              ) : null}

              {application.status === 'approved' && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    <p className="font-semibold mb-1">Congratulations! Your Pro account is active.</p>
                    <p className="text-sm">
                      Your SIP configuration has been set up by the admin. You can now top up credits and start making calls!
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              {application.status === 'rejected' && application.rejection_reason && (
                <Alert className="border-red-200 bg-red-50">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    <p className="font-semibold mb-1">Rejection Reason:</p>
                    <p className="text-sm">{application.rejection_reason}</p>
                    <p className="text-sm mt-2">Please correct the issues and resubmit your application below.</p>
                  </AlertDescription>
                </Alert>
              )}

              {application.admin_notes && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-medium text-blue-900 mb-1">Admin Notes:</p>
                  <p className="text-sm text-blue-700">{application.admin_notes}</p>
                </div>
              )}

              {/* Show uploaded documents */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-4 border-t">
                {application.registration_service_form_url && (
                  <div className="flex items-center gap-2 p-2 bg-green-50 rounded border border-green-200">
                    <FileCheck className="h-4 w-4 text-green-600" />
                    <span className="text-xs text-green-700">Service Form</span>
                  </div>
                )}
                {application.company_registration_form_url && (
                  <div className="flex items-center gap-2 p-2 bg-green-50 rounded border border-green-200">
                    <FileCheck className="h-4 w-4 text-green-600" />
                    <span className="text-xs text-green-700">Company Reg</span>
                  </div>
                )}
                {application.ssm_document_url && (
                  <div className="flex items-center gap-2 p-2 bg-green-50 rounded border border-green-200">
                    <FileCheck className="h-4 w-4 text-green-600" />
                    <span className="text-xs text-green-700">SSM</span>
                  </div>
                )}
                {application.telco_profile_image_url && (
                  <div className="flex items-center gap-2 p-2 bg-green-50 rounded border border-green-200">
                    <FileCheck className="h-4 w-4 text-green-600" />
                    <span className="text-xs text-green-700">Telco Profile</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Application Form */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="card-medium">
            <CardHeader>
              <CardTitle>
                {application?.status === 'rejected' ? 'Resubmit Application' : 'Submit Application'}
              </CardTitle>
              <CardDescription>
                Upload the following 4 documents to complete your Pro account application
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* File Upload Fields */}
                <div className="space-y-4">
                  {/* 1. Registration Service Form */}
                  <div className="space-y-2">
                    <Label htmlFor="registration-service" className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      1. Registration Service Form (PDF) *
                    </Label>
                    <Input
                      id="registration-service"
                      type="file"
                      accept=".pdf"
                      onChange={(e) => handleFileChange(e, setRegistrationServiceFile)}
                      required={!application}
                    />
                    {registrationServiceFile && (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        {registrationServiceFile.name}
                      </p>
                    )}
                  </div>

                  {/* 2. Company Registration Form */}
                  <div className="space-y-2">
                    <Label htmlFor="company-registration" className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      2. Company Registration Form (PDF) *
                    </Label>
                    <Input
                      id="company-registration"
                      type="file"
                      accept=".pdf"
                      onChange={(e) => handleFileChange(e, setCompanyRegistrationFile)}
                      required={!application}
                    />
                    {companyRegistrationFile && (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        {companyRegistrationFile.name}
                      </p>
                    )}
                  </div>

                  {/* 3. SSM Document */}
                  <div className="space-y-2">
                    <Label htmlFor="ssm" className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      3. SSM Document (PDF) *
                    </Label>
                    <Input
                      id="ssm"
                      type="file"
                      accept=".pdf"
                      onChange={(e) => handleFileChange(e, setSsmFile)}
                      required={!application}
                    />
                    {ssmFile && (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        {ssmFile.name}
                      </p>
                    )}
                  </div>

                  {/* 4. Telco Profile Image */}
                  <div className="space-y-2">
                    <Label htmlFor="telco-profile" className="flex items-center gap-2">
                      <ImageIcon className="h-4 w-4" />
                      4. Profile Telco App (Image: JPG/PNG) *
                    </Label>
                    <Input
                      id="telco-profile"
                      type="file"
                      accept="image/jpeg,image/jpg,image/png"
                      onChange={(e) => handleFileChange(e, setTelcoProfileFile)}
                      required={!application}
                    />
                    {telcoProfileFile && (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        {telcoProfileFile.name}
                      </p>
                    )}
                  </div>
                </div>

                {/* Upload Progress */}
                {submitting && uploadProgress > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Uploading documents...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} className="h-2" />
                  </div>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting Application...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      {application?.status === 'rejected' ? 'Resubmit Application' : 'Submit Application'}
                    </>
                  )}
                </Button>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    After submission, please wait for admin approval. Once approved, your SIP configuration
                    will be set up and you can start using your Pro account.
                  </AlertDescription>
                </Alert>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
