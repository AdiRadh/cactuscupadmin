import { useState, useEffect } from 'react';
import { supabase } from '@/lib/api/supabase';

export interface EventRegistrationSettings {
  eventRegistrationFee: number; // in cents (regular price)
  eventRegistrationName: string;
  eventRegistrationDescription: string;
  freeEntryEnabled: boolean;
  freeEntryName: string;
  freeEntryDescription: string;
  freeEntryBenefits: string[];
  paidEntryBenefits: string[];
  // Paid spectator pass (middle tier between free and supporter)
  spectatorPassEnabled: boolean;
  spectatorPassFee: number; // in cents
  spectatorPassName: string;
  spectatorPassDescription: string;
  spectatorPassBenefits: string[];
  // Early bird pricing
  earlyBirdFee: number | null; // in cents, null if not configured
  earlyBirdEndDate: string | null; // ISO date string
  isEarlyBirdActive: boolean; // computed: true if early bird is currently available
  activeEventRegistrationFee: number; // the fee to charge (early bird or regular)
  // Page view visibility for free entry
  showTournamentsForFree: boolean;
  showAddonsForFree: boolean;
  // Page view visibility for spectator pass
  showTournamentsForSpectator: boolean;
  showAddonsForSpectator: boolean;
  // Legal document URLs for acknowledgments
  waiverUrl: string;
  rulesUrl: string;
  // Stripe product/price IDs for supporter entry
  supporterEntryStripeProductId: string | null;
  supporterEntryStripePriceId: string | null;
  supporterEntryStripeEarlyBirdPriceId: string | null;
  // Stripe product/price IDs for spectator pass
  spectatorPassStripeProductId: string | null;
  spectatorPassStripePriceId: string | null;
}

interface UseEventRegistrationSettingsReturn {
  settings: EventRegistrationSettings;
  isLoading: boolean;
}

const defaultSettings: EventRegistrationSettings = {
  eventRegistrationFee: 2000, // $20.00 default
  eventRegistrationName: 'Supporter Entry',
  eventRegistrationDescription: 'Event registration with commemorative patch',
  freeEntryEnabled: true,
  freeEntryName: 'Free Entry',
  freeEntryDescription: 'Attend the event for free. Pay only for tournaments and merchandise you want.',
  freeEntryBenefits: [
    'Access to all vendor areas',
    'Watch tournaments for free',
    'Participate in social events',
  ],
  paidEntryBenefits: [
    'Everything in Free Entry',
    'Exclusive event patch',
    'Support future events',
    'Our eternal gratitude!',
  ],
  spectatorPassEnabled: false,
  spectatorPassFee: 1000, // $10.00 default
  spectatorPassName: 'Spectator Pass',
  spectatorPassDescription: 'Paid spectator access with additional perks.',
  spectatorPassBenefits: [
    'Access to all vendor areas',
    'Watch tournaments for free',
    'Reserved spectator seating',
  ],
  earlyBirdFee: null,
  earlyBirdEndDate: null,
  isEarlyBirdActive: false,
  activeEventRegistrationFee: 2000,
  showTournamentsForFree: true,
  showAddonsForFree: true,
  showTournamentsForSpectator: true,
  showAddonsForSpectator: true,
  waiverUrl: '',
  rulesUrl: '',
  supporterEntryStripeProductId: null,
  supporterEntryStripePriceId: null,
  supporterEntryStripeEarlyBirdPriceId: null,
  spectatorPassStripeProductId: null,
  spectatorPassStripePriceId: null,
};

/**
 * Hook to fetch event registration settings from site_settings
 * Used by the registration wizard to display dynamic pricing and naming
 */
