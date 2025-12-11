import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/api/supabase';
import { useAuth } from '@/hooks/auth/useAuth';

/**
 * Represents a waiver template that users may need to sign
 */
export interface WaiverTemplate {
  id: string;
  name: string;
  slug: string;
  boldsignTemplateId: string | null;
  title: string;
  description: string | null;
  pdfUrl: string | null;
  isRequired: boolean;
  isActive: boolean;
  sortOrder: number;
  validityDays: number;
  eventYear: number | null;
}

/**
 * Legacy settings for backward compatibility
 */
export interface WaiverSettings {
  // BoldSign integration
  boldsignEnabled: boolean;
  boldsignTemplateId: string;
  boldsignRedirectUrl: string;

  // Waiver content
  waiverTitle: string;
  waiverDescription: string;

  // Requirements
  waiverRequired: boolean;
  waiverExpiryDays: number;

  // Fallback (when BoldSign disabled)
  waiverFallbackUrl: string;
}

export interface WaiverSigningStatus {
  id: string;
  templateId: string | null;
  templateSlug: string | null;
  status: 'pending' | 'sent' | 'viewed' | 'signed' | 'declined' | 'expired' | 'error';
  signedAt: string | null;
  expiresAt: string | null;
  signerName: string;
}

/**
 * Combined status for a waiver template with its signing status
 */
export interface WaiverWithStatus {
  template: WaiverTemplate;
  signingStatus: WaiverSigningStatus | null;
  isValid: boolean;
  needsToSign: boolean;
}

interface UseWaiverSettingsReturn {
  // Legacy single-waiver interface (for backward compatibility)
  settings: WaiverSettings;
  waiverStatus: WaiverSigningStatus | null;
  needsToSign: boolean;
  isValid: boolean;
  createWaiver: (signerName: string, signerEmail: string, templateId?: string) => Promise<{ signUrl: string; waiverSigningId: string } | null>;

  // Multiple waivers interface
  waiverTemplates: WaiverTemplate[];
  waiverStatuses: Map<string, WaiverSigningStatus>;
  waiversWithStatus: WaiverWithStatus[];
  allWaiversSigned: boolean;
  pendingWaivers: WaiverWithStatus[];

  // Common
  isLoading: boolean;
  refreshStatus: () => Promise<void>;
  error: string | null;
}

const defaultSettings: WaiverSettings = {
  boldsignEnabled: false,
  boldsignTemplateId: '',
  boldsignRedirectUrl: '',
  waiverTitle: 'Liability Waiver and Release',
  waiverDescription: 'Please review and sign the liability waiver to complete your registration.',
  waiverRequired: false,
  waiverExpiryDays: 365,
  waiverFallbackUrl: '',
};

/**
 * Helper to check if a waiver signing is valid (signed and not expired)
 */
function isWaiverValid(status: WaiverSigningStatus | null): boolean {
  if (!status) return false;
  if (status.status !== 'signed') return false;
  if (status.expiresAt && new Date(status.expiresAt) < new Date()) return false;
  return true;
}

/**
 * Hook to manage waiver settings and signing status
 * Supports multiple waiver templates with individual signing tracking
 * Used by the registration wizard to handle waiver signing flow
 */
