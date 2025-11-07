import { useState, useEffect } from 'react';
import { useCustomAuth } from '@/contexts/CustomAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  MessageCircle, 
  ArrowLeft, 
  QrCode,
  CheckCircle,
  XCircle,
  RefreshCw,
  Smartphone,
  Loader2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import TemplateForm from '@/components/whatsapp/TemplateForm';

export default function Whatsapp() {
  const { user } = useCustomAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [checking, setChecking] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('disconnected');
  const [sessionName, setSessionName] = useState<string>('');

  // Load status on mount
  useEffect(() => {
    if (user?.id) {
      loadStatus();
    }
  }, [user]);

  // Auto-refresh status every 5 seconds when scanning
  useEffect(() => {
    if (status === 'scan_qr_code' || status === 'starting') {
      const interval = setInterval(() => {
        checkStatus();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [status]);

  const loadStatus = async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('phone_config')
        .select('waha_session_name, connection_status')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (data && !error) {
        setSessionName(data.waha_session_name || '');
        setStatus(data.connection_status || 'disconnected');
      }
    } catch (error) {
      console.error('Error loading status:', error);
    }
  };

  const scanQR = async () => {
    if (!user?.id) return;
    
    setScanning(true);
    setQrCode(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('waha-scan-qr', {
        body: { user_id: user.id }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: 'Session Created',
          description: 'Please scan the QR code with WhatsApp to connect.',
        });
        await checkStatus();
      } else {
        throw new Error(data.error || 'Failed to create session');
      }
    } catch (error: any) {
      console.error('Error scanning QR:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to initiate QR scan.',
        variant: 'destructive',
      });
    } finally {
      setScanning(false);
    }
  };

  const checkStatus = async () => {
    if (!user?.id) return;
    
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke('waha-check-status', {
        body: { user_id: user.id }
      });

      if (error) throw error;

      if (data.message) {
        // Show message from server (e.g., "No active session")
        toast({
          title: 'Status',
          description: data.message,
        });
      } else if (data.status) {
        toast({
          title: 'Status Updated',
          description: `Current status: ${data.status}`,
        });
      }
      
      if (data.status) {
        setStatus(data.status);
        setQrCode(data.qr_code || null);
        await loadStatus();
      }
    } catch (error: any) {
      console.error('Error checking status:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to check status.',
        variant: 'destructive',
      });
    } finally {
      setChecking(false);
    }
  };

  const disconnect = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('waha-disconnect', {
        body: { user_id: user.id }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: 'Disconnected',
          description: 'WhatsApp has been disconnected successfully.',
        });
        setQrCode(null);
        setStatus('disconnected');
        setSessionName('');
        await loadStatus();
      }
    } catch (error: any) {
      console.error('Error disconnecting:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to disconnect.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'connected':
      case 'WORKING':
        return <Badge className="bg-green-500"><CheckCircle className="mr-1 h-3 w-3" /> Connected</Badge>;
      case 'scan_qr_code':
      case 'SCAN_QR_CODE':
        return <Badge variant="secondary"><QrCode className="mr-1 h-3 w-3" /> Scan QR Code</Badge>;
      case 'starting':
      case 'STARTING':
        return <Badge variant="secondary"><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Starting...</Badge>;
      case 'disconnected':
      default:
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" /> Disconnected</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main>
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <Link 
              to="/dashboard" 
              className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-3 mb-2">
                  <div className="hero-gradient p-2 rounded-lg">
                    <MessageCircle className="h-6 w-6 text-white" />
                  </div>
                  <h1 className="text-3xl font-bold text-foreground">WhatsApp Management</h1>
                </div>
                <p className="text-muted-foreground">
                  Connect and manage your WhatsApp integration using WAHA
                </p>
              </div>
              <div>
                {getStatusBadge()}
              </div>
            </div>
          </div>

          {/* Connection Status Card */}
          <div className="max-w-2xl mx-auto mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Smartphone className="h-5 w-5" />
                  <span>Connection Status</span>
                </CardTitle>
                <CardDescription>
                  Manage your WhatsApp connection
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {sessionName && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm font-medium">Session Name</p>
                    <p className="text-sm text-muted-foreground font-mono">{sessionName}</p>
                  </div>
                )}

                {status === 'disconnected' && (
                  <Alert>
                    <AlertDescription>
                      Click the button below to start the connection process and scan the QR code with WhatsApp.
                    </AlertDescription>
                  </Alert>
                )}

                {qrCode && (
                  <div className="flex flex-col items-center space-y-4 p-4 bg-muted rounded-lg">
                    <p className="text-sm font-medium">Scan this QR code with WhatsApp:</p>
                    <img 
                      src={qrCode} 
                      alt="WhatsApp QR Code" 
                      className="w-64 h-64 border-4 border-background rounded-lg"
                    />
                    <p className="text-xs text-muted-foreground text-center">
                      Open WhatsApp → Settings → Linked Devices → Link a Device
                    </p>
                  </div>
                )}

                <div className="flex flex-col space-y-2">
                  {status === 'disconnected' && (
                    <Button 
                      onClick={scanQR} 
                      disabled={scanning}
                      className="w-full"
                      size="lg"
                    >
                      <QrCode className="mr-2 h-4 w-4" />
                      {scanning ? 'Creating Session...' : 'Scan QR Code'}
                    </Button>
                  )}

                  {(status === 'connected' || status === 'WORKING') && (
                    <Button 
                      onClick={disconnect} 
                      disabled={loading}
                      variant="destructive"
                      className="w-full"
                      size="lg"
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      {loading ? 'Disconnecting...' : 'Disconnect WhatsApp'}
                    </Button>
                  )}

                  <Button 
                    onClick={checkStatus} 
                    variant="outline"
                    className="w-full"
                    disabled={checking}
                  >
                    <RefreshCw className={`mr-2 h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
                    {checking ? 'Checking...' : 'Check Status'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* WhatsApp Message Templates */}
          <div className="max-w-7xl mx-auto mt-6">
            <TemplateForm />
          </div>
        </div>
      </main>
    </div>
  );
}