export function useEventRegistrationSettings(): UseEventRegistrationSettingsReturn {
  const [state, setState] = useState<UseEventRegistrationSettingsReturn>({
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
            'event_registration_fee',
            'event_registration_name',
            'event_registration_description',
            'free_entry_enabled',
            'free_entry_name',
            'free_entry_description',
            'free_entry_benefits',
            'paid_entry_benefits',
            'spectator_pass_enabled',
            'spectator_pass_fee',
            'spectator_pass_name',
            'spectator_pass_description',
            'spectator_pass_benefits',
            'event_registration_early_bird_fee',
            'event_registration_early_bird_end_date',
            'show_tournaments_for_free',
            'show_addons_for_free',
            'show_tournaments_for_spectator',
            'show_addons_for_spectator',
            'waiver_url',
            'rules_url',
            'supporter_entry_stripe_product_id',
            'supporter_entry_stripe_price_id',
            'supporter_entry_stripe_early_bird_price_id',
            'spectator_pass_stripe_product_id',
            'spectator_pass_stripe_price_id',
          ]);

        if (error) {
          console.error('Error fetching event registration settings:', error);
          setState({ settings: defaultSettings, isLoading: false });
          return;
        }

        // Convert array to key-value map
        const settingsMap: Record<string, string> = {};
        for (const row of data || []) {
          settingsMap[row.setting_key] = row.setting_value;
        }

        const fee = settingsMap['event_registration_fee'];
        const freeEntryEnabled = settingsMap['free_entry_enabled'];
        const earlyBirdFeeStr = settingsMap['event_registration_early_bird_fee'];
        const earlyBirdEndDate = settingsMap['event_registration_early_bird_end_date'] || null;

        // Parse benefits (stored as JSON arrays)
        const parseBenefits = (jsonStr: string | undefined, fallback: string[]): string[] => {
          if (!jsonStr) return fallback;
          try {
            const parsed = JSON.parse(jsonStr);
            return Array.isArray(parsed) ? parsed : fallback;
          } catch {
            return fallback;
          }
        };
        const freeEntryBenefits = parseBenefits(settingsMap['free_entry_benefits'], defaultSettings.freeEntryBenefits);
        const paidEntryBenefits = parseBenefits(settingsMap['paid_entry_benefits'], defaultSettings.paidEntryBenefits);
        const spectatorPassBenefits = parseBenefits(settingsMap['spectator_pass_benefits'], defaultSettings.spectatorPassBenefits);

        // Parse fees
        const regularFee = fee ? parseInt(fee, 10) : defaultSettings.eventRegistrationFee;
        const earlyBirdFee = earlyBirdFeeStr ? parseInt(earlyBirdFeeStr, 10) : null;
        const spectatorPassFeeStr = settingsMap['spectator_pass_fee'];
        const spectatorPassFee = spectatorPassFeeStr ? parseInt(spectatorPassFeeStr, 10) : defaultSettings.spectatorPassFee;

        // Determine if early bird is currently active
        const isEarlyBirdActive = (() => {
          if (!earlyBirdFee || !earlyBirdEndDate) return false;
          const now = new Date();
          const endDate = new Date(earlyBirdEndDate);
          return now < endDate;
        })();

        // Determine the active fee to charge
        const activeEventRegistrationFee = isEarlyBirdActive && earlyBirdFee ? earlyBirdFee : regularFee;

        setState({
          settings: {
            eventRegistrationFee: regularFee,
            eventRegistrationName: settingsMap['event_registration_name'] || defaultSettings.eventRegistrationName,
            eventRegistrationDescription: settingsMap['event_registration_description'] || defaultSettings.eventRegistrationDescription,
            freeEntryEnabled: freeEntryEnabled !== undefined ? freeEntryEnabled === 'true' : defaultSettings.freeEntryEnabled,
            freeEntryName: settingsMap['free_entry_name'] || defaultSettings.freeEntryName,
            freeEntryDescription: settingsMap['free_entry_description'] || defaultSettings.freeEntryDescription,
            freeEntryBenefits,
            paidEntryBenefits,
            spectatorPassEnabled: settingsMap['spectator_pass_enabled'] === 'true',
            spectatorPassFee,
            spectatorPassName: settingsMap['spectator_pass_name'] || defaultSettings.spectatorPassName,
            spectatorPassDescription: settingsMap['spectator_pass_description'] || defaultSettings.spectatorPassDescription,
            spectatorPassBenefits,
            earlyBirdFee,
            earlyBirdEndDate,
            isEarlyBirdActive,
            activeEventRegistrationFee,
            showTournamentsForFree: settingsMap['show_tournaments_for_free'] !== 'false',
            showAddonsForFree: settingsMap['show_addons_for_free'] !== 'false',
            showTournamentsForSpectator: settingsMap['show_tournaments_for_spectator'] !== 'false',
            showAddonsForSpectator: settingsMap['show_addons_for_spectator'] !== 'false',
            waiverUrl: settingsMap['waiver_url'] || '',
            rulesUrl: settingsMap['rules_url'] || '',
            supporterEntryStripeProductId: settingsMap['supporter_entry_stripe_product_id'] || null,
            supporterEntryStripePriceId: settingsMap['supporter_entry_stripe_price_id'] || null,
            supporterEntryStripeEarlyBirdPriceId: settingsMap['supporter_entry_stripe_early_bird_price_id'] || null,
            spectatorPassStripeProductId: settingsMap['spectator_pass_stripe_product_id'] || null,
            spectatorPassStripePriceId: settingsMap['spectator_pass_stripe_price_id'] || null,
          },
          isLoading: false,
        });
      } catch (err) {
        console.error('Unexpected error fetching event registration settings:', err);
        setState({ settings: defaultSettings, isLoading: false });
      }
    };

    fetchSettings();
  }, []);

  return state;
}
