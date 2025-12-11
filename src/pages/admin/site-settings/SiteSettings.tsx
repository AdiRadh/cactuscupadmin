import type { FC } from 'react';
import { useState, useMemo } from 'react';
import { useList, useUpdate, useCreate } from '@refinedev/core';
import { SiteSettingsForm, type SiteSettingsFormData, type StripeEnvironment, type StripeSecretsData, type FooterLinkData } from '@/components/admin/forms/SiteSettingsForm';
import { Card, CardContent } from '@/components/ui/Card';
import type { DbSiteSetting } from '@/types';
import { dbToSiteSetting } from '@/types';
import type { SiteSetting } from '@/types';
import { supabase } from '@/lib/supabase';
import { datetimeLocalToUTC, utcToDatetimeLocal } from '@/lib/utils/dateUtils';

export const SiteSettings: FC = () => {
  const { query } = useList<DbSiteSetting>({ resource: 'site_settings', pagination: { pageSize: 100 } });
  const data = query.data?.data || [];
  const isLoading = query.isLoading;
  const { mutate: updateSetting } = useUpdate();
  const { mutate: createSetting } = useCreate();
  const [saving, setSaving] = useState(false);
  const [updatingSecrets, setUpdatingSecrets] = useState(false);

  const settings = useMemo(() => {
    if (!data || data.length === 0) return {} as Record<string, string>;
    return data.map((dbSetting: DbSiteSetting) => dbToSiteSetting(dbSetting)).reduce((acc: Record<string, string>, setting: SiteSetting) => {
      acc[setting.settingKey] = setting.settingValue;
      return acc;
    }, {} as Record<string, string>);
  }, [data]);

  const handleSubmit = async (formData: SiteSettingsFormData) => {
    setSaving(true);
    const updates: Array<{ key: string; value: string }> = [
      { key: 'site_name', value: formData.siteName },
      { key: 'contact_email', value: formData.contactEmail },
      { key: 'contact_phone', value: formData.contactPhone },
      { key: 'event_year', value: formData.eventYear },
      { key: 'event_location', value: formData.eventLocation },
      { key: 'privacy_policy_url', value: formData.privacyPolicyUrl },
      { key: 'terms_conditions_url', value: formData.termsConditionsUrl },
      { key: 'rules_url', value: formData.rulesUrl },
      { key: 'waiver_url', value: formData.waiverUrl },
      { key: 'social_facebook', value: formData.socialFacebook },
      { key: 'social_instagram', value: formData.socialInstagram },
      { key: 'social_youtube', value: formData.socialYoutube },
      { key: 'social_twitter', value: formData.socialTwitter },
      { key: 'countdown_enabled', value: formData.countdownEnabled ? 'true' : 'false' },
      { key: 'countdown_target_date', value: datetimeLocalToUTC(formData.countdownTargetDate) || '' },
      { key: 'inventory_notification_email', value: formData.inventoryNotificationEmail || '' },
      { key: 'inventory_notification_threshold', value: formData.inventoryNotificationThreshold || '90' },
      { key: 'site_logo_url', value: formData.siteLogoUrl || '' },
      { key: 'hero_image_url', value: formData.heroImageUrl || '' },
      // Footer settings
      { key: 'footer_tagline', value: formData.footerTagline || '' },
      { key: 'footer_copyright', value: formData.footerCopyright || '' },
      // Footer links
      { key: 'footer_event_title', value: formData.footerEventTitle || 'Event' },
      { key: 'footer_info_title', value: formData.footerInfoTitle || 'Information' },
      { key: 'footer_legal_title', value: formData.footerLegalTitle || 'Legal' },
      { key: 'footer_event_links', value: JSON.stringify(formData.footerEventLinks) },
      { key: 'footer_info_links', value: JSON.stringify(formData.footerInfoLinks) },
      { key: 'footer_legal_links', value: JSON.stringify(formData.footerLegalLinks) },
      // Stripe configuration
      { key: 'stripe_environment', value: formData.stripeEnvironment || 'qa' },
      { key: 'stripe_publishable_key_qa', value: formData.stripePublishableKeyQa || '' },
      { key: 'stripe_publishable_key_stg', value: formData.stripePublishableKeyStg || '' },
      { key: 'stripe_publishable_key_prod', value: formData.stripePublishableKeyProd || '' },
    ];

    for (const update of updates) {
      const existingSetting = data.find((s: DbSiteSetting) => s.setting_key === update.key);
      if (existingSetting) {
        await new Promise<void>((resolve) => {
          updateSetting({ resource: 'site_settings', id: existingSetting.id, values: { setting_value: update.value } }, { onSettled: () => resolve() });
        });
      } else {
        await new Promise<void>((resolve) => {
          createSetting({ resource: 'site_settings', values: { setting_key: update.key, setting_value: update.value, setting_type: 'text' } }, { onSettled: () => resolve() });
        });
      }
    }

    setSaving(false);
    query.refetch();
    alert('Settings saved successfully!');
  };

  const handleSecretsUpdate = async (secrets: StripeSecretsData): Promise<void> => {
    setUpdatingSecrets(true);

    try {
      // Map form field names to Supabase secret names
      const secretsToUpdate: Array<{ name: string; value: string }> = [];

      if (secrets.stripeSecretKeyQa) {
        secretsToUpdate.push({ name: 'STRIPE_SECRET_KEY_QA', value: secrets.stripeSecretKeyQa });
      }
      if (secrets.stripeSecretKeyStg) {
        secretsToUpdate.push({ name: 'STRIPE_SECRET_KEY_STG', value: secrets.stripeSecretKeyStg });
      }
      if (secrets.stripeSecretKeyProd) {
        secretsToUpdate.push({ name: 'STRIPE_SECRET_KEY_PROD', value: secrets.stripeSecretKeyProd });
      }
      if (secrets.stripeWebhookSecretQa) {
        secretsToUpdate.push({ name: 'STRIPE_WEBHOOK_SECRET_QA', value: secrets.stripeWebhookSecretQa });
      }
      if (secrets.stripeWebhookSecretStg) {
        secretsToUpdate.push({ name: 'STRIPE_WEBHOOK_SECRET_STG', value: secrets.stripeWebhookSecretStg });
      }
      if (secrets.stripeWebhookSecretProd) {
        secretsToUpdate.push({ name: 'STRIPE_WEBHOOK_SECRET_PROD', value: secrets.stripeWebhookSecretProd });
      }

      if (secretsToUpdate.length === 0) {
        alert('No secrets to update');
        return;
      }

      const { data, error } = await supabase.functions.invoke('set-secrets', {
        body: { secrets: secretsToUpdate },
      });

      if (error) {
        throw new Error(error.message || 'Failed to update secrets');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      alert(`Successfully updated ${secretsToUpdate.length} secret(s)`);
    } catch (err) {
      console.error('Error updating secrets:', err);
      alert(err instanceof Error ? err.message : 'Failed to update secrets');
      throw err;
    } finally {
      setUpdatingSecrets(false);
    }
  };

  if (isLoading) return <Card><CardContent className="py-8"><div className="text-center text-white">Loading settings...</div></CardContent></Card>;

  // Default footer links
  const defaultFooterEventLinks: FooterLinkData[] = [
    { label: 'Tournaments', path: '/tournaments', enabled: true },
    { label: 'Activities', path: '/activities', enabled: true },
    { label: 'Schedule', path: '/schedule', enabled: true },
    { label: 'Venue', path: '/venue', enabled: true },
  ];

  const defaultFooterInfoLinks: FooterLinkData[] = [
    { label: 'About', path: '/about', enabled: true },
    { label: 'FAQ', path: '/faq', enabled: true },
    { label: 'Rules', path: '/rules', enabled: true },
    { label: 'Contact', path: '/contact', enabled: true },
  ];

  const defaultFooterLegalLinks: FooterLinkData[] = [
    { label: 'Privacy Policy', path: '/privacy', enabled: true },
    { label: 'Terms of Service', path: '/terms', enabled: true },
    { label: 'Refund Policy', path: '/refund', enabled: true },
  ];

  // Parse JSON footer links with fallback to defaults
  const parseFooterLinks = (jsonStr: string | undefined, defaults: FooterLinkData[]): FooterLinkData[] => {
    if (!jsonStr) return defaults;
    try {
      const parsed = JSON.parse(jsonStr);
      return Array.isArray(parsed) ? parsed : defaults;
    } catch {
      return defaults;
    }
  };

  const initialData: SiteSettingsFormData = {
    siteName: settings['site_name'] || '',
    contactEmail: settings['contact_email'] || '',
    contactPhone: settings['contact_phone'] || '',
    eventYear: settings['event_year'] || new Date().getFullYear().toString(),
    eventLocation: settings['event_location'] || '',
    privacyPolicyUrl: settings['privacy_policy_url'] || '',
    termsConditionsUrl: settings['terms_conditions_url'] || '',
    rulesUrl: settings['rules_url'] || '',
    waiverUrl: settings['waiver_url'] || '',
    socialFacebook: settings['social_facebook'] || '',
    socialInstagram: settings['social_instagram'] || '',
    socialYoutube: settings['social_youtube'] || '',
    socialTwitter: settings['social_twitter'] || '',
    countdownEnabled: settings['countdown_enabled'] === 'true',
    countdownTargetDate: utcToDatetimeLocal(settings['countdown_target_date']),
    inventoryNotificationEmail: settings['inventory_notification_email'] || '',
    inventoryNotificationThreshold: settings['inventory_notification_threshold'] || '90',
    siteLogoUrl: settings['site_logo_url'] || '',
    heroImageUrl: settings['hero_image_url'] || '',
    // Footer settings
    footerTagline: settings['footer_tagline'] || '',
    footerCopyright: settings['footer_copyright'] || '',
    // Footer links
    footerEventTitle: settings['footer_event_title'] || 'Event',
    footerInfoTitle: settings['footer_info_title'] || 'Information',
    footerLegalTitle: settings['footer_legal_title'] || 'Legal',
    footerEventLinks: parseFooterLinks(settings['footer_event_links'], defaultFooterEventLinks),
    footerInfoLinks: parseFooterLinks(settings['footer_info_links'], defaultFooterInfoLinks),
    footerLegalLinks: parseFooterLinks(settings['footer_legal_links'], defaultFooterLegalLinks),
    // Stripe configuration
    stripeEnvironment: (settings['stripe_environment'] as StripeEnvironment) || 'qa',
    stripePublishableKeyQa: settings['stripe_publishable_key_qa'] || '',
    stripePublishableKeyStg: settings['stripe_publishable_key_stg'] || '',
    stripePublishableKeyProd: settings['stripe_publishable_key_prod'] || '',
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-viking text-white">Site Settings</h1><p className="text-white/80 mt-2">Manage global site configuration and legal documents</p></div>
      <SiteSettingsForm
        initialData={initialData}
        onSubmit={handleSubmit}
        onSecretsUpdate={handleSecretsUpdate}
        isLoading={saving}
        isUpdatingSecrets={updatingSecrets}
      />
    </div>
  );
};
