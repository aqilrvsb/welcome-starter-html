import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Custom hook to fetch and provide dynamic pricing from system settings
 * Automatically refreshes when settings change
 */
export function useDynamicPricing() {
  const [pricingPerMinute, setPricingPerMinute] = useState<number>(0.15); // Default fallback
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    fetchPricing();

    // Subscribe to real-time changes in system_settings
    const channel = supabase
      .channel('system_settings_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'system_settings',
          filter: `setting_key=eq.pricing_per_minute`,
        },
        (payload) => {
          console.log('Pricing updated:', payload);
          fetchPricing();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchPricing = async () => {
    try {
      setLoading(true);
      setError(null);

      // Try using the helper function first
      const { data, error: rpcError } = await supabase.rpc('get_setting_numeric', {
        key: 'pricing_per_minute',
      });

      if (rpcError) {
        console.error('RPC error, falling back to direct query:', rpcError);

        // Fallback to direct query
        const { data: settingData, error: queryError } = await supabase
          .from('system_settings')
          .select('setting_value')
          .eq('setting_key', 'pricing_per_minute')
          .eq('is_public', true)
          .single();

        if (queryError) throw queryError;

        const price = parseFloat(settingData?.setting_value || '0.15');
        setPricingPerMinute(price);
      } else {
        const price = parseFloat(data || '0.15');
        setPricingPerMinute(price);
      }
    } catch (err: any) {
      console.error('Error fetching dynamic pricing:', err);
      setError(err);
      // Keep fallback value of 0.15
      setPricingPerMinute(0.15);
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => {
    fetchPricing();
  };

  return {
    pricingPerMinute,
    loading,
    error,
    refresh,
  };
}
