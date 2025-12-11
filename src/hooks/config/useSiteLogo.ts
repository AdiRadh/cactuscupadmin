import { useState, useEffect } from 'react';
import { supabase } from '@/lib/api/supabase';

interface SiteLogo {
  logoUrl: string | null;
  isLoading: boolean;
}

/**
 * Hook to fetch the site logo URL from site settings
 * Refreshes every 60 seconds to pick up changes
 */
export function useSiteLogo(): SiteLogo {
  const [state, setState] = useState<SiteLogo>({
    logoUrl: null,
    isLoading: true,
  });

  useEffect(() => {
    const fetchLogoUrl = async () => {
      try {
        const { data, error } = await supabase
          .from('site_settings')
          .select('setting_value')
          .eq('setting_key', 'site_logo_url')
          .single();

        if (error) {
          console.error('Error fetching site logo:', error);
          setState({ logoUrl: null, isLoading: false });
          return;
        }

        const logoUrl = data?.setting_value || null;
        setState({
          logoUrl: logoUrl && logoUrl.trim() !== '' ? logoUrl : null,
          isLoading: false,
        });
      } catch (err) {
        console.error('Unexpected error fetching site logo:', err);
        setState({ logoUrl: null, isLoading: false });
      }
    };

    fetchLogoUrl();

    // Refresh logo URL every 60 seconds
    const interval = setInterval(fetchLogoUrl, 60000);

    return () => clearInterval(interval);
  }, []);

  return state;
}
