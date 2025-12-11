import { useState, useEffect } from 'react';
import { supabase } from '@/lib/api/supabase';

export type StripeEnvironment = 'qa' | 'stg' | 'prod';

export interface StripeConfig {
  environment: StripeEnvironment;
  publishableKey: string | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to fetch Stripe configuration from site settings
 * Returns the active publishable key based on the configured environment
 */
export function useStripeConfig(): StripeConfig {
  const [state, setState] = useState<StripeConfig>({
    environment: 'qa',
    publishableKey: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const fetchStripeConfig = async () => {
      try {
        // Fetch all Stripe-related settings in one query
        const { data, error } = await supabase
          .from('site_settings')
          .select('setting_key, setting_value')
          .in('setting_key', [
            'stripe_environment',
            'stripe_publishable_key_qa',
            'stripe_publishable_key_stg',
            'stripe_publishable_key_prod',
          ]);

        if (error) {
          console.error('Error fetching Stripe config:', error);
          setState({
            environment: 'qa',
            publishableKey: null,
            isLoading: false,
            error: 'Failed to load Stripe configuration',
          });
          return;
        }

        // Convert to a lookup object
        const settings: Record<string, string> = {};
        data?.forEach((row) => {
          settings[row.setting_key] = row.setting_value;
        });

        // Determine active environment
        const environment = (settings['stripe_environment'] as StripeEnvironment) || 'qa';

        // Get the publishable key for the active environment
        const keyMap: Record<StripeEnvironment, string> = {
          qa: settings['stripe_publishable_key_qa'] || '',
          stg: settings['stripe_publishable_key_stg'] || '',
          prod: settings['stripe_publishable_key_prod'] || '',
        };

        const publishableKey = keyMap[environment] || null;

        setState({
          environment,
          publishableKey: publishableKey && publishableKey.trim() !== '' ? publishableKey : null,
          isLoading: false,
          error: null,
        });
      } catch (err) {
        console.error('Unexpected error fetching Stripe config:', err);
        setState({
          environment: 'qa',
          publishableKey: null,
          isLoading: false,
          error: 'Unexpected error loading Stripe configuration',
        });
      }
    };

    fetchStripeConfig();
  }, []);

  return state;
}

/**
 * Helper function to get Stripe config without React hooks
 * Useful for edge functions or non-React contexts
 */
export async function getStripeConfig(): Promise<{
  environment: StripeEnvironment;
  publishableKey: string | null;
}> {
  const { data, error } = await supabase
    .from('site_settings')
    .select('setting_key, setting_value')
    .in('setting_key', [
      'stripe_environment',
      'stripe_publishable_key_qa',
      'stripe_publishable_key_stg',
      'stripe_publishable_key_prod',
    ]);

  if (error || !data) {
    return { environment: 'qa', publishableKey: null };
  }

  const settings: Record<string, string> = {};
  data.forEach((row) => {
    settings[row.setting_key] = row.setting_value;
  });

  const environment = (settings['stripe_environment'] as StripeEnvironment) || 'qa';
  const keyMap: Record<StripeEnvironment, string> = {
    qa: settings['stripe_publishable_key_qa'] || '',
    stg: settings['stripe_publishable_key_stg'] || '',
    prod: settings['stripe_publishable_key_prod'] || '',
  };

  const publishableKey = keyMap[environment] || null;

  return {
    environment,
    publishableKey: publishableKey && publishableKey.trim() !== '' ? publishableKey : null,
  };
}
