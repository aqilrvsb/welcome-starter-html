import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, DollarSign, Clock, Phone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface SystemSetting {
  setting_key: string;
  setting_value: string;
  setting_type: string;
  description: string;
}

export default function AdminSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Settings state
  const [pricingPerMinute, setPricingPerMinute] = useState('0.15');
  const [trialMinutesDefault, setTrialMinutesDefault] = useState('10.0');
  const [maxConcurrentCalls, setMaxConcurrentCalls] = useState('3');
  const [defaultSipProxyPrimary, setDefaultSipProxyPrimary] = useState('sip1.alienvoip.com');
  const [defaultSipProxySecondary, setDefaultSipProxySecondary] = useState('sip3.alienvoip.com');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .in('setting_key', [
          'pricing_per_minute',
          'trial_minutes_default',
          'max_concurrent_calls',
          'default_sip_proxy_primary',
          'default_sip_proxy_secondary',
        ]);

      if (error) throw error;

      // Map settings to state
      data?.forEach((setting: SystemSetting) => {
        switch (setting.setting_key) {
          case 'pricing_per_minute':
            setPricingPerMinute(setting.setting_value);
            break;
          case 'trial_minutes_default':
            setTrialMinutesDefault(setting.setting_value);
            break;
          case 'max_concurrent_calls':
            setMaxConcurrentCalls(setting.setting_value);
            break;
          case 'default_sip_proxy_primary':
            setDefaultSipProxyPrimary(setting.setting_value);
            break;
          case 'default_sip_proxy_secondary':
            setDefaultSipProxySecondary(setting.setting_value);
            break;
        }
      });
    } catch (error: any) {
      console.error('Error loading settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load system settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const updates = [
        { key: 'pricing_per_minute', value: pricingPerMinute },
        { key: 'trial_minutes_default', value: trialMinutesDefault },
        { key: 'max_concurrent_calls', value: maxConcurrentCalls },
        { key: 'default_sip_proxy_primary', value: defaultSipProxyPrimary },
        { key: 'default_sip_proxy_secondary', value: defaultSipProxySecondary },
      ];

      // Update all settings
      for (const update of updates) {
        const { error } = await supabase
          .from('system_settings')
          .update({
            setting_value: update.value,
            updated_at: new Date().toISOString(),
          })
          .eq('setting_key', update.key);

        if (error) throw error;
      }

      toast({
        title: 'Success',
        description: 'System settings updated successfully',
      });
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
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
        <h1 className="text-3xl font-bold">System Settings</h1>
        <p className="text-muted-foreground mt-2">
          Configure global system settings that affect all users
        </p>
      </div>

      {/* Pricing Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Pricing Configuration
          </CardTitle>
          <CardDescription>
            Set the price per minute for AI calls. This affects the entire system including Deno Deploy handler.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pricing">Price Per Minute (MYR)</Label>
            <Input
              id="pricing"
              type="number"
              step="0.01"
              min="0.01"
              value={pricingPerMinute}
              onChange={(e) => setPricingPerMinute(e.target.value)}
              placeholder="0.15"
            />
            <p className="text-xs text-muted-foreground">
              Current: RM{pricingPerMinute}/minute. This will update all pricing displays and cost calculations.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Trial Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Trial Configuration
          </CardTitle>
          <CardDescription>
            Configure default trial minutes for new users
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="trial">Default Trial Minutes</Label>
            <Input
              id="trial"
              type="number"
              step="0.5"
              min="0"
              value={trialMinutesDefault}
              onChange={(e) => setTrialMinutesDefault(e.target.value)}
              placeholder="10.0"
            />
            <p className="text-xs text-muted-foreground">
              New users will receive {trialMinutesDefault} minutes of free trial calling.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="concurrent">Max Concurrent Calls</Label>
            <Input
              id="concurrent"
              type="number"
              min="1"
              max="10"
              value={maxConcurrentCalls}
              onChange={(e) => setMaxConcurrentCalls(e.target.value)}
              placeholder="3"
            />
            <p className="text-xs text-muted-foreground">
              Maximum number of simultaneous calls per user (1-10).
            </p>
          </div>
        </CardContent>
      </Card>

      {/* SIP Default Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Default SIP Configuration
          </CardTitle>
          <CardDescription>
            Default SIP proxy servers for new Pro accounts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sip-primary">Primary SIP Proxy</Label>
            <Input
              id="sip-primary"
              type="text"
              value={defaultSipProxyPrimary}
              onChange={(e) => setDefaultSipProxyPrimary(e.target.value)}
              placeholder="sip1.alienvoip.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sip-secondary">Secondary SIP Proxy</Label>
            <Input
              id="sip-secondary"
              type="text"
              value={defaultSipProxySecondary}
              onChange={(e) => setDefaultSipProxySecondary(e.target.value)}
              placeholder="sip3.alienvoip.com"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            These defaults will be pre-filled when configuring SIP for new Pro accounts.
          </p>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving Changes...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save All Settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
