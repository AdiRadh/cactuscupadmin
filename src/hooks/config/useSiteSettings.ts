import { useState, useEffect } from 'react';
import { supabase } from '@/lib/api/supabase';

export interface FooterLink {
  label: string;
  path: string;
  enabled: boolean;
}

export interface SiteSettings {
  siteName: string;
  eventLocation: string;
  contactEmail: string;
  socialFacebook: string;
  socialInstagram: string;
  socialTwitter: string;
  socialYoutube: string;
  footerTagline: string;
  footerCopyright: string;
  // Footer links
  footerEventTitle: string;
  footerInfoTitle: string;
  footerLegalTitle: string;
  footerEventLinks: FooterLink[];
  footerInfoLinks: FooterLink[];
  footerLegalLinks: FooterLink[];
  // External URLs
  rulesUrl: string;
}

interface UseSiteSettingsReturn {
  settings: SiteSettings;
  isLoading: boolean;
}

const defaultFooterEventLinks: FooterLink[] = [
  { label: 'Tournaments', path: '/tournaments', enabled: true },
  { label: 'Activities', path: '/activities', enabled: true },
  { label: 'Schedule', path: '/schedule', enabled: true },
  { label: 'Venue', path: '/venue', enabled: true },
];

const defaultFooterInfoLinks: FooterLink[] = [
  { label: 'About', path: '/about', enabled: true },
  { label: 'FAQ', path: '/faq', enabled: true },
  { label: 'Rules', path: '/rules', enabled: true },
  { label: 'Contact', path: '/contact', enabled: true },
];

const defaultFooterLegalLinks: FooterLink[] = [
  { label: 'Privacy Policy', path: '/privacy', enabled: true },
  { label: 'Terms of Service', path: '/terms', enabled: true },
  { label: 'Refund Policy', path: '/refund', enabled: true },
];

const defaultSettings: SiteSettings = {
  siteName: 'Cactus Cup',
  eventLocation: 'Phoenix, Arizona',
  contactEmail: 'info@cactuscup.com',
  socialFacebook: '',
  socialInstagram: '',
  socialTwitter: '',
  socialYoutube: '',
  footerTagline: "Arizona's latest summer HEMA tournament Bringing together sword nerds from across the region for competition, learning, and community.",
  footerCopyright: 'Cactus Cup',
  footerEventTitle: 'Event',
  footerInfoTitle: 'Information',
  footerLegalTitle: 'Legal',
  footerEventLinks: defaultFooterEventLinks,
  footerInfoLinks: defaultFooterInfoLinks,
  footerLegalLinks: defaultFooterLegalLinks,
  rulesUrl: '',
};

/**
 * Hook to fetch site settings for public-facing components like the Footer
 * Refreshes every 60 seconds to pick up changes
 */
export function useSiteSettings(): UseSiteSettingsReturn {
  const [state, setState] = useState<UseSiteSettingsReturn>({
    settings: defaultSettings,
    isLoading: true,
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('site_settings')
          .select('setting_key, setting_value')
          .in('setting_key', [
            'site_name',
            'event_location',
            'contact_email',
            'social_facebook',
            'social_instagram',
            'social_twitter',
            'social_youtube',
            'footer_tagline',
            'footer_copyright',
            'footer_event_title',
            'footer_info_title',
            'footer_legal_title',
            'footer_event_links',
            'footer_info_links',
            'footer_legal_links',
            'rules_url',
          ]);

        if (error) {
          console.error('Error fetching site settings:', error);
          setState({ settings: defaultSettings, isLoading: false });
          return;
        }

        // Convert array to key-value map
        const settingsMap: Record<string, string> = {};
        for (const row of data || []) {
          settingsMap[row.setting_key] = row.setting_value;
        }

        // Parse JSON footer links with fallback to defaults
        const parseFooterLinks = (jsonStr: string | undefined, defaults: FooterLink[]): FooterLink[] => {
          if (!jsonStr) return defaults;
          try {
            const parsed = JSON.parse(jsonStr);
            return Array.isArray(parsed) ? parsed : defaults;
          } catch {
            return defaults;
          }
        };

        setState({
          settings: {
            siteName: settingsMap['site_name'] || defaultSettings.siteName,
            eventLocation: settingsMap['event_location'] || defaultSettings.eventLocation,
            contactEmail: settingsMap['contact_email'] || defaultSettings.contactEmail,
            socialFacebook: settingsMap['social_facebook'] || '',
            socialInstagram: settingsMap['social_instagram'] || '',
            socialTwitter: settingsMap['social_twitter'] || '',
            socialYoutube: settingsMap['social_youtube'] || '',
            footerTagline: settingsMap['footer_tagline'] || defaultSettings.footerTagline,
            footerCopyright: settingsMap['footer_copyright'] || defaultSettings.footerCopyright,
            footerEventTitle: settingsMap['footer_event_title'] || defaultSettings.footerEventTitle,
            footerInfoTitle: settingsMap['footer_info_title'] || defaultSettings.footerInfoTitle,
            footerLegalTitle: settingsMap['footer_legal_title'] || defaultSettings.footerLegalTitle,
            footerEventLinks: parseFooterLinks(settingsMap['footer_event_links'], defaultFooterEventLinks),
            footerInfoLinks: parseFooterLinks(settingsMap['footer_info_links'], defaultFooterInfoLinks),
            footerLegalLinks: parseFooterLinks(settingsMap['footer_legal_links'], defaultFooterLegalLinks),
            rulesUrl: settingsMap['rules_url'] || '',
          },
          isLoading: false,
        });
      } catch (err) {
        console.error('Unexpected error fetching site settings:', err);
        setState({ settings: defaultSettings, isLoading: false });
      }
    };

    fetchSettings();

    // Refresh settings every 60 seconds
    const interval = setInterval(fetchSettings, 60000);

    return () => clearInterval(interval);
  }, []);

  return state;
}