export function useWaiverSettings(eventYear: number = 2025): UseWaiverSettingsReturn {
  const { user, session } = useAuth();
  const [settings, setSettings] = useState<WaiverSettings>(defaultSettings);
  const [waiverTemplates, setWaiverTemplates] = useState<WaiverTemplate[]>([]);
  const [waiverStatuses, setWaiverStatuses] = useState<Map<string, WaiverSigningStatus>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Compute waiversWithStatus - combines templates with their signing status
  const waiversWithStatus = useMemo((): WaiverWithStatus[] => {
    return waiverTemplates
      .filter(t => t.isActive && t.isRequired)
      .map(template => {
        const signingStatus = waiverStatuses.get(template.id) || null;
        const valid = isWaiverValid(signingStatus);
        return {
          template,
          signingStatus,
          isValid: valid,
          needsToSign: !valid,
        };
      })
      .sort((a, b) => a.template.sortOrder - b.template.sortOrder);
  }, [waiverTemplates, waiverStatuses]);

  // Get pending waivers (required but not yet signed)
  const pendingWaivers = useMemo(() => {
    return waiversWithStatus.filter(w => w.needsToSign);
  }, [waiversWithStatus]);

  // Check if all required waivers are signed
  const allWaiversSigned = useMemo(() => {
    return waiversWithStatus.length > 0 && pendingWaivers.length === 0;
  }, [waiversWithStatus, pendingWaivers]);

  // Legacy single-waiver interface (first required waiver or first overall)
  const firstWaiver = waiversWithStatus[0] || null;
  const waiverStatus = firstWaiver?.signingStatus || null;
  const isValid = firstWaiver?.isValid || false;
  const needsToSign = firstWaiver?.needsToSign || false;

  // Fetch waiver templates and legacy settings from database
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        // Fetch waiver templates
        const { data: templates, error: templatesError } = await supabase
          .from('waiver_templates')
          .select('*')
          .eq('is_active', true)
          .or(`event_year.is.null,event_year.eq.${eventYear}`)
          .order('sort_order', { ascending: true });

        if (templatesError) {
          console.error('Error fetching waiver templates:', templatesError);
          // Don't fail completely - fall back to legacy settings
        } else if (templates && templates.length > 0) {
          setWaiverTemplates(templates.map(t => ({
            id: t.id,
            name: t.name,
            slug: t.slug,
            boldsignTemplateId: t.boldsign_template_id,
            title: t.title,
            description: t.description,
            pdfUrl: t.pdf_url,
            isRequired: t.is_required,
            isActive: t.is_active,
            sortOrder: t.sort_order,
            validityDays: t.validity_days,
            eventYear: t.event_year,
          })));
        }

        // Fetch legacy settings for backward compatibility
        const { data, error: fetchError } = await supabase
          .from('site_settings')
          .select('setting_key, setting_value')
          .in('setting_key', [
            'boldsign_enabled',
            'boldsign_template_id',
            'boldsign_redirect_url',
            'waiver_title',
            'waiver_description',
            'waiver_required',
            'waiver_expiry_days',
            'waiver_fallback_url',
            'waiver_url', // Legacy fallback
          ]);

        if (fetchError) {
          console.error('Error fetching waiver settings:', fetchError);
          setError('Failed to load waiver settings');
          setIsLoading(false);
          return;
        }

        // Convert to map
        const settingsMap: Record<string, string> = {};
        for (const row of data || []) {
          settingsMap[row.setting_key] = row.setting_value;
        }

        setSettings({
          boldsignEnabled: settingsMap['boldsign_enabled'] === 'true',
          boldsignTemplateId: settingsMap['boldsign_template_id'] || '',
          boldsignRedirectUrl: settingsMap['boldsign_redirect_url'] || '',
          waiverTitle: settingsMap['waiver_title'] || defaultSettings.waiverTitle,
          waiverDescription: settingsMap['waiver_description'] || defaultSettings.waiverDescription,
          waiverRequired: false, // Force-disabled for now
          waiverExpiryDays: settingsMap['waiver_expiry_days']
            ? parseInt(settingsMap['waiver_expiry_days'], 10)
            : defaultSettings.waiverExpiryDays,
          waiverFallbackUrl: settingsMap['waiver_fallback_url'] || settingsMap['waiver_url'] || '',
        });

        setError(null);
      } catch (err) {
        console.error('Unexpected error fetching waiver settings:', err);
        setError('Failed to load waiver settings');
      }
    };

    fetchSettings();
  }, [eventYear]);

  // Fetch waiver signing status for current user (all templates)
  const refreshStatus = useCallback(async () => {
    if (!user) {
      setWaiverStatuses(new Map());
      setIsLoading(false);
      return;
    }

    try {
      // Fetch all waiver signings for this user and event year
      const { data, error: fetchError } = await supabase
        .from('waiver_signings')
        .select('id, waiver_template_id, status, signed_at, expires_at, signer_name')
        .eq('user_id', user.id)
        .eq('event_year', eventYear)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching waiver status:', fetchError);
        setError('Failed to load waiver status');
        setIsLoading(false);
        return;
      }

      // Build a map of template ID -> most recent signing status
      const statusMap = new Map<string, WaiverSigningStatus>();

      for (const signing of data || []) {
        const templateId = signing.waiver_template_id;
        // Only keep the first (most recent) signing for each template
        if (templateId && !statusMap.has(templateId)) {
          statusMap.set(templateId, {
            id: signing.id,
            templateId: templateId,
            templateSlug: null, // Will be filled from template if needed
            status: signing.status,
            signedAt: signing.signed_at,
            expiresAt: signing.expires_at,
            signerName: signing.signer_name,
          });
        }
      }

      setWaiverStatuses(statusMap);
      setError(null);
    } catch (err) {
      console.error('Unexpected error fetching waiver status:', err);
      setError('Failed to load waiver status');
    } finally {
      setIsLoading(false);
    }
  }, [user, eventYear]);

  // Fetch status when user or templates change
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // Create a new waiver signing request
  const createWaiver = useCallback(async (
    signerName: string,
    signerEmail: string,
    templateId?: string
  ): Promise<{ signUrl: string; waiverSigningId: string } | null> => {
    if (!session?.access_token) {
      setError('You must be logged in to sign a waiver');
      return null;
    }

    try {
      setError(null);

      // Find the template to get its BoldSign template ID
      const template = templateId
        ? waiverTemplates.find(t => t.id === templateId)
        : waiverTemplates[0];

      const response = await supabase.functions.invoke('create-boldsign-waiver', {
        body: {
          signerName,
          signerEmail,
          eventYear,
          templateId: template?.id,
          boldsignTemplateId: template?.boldsignTemplateId,
        },
      });

      if (response.error) {
        console.error('Error creating waiver:', response.error);
        setError(response.error.message || 'Failed to create waiver');
        return null;
      }

      const data = response.data;

      if (data.alreadySigned) {
        // User already has a valid waiver
        await refreshStatus();
        return null;
      }

      if (data.signUrl && data.waiverSigningId) {
        return {
          signUrl: data.signUrl,
          waiverSigningId: data.waiverSigningId,
        };
      }

      setError('Invalid response from waiver service');
      return null;
    } catch (err) {
      console.error('Unexpected error creating waiver:', err);
      setError('Failed to create waiver');
      return null;
    }
  }, [session, eventYear, refreshStatus, waiverTemplates]);

  return {
    // Legacy interface
    settings,
    waiverStatus,
    needsToSign,
    isValid,
    createWaiver,

    // Multiple waivers interface
    waiverTemplates,
    waiverStatuses,
    waiversWithStatus,
    allWaiversSigned,
    pendingWaivers,

    // Common
    isLoading,
    refreshStatus,
    error,
  };
}
