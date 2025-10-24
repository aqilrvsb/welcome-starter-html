import { useState, useEffect } from 'react';
import { useCustomAuth } from '@/contexts/CustomAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Settings as SettingsIcon,
  ArrowLeft,
  User,
  Bell,
  Shield,
  CreditCard,
  Trash2,
  Save,
  Key,
  Lock
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { AiConfigForm } from '@/components/settings/AiConfigForm';
import { ChangePasswordSection } from '@/components/ChangePasswordSection';
import { BillingSection } from '@/components/billing/BillingSection';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';


export default function Settings() {
  const { user, signOut } = useCustomAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [profile, setProfile] = useState({
    email: '',
    username: '',
    phone_number: '',
  });

  // Load user data on mount
  useEffect(() => {
    const loadUserData = async () => {
      if (!user?.id) return;
      
      try {
        const { data, error } = await supabase
          .from('users')
          .select('email, username, phone_number')
          .eq('id', user.id)
          .maybeSingle();

        if (data && !error) {
          setProfile(prev => ({
            ...prev,
            email: data.email || '',
            username: data.username || '',
            phone_number: data.phone_number || '',
          }));
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };
    
    loadUserData();
  }, [user]);

  const [notifications, setNotifications] = useState({
    callAlerts: true,
    emailReports: true,
    maintenanceUpdates: false,
    marketingEmails: false,
  });

  const [privacy, setPrivacy] = useState({
    callRecording: true,
    dataRetention: '90',
    anonymizeData: false,
  });

  const handleSaveProfile = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      // Validate username
      if (profile.username && profile.username.length < 3) {
        toast({
          title: 'Invalid Username',
          description: 'Username must be at least 3 characters.',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // Update user username and phone_number in users table (email cannot be changed)
      const { error } = await supabase
        .from('users')
        .update({
          username: profile.username || null,
          phone_number: profile.phone_number || null
        })
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: 'Profile Updated',
        description: 'Your profile has been updated successfully.',
      });
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update profile. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNotifications = async () => {
    setLoading(true);
    try {
      // TODO: Update notification preferences
      toast({
        title: 'Preferences Updated',
        description: 'Your notification preferences have been saved.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update preferences. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main>
        <div className="container mx-auto px-4 py-8">
          {/* Back Link */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-4"
          >
            <Link
              to="/dashboard"
              className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-smooth px-3 py-2 rounded-lg hover:bg-primary/5"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </motion.div>

          {/* Header with gradient */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] as any }}
            className="p-8 rounded-2xl gradient-card card-soft mb-8"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-3 rounded-lg bg-primary/10">
                <SettingsIcon className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-primary-light to-primary-dark bg-clip-text text-transparent">
                Settings
              </h1>
            </div>
            <p className="text-muted-foreground text-lg">
              Manage your account preferences and application settings
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Tabs defaultValue="profile" className="space-y-6">
              <TabsList className="grid w-full grid-cols-2 bg-muted/50 border border-primary/20">
              <TabsTrigger
                value="profile"
                className="flex items-center space-x-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-300"
              >
                <User className="h-4 w-4" />
                <span>Profile</span>
              </TabsTrigger>
              <TabsTrigger
                value="ai-config"
                className="flex items-center space-x-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-300"
              >
                <SettingsIcon className="h-4 w-4" />
                <span>AI Config</span>
              </TabsTrigger>
            </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Update your personal information and account details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your.email@example.com"
                    value={profile.email}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-sm text-muted-foreground">
                    Email cannot be changed. Used for login and notifications.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={profile.username}
                    onChange={(e) => setProfile(prev => ({ ...prev, username: e.target.value }))}
                  />
                  <p className="text-sm text-muted-foreground">
                    Your display username (min. 3 characters).
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone_number">Phone Number</Label>
                  <Input
                    id="phone_number"
                    placeholder="+60123456789"
                    value={profile.phone_number}
                    onChange={(e) => setProfile(prev => ({ ...prev, phone_number: e.target.value }))}
                  />
                  <p className="text-sm text-muted-foreground">
                    Used for WhatsApp connection. Format: +60123456789
                  </p>
                </div>
              </div>

              <div className="pt-4">
                <Button onClick={handleSaveProfile} disabled={loading} className="w-full" size="lg">
                  <Save className="mr-2 h-4 w-4" />
                  {loading ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Password Section */}
          <ChangePasswordSection />
        </TabsContent>

        {/* AI Configuration Tab */}
        <TabsContent value="ai-config" className="space-y-6">
          <AiConfigForm />
        </TabsContent>
          </Tabs>
          </motion.div>
        </div>
      </main>
    </div>
  );
}