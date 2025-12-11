import type { FC } from 'react';
import { useState, useMemo } from 'react';
import { useList, useUpdate, useCreate } from '@refinedev/core';
import { Card, CardContent, CardHeader, CardTitle, Input, Label, Button } from '@/components/ui';
import { DollarSign, Save, Tag, FileText, ToggleLeft, Calendar, Clock, List, Plus, Trash2, Check, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import type { DbSiteSetting } from '@/types';
import { dbToSiteSetting } from '@/types';
import type { SiteSetting } from '@/types';
import { syncEventRegistrationTierToStripe, bulkSyncEventRegistrationTiersToStripe } from '@/lib/utils/stripe';

interface EventRegistrationFormData {
  eventRegistrationFee: string;
  eventRegistrationName: string;
  eventRegistrationDescription: string;
  freeEntryEnabled: boolean;
  freeEntryName: string;
  freeEntryDescription: string;
  freeEntryBenefits: string[];
  paidEntryBenefits: string[];
  // Paid spectator pass
  spectatorPassEnabled: boolean;
  spectatorPassFee: string;
  spectatorPassName: string;
  spectatorPassDescription: string;
  spectatorPassBenefits: string[];
  earlyBirdFee: string;
  earlyBirdEndDate: string;
  // Page view visibility for free entry
  showTournamentsForFree: boolean;
  showAddonsForFree: boolean;
  // Page view visibility for spectator pass
  showTournamentsForSpectator: boolean;
  showAddonsForSpectator: boolean;
  // Stripe IDs
  supporterEntryStripeProductId: string;
  supporterEntryStripePriceId: string;
  supporterEntryStripeEarlyBirdProductId: string;
  supporterEntryStripeEarlyBirdPriceId: string;
  spectatorPassStripeProductId: string;
  spectatorPassStripePriceId: string;
}

const defaultFreeEntryBenefits = [
  'Access to all vendor areas',
  'Watch tournaments for free',
  'Participate in social events',
];

const defaultPaidEntryBenefits = [
  'Everything in Free Entry',
  'Exclusive event patch',
  'Support future events',
  'Our eternal gratitude!',
];

const defaultSpectatorPassBenefits = [
  'Access to all vendor areas',
  'Watch tournaments for free',
  'Reserved spectator seating',
];

export const EventRegistrationSettings: FC = () => {
  const { query } = useList<DbSiteSetting>({ resource: 'site_settings', pagination: { pageSize: 100 } });
  const data = query.data?.data || [];
  const isLoading = query.isLoading;
  const { mutate: updateSetting } = useUpdate();
  const { mutate: createSetting } = useCreate();
  const [saving, setSaving] = useState(false);

  const settings = useMemo(() => {
    if (!data || data.length === 0) return {} as Record<string, string>;
    return data.map((dbSetting: DbSiteSetting) => dbToSiteSetting(dbSetting)).reduce((acc: Record<string, string>, setting: SiteSetting) => {
      acc[setting.settingKey] = setting.settingValue;
      return acc;
    }, {} as Record<string, string>);
  }, [data]);

  const [formData, setFormData] = useState<EventRegistrationFormData>({
    eventRegistrationFee: '',
    eventRegistrationName: '',
    eventRegistrationDescription: '',
    freeEntryEnabled: true,
    freeEntryName: 'Free Entry',
    freeEntryDescription: 'Attend the event for free. Pay only for tournaments and merchandise you want.',
    freeEntryBenefits: defaultFreeEntryBenefits,
    paidEntryBenefits: defaultPaidEntryBenefits,
    spectatorPassEnabled: false,
    spectatorPassFee: '1000',
    spectatorPassName: 'Spectator Pass',
    spectatorPassDescription: 'Paid spectator access with additional perks.',
    spectatorPassBenefits: defaultSpectatorPassBenefits,
    earlyBirdFee: '',
    earlyBirdEndDate: '',
    showTournamentsForFree: true,
    showAddonsForFree: true,
    showTournamentsForSpectator: true,
    showAddonsForSpectator: true,
    supporterEntryStripeProductId: '',
    supporterEntryStripePriceId: '',
    supporterEntryStripeEarlyBirdProductId: '',
    supporterEntryStripeEarlyBirdPriceId: '',
    spectatorPassStripeProductId: '',
    spectatorPassStripePriceId: '',
  });
  const [syncingSupporterEntry, setSyncingSupporterEntry] = useState(false);
  const [syncingSpectatorPass, setSyncingSpectatorPass] = useState(false);
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);

  // Update form data when settings load
  useMemo(() => {
    if (Object.keys(settings).length > 0) {
      const parseBenefits = (jsonStr: string | undefined, fallback: string[]): string[] => {
        if (!jsonStr) return fallback;
        try {
          const parsed = JSON.parse(jsonStr);
          return Array.isArray(parsed) ? parsed : fallback;
        } catch {
          return fallback;
        }
      };

      setFormData({
        eventRegistrationFee: settings['event_registration_fee'] || '2000',
        eventRegistrationName: settings['event_registration_name'] || 'Supporter Entry',
        eventRegistrationDescription: settings['event_registration_description'] || 'Event registration with commemorative patch',
        freeEntryEnabled: settings['free_entry_enabled'] !== 'false',
        freeEntryName: settings['free_entry_name'] || 'Free Entry',
        freeEntryDescription: settings['free_entry_description'] || 'Attend the event for free. Pay only for tournaments and merchandise you want.',
        freeEntryBenefits: parseBenefits(settings['free_entry_benefits'], defaultFreeEntryBenefits),
        paidEntryBenefits: parseBenefits(settings['paid_entry_benefits'], defaultPaidEntryBenefits),
        spectatorPassEnabled: settings['spectator_pass_enabled'] === 'true',
        spectatorPassFee: settings['spectator_pass_fee'] || '1000',
        spectatorPassName: settings['spectator_pass_name'] || 'Spectator Pass',
        spectatorPassDescription: settings['spectator_pass_description'] || 'Paid spectator access with additional perks.',
        spectatorPassBenefits: parseBenefits(settings['spectator_pass_benefits'], defaultSpectatorPassBenefits),
        earlyBirdFee: settings['event_registration_early_bird_fee'] || '',
        earlyBirdEndDate: settings['event_registration_early_bird_end_date'] || '',
        showTournamentsForFree: settings['show_tournaments_for_free'] !== 'false',
        showAddonsForFree: settings['show_addons_for_free'] !== 'false',
        showTournamentsForSpectator: settings['show_tournaments_for_spectator'] !== 'false',
        showAddonsForSpectator: settings['show_addons_for_spectator'] !== 'false',
        supporterEntryStripeProductId: settings['supporter_entry_stripe_product_id'] || '',
        supporterEntryStripePriceId: settings['supporter_entry_stripe_price_id'] || '',
        supporterEntryStripeEarlyBirdProductId: settings['supporter_entry_stripe_early_bird_product_id'] || '',
        supporterEntryStripeEarlyBirdPriceId: settings['supporter_entry_stripe_early_bird_price_id'] || '',
        spectatorPassStripeProductId: settings['spectator_pass_stripe_product_id'] || '',
        spectatorPassStripePriceId: settings['spectator_pass_stripe_price_id'] || '',
      });
    }
  }, [settings]);

  const handleChange = (field: keyof EventRegistrationFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const updates: Array<{ key: string; value: string }> = [
      { key: 'event_registration_fee', value: formData.eventRegistrationFee },
      { key: 'event_registration_name', value: formData.eventRegistrationName },
      { key: 'event_registration_description', value: formData.eventRegistrationDescription },
      { key: 'free_entry_enabled', value: formData.freeEntryEnabled ? 'true' : 'false' },
      { key: 'free_entry_name', value: formData.freeEntryName },
      { key: 'free_entry_description', value: formData.freeEntryDescription },
      { key: 'free_entry_benefits', value: JSON.stringify(formData.freeEntryBenefits) },
      { key: 'paid_entry_benefits', value: JSON.stringify(formData.paidEntryBenefits) },
      { key: 'spectator_pass_enabled', value: formData.spectatorPassEnabled ? 'true' : 'false' },
      { key: 'spectator_pass_fee', value: formData.spectatorPassFee },
      { key: 'spectator_pass_name', value: formData.spectatorPassName },
      { key: 'spectator_pass_description', value: formData.spectatorPassDescription },
      { key: 'spectator_pass_benefits', value: JSON.stringify(formData.spectatorPassBenefits) },
      { key: 'event_registration_early_bird_fee', value: formData.earlyBirdFee },
      { key: 'event_registration_early_bird_end_date', value: formData.earlyBirdEndDate },
      { key: 'show_tournaments_for_free', value: formData.showTournamentsForFree ? 'true' : 'false' },
      { key: 'show_addons_for_free', value: formData.showAddonsForFree ? 'true' : 'false' },
      { key: 'show_tournaments_for_spectator', value: formData.showTournamentsForSpectator ? 'true' : 'false' },
      { key: 'show_addons_for_spectator', value: formData.showAddonsForSpectator ? 'true' : 'false' },
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
    alert('Event registration settings saved successfully!');
  };

  const handleSyncSupporterEntry = async () => {
    if (!formData.eventRegistrationFee || !formData.eventRegistrationName) {
      alert('Please save the Supporter Entry settings first before syncing to Stripe.');
      return;
    }

    setSyncingSupporterEntry(true);
    try {
      const price = parseInt(formData.eventRegistrationFee, 10);
      const earlyBirdPrice = formData.earlyBirdFee ? parseInt(formData.earlyBirdFee, 10) : null;

      const result = await syncEventRegistrationTierToStripe(
        'supporter_entry',
        formData.eventRegistrationName,
        formData.eventRegistrationDescription,
        price,
        earlyBirdPrice,
        formData.supporterEntryStripeProductId || null,
        formData.supporterEntryStripeEarlyBirdProductId || null
      );

      setFormData(prev => ({
        ...prev,
        supporterEntryStripeProductId: result.productId,
        supporterEntryStripePriceId: result.priceId,
        supporterEntryStripeEarlyBirdProductId: result.earlyBirdProductId || '',
        supporterEntryStripeEarlyBirdPriceId: result.earlyBirdPriceId || '',
      }));

      query.refetch();
      alert('Supporter Entry synced to Stripe successfully!');
    } catch (error) {
      console.error('Error syncing Supporter Entry to Stripe:', error);
      alert(`Failed to sync to Stripe: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSyncingSupporterEntry(false);
    }
  };

  const handleSyncSpectatorPass = async () => {
    if (!formData.spectatorPassFee || !formData.spectatorPassName) {
      alert('Please save the Spectator Pass settings first before syncing to Stripe.');
      return;
    }

    setSyncingSpectatorPass(true);
    try {
      const price = parseInt(formData.spectatorPassFee, 10);

      const result = await syncEventRegistrationTierToStripe(
        'spectator_pass',
        formData.spectatorPassName,
        formData.spectatorPassDescription,
        price,
        null, // No early bird for spectator pass
        formData.spectatorPassStripeProductId || null
      );

      setFormData(prev => ({
        ...prev,
        spectatorPassStripeProductId: result.productId,
        spectatorPassStripePriceId: result.priceId,
      }));

      query.refetch();
      alert('Spectator Pass synced to Stripe successfully!');
    } catch (error) {
      console.error('Error syncing Spectator Pass to Stripe:', error);
      alert(`Failed to sync to Stripe: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSyncingSpectatorPass(false);
    }
  };

  const handleBulkSyncAllTiers = async () => {
    if (!formData.eventRegistrationFee || !formData.eventRegistrationName) {
      alert('Please save settings first before syncing to Stripe.');
      return;
    }

    const tierCount = formData.spectatorPassEnabled ? 2 : 1;
    const confirmed = window.confirm(
      `This will sync ${tierCount} entry tier${tierCount > 1 ? 's' : ''} to Stripe:\n` +
      `• ${formData.eventRegistrationName}\n` +
      (formData.spectatorPassEnabled ? `• ${formData.spectatorPassName}\n` : '') +
      `\nEarly bird pricing will create separate products.\n\nContinue?`
    );

    if (!confirmed) return;

    setIsBulkSyncing(true);
    try {
      const results = await bulkSyncEventRegistrationTiersToStripe({
        supporterEntryName: formData.eventRegistrationName,
        supporterEntryDescription: formData.eventRegistrationDescription,
        supporterEntryFee: parseInt(formData.eventRegistrationFee, 10),
        supporterEarlyBirdFee: formData.earlyBirdFee ? parseInt(formData.earlyBirdFee, 10) : null,
        supporterEntryStripeProductId: formData.supporterEntryStripeProductId || null,
        supporterEntryStripeEarlyBirdProductId: formData.supporterEntryStripeEarlyBirdProductId || null,
        spectatorPassEnabled: formData.spectatorPassEnabled,
        spectatorPassName: formData.spectatorPassName,
        spectatorPassDescription: formData.spectatorPassDescription,
        spectatorPassFee: parseInt(formData.spectatorPassFee, 10),
        spectatorPassStripeProductId: formData.spectatorPassStripeProductId || null,
      });

      // Update form data with new Stripe IDs
      setFormData(prev => ({
        ...prev,
        supporterEntryStripeProductId: results.supporterEntry?.productId || prev.supporterEntryStripeProductId,
        supporterEntryStripePriceId: results.supporterEntry?.priceId || prev.supporterEntryStripePriceId,
        spectatorPassStripeProductId: results.spectatorPass?.productId || prev.spectatorPassStripeProductId,
        spectatorPassStripePriceId: results.spectatorPass?.priceId || prev.spectatorPassStripePriceId,
      }));

      query.refetch();

      const successCount = (results.supporterEntry?.success ? 1 : 0) + (results.spectatorPass?.success ? 1 : 0);
      const failCount = tierCount - successCount;

      if (failCount === 0) {
        alert(`Successfully synced all ${successCount} entry tier${successCount > 1 ? 's' : ''} to Stripe!`);
      } else {
        const failures = [];
        if (results.supporterEntry && !results.supporterEntry.success) failures.push(results.supporterEntry.name);
        if (results.spectatorPass && !results.spectatorPass.success) failures.push(results.spectatorPass.name);
        alert(`Synced ${successCount} tier${successCount !== 1 ? 's' : ''}. ${failCount} failed:\n${failures.join(', ')}`);
      }
    } catch (error) {
      console.error('Error bulk syncing entry tiers:', error);
      alert(`Bulk sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsBulkSyncing(false);
    }
  };

  const isSupporterEntrySynced = Boolean(formData.supporterEntryStripeProductId && formData.supporterEntryStripePriceId);
  const isSpectatorPassSynced = Boolean(formData.spectatorPassStripeProductId && formData.spectatorPassStripePriceId);

  const feeInDollars = formData.eventRegistrationFee ? (parseInt(formData.eventRegistrationFee, 10) / 100).toFixed(2) : '0.00';
  const earlyBirdFeeInDollars = formData.earlyBirdFee ? (parseInt(formData.earlyBirdFee, 10) / 100).toFixed(2) : '0.00';
  const isEarlyBirdConfigured = formData.earlyBirdFee && formData.earlyBirdEndDate;
  const isEarlyBirdActive = isEarlyBirdConfigured && new Date() < new Date(formData.earlyBirdEndDate);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-white">Loading settings...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-viking text-white">Event Registration Settings</h1>
          <p className="text-white/80 mt-2">Configure the paid event entry option shown during registration</p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={handleBulkSyncAllTiers}
          disabled={isBulkSyncing}
        >
          {isBulkSyncing ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Syncing All Tiers...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Sync All Tiers to Stripe
            </>
          )}
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Entry Type Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <p className="text-sm text-blue-800">
                Configure the entry options that appear during event registration.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                <div className="flex items-center gap-3">
                  <ToggleLeft className="h-5 w-5 text-gray-600" />
                  <div>
                    <Label htmlFor="freeEntryEnabled" className="font-medium cursor-pointer text-black">
                      Enable Free Entry Option
                    </Label>
                    <p className="text-xs text-gray-500 mt-0.5">
                      When enabled, users can choose between free entry and paid entry. When disabled, only the paid option is shown.
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  id="freeEntryEnabled"
                  checked={formData.freeEntryEnabled}
                  onChange={(e) => setFormData(prev => ({ ...prev, freeEntryEnabled: e.target.checked }))}
                  className="h-5 w-5 rounded border-gray-300 text-orange-500 focus:ring-orange-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Free Entry Configuration - only shown when free entry is enabled */}
            {formData.freeEntryEnabled && (
              <div className="space-y-4 border-t pt-4">
                <h4 className="font-medium text-gray-900">Free Entry Configuration</h4>
                <div>
                  <Label htmlFor="freeEntryName" className="flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Free Entry Name
                  </Label>
                  <Input
                    id="freeEntryName"
                    value={formData.freeEntryName}
                    onChange={(e) => handleChange('freeEntryName', e.target.value)}
                    placeholder="Free Entry"
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    The name displayed for the free entry option (e.g., "Spectator Pass", "Free Entry", "General Admission")
                  </p>
                </div>

                <div>
                  <Label htmlFor="freeEntryDescription" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Free Entry Description
                  </Label>
                  <textarea
                    id="freeEntryDescription"
                    value={formData.freeEntryDescription}
                    onChange={(e) => handleChange('freeEntryDescription', e.target.value)}
                    placeholder="Attend the event for free. Pay only for tournaments and merchandise you want."
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-black focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    rows={2}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    A brief description of what's included with the free entry
                  </p>
                </div>

                <div className="space-y-3">
                  <Label className="font-medium">Available Steps for Free Entry</Label>
                  <p className="text-xs text-gray-500">
                    Select which registration steps are available for users who choose free entry
                  </p>

                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="showTournamentsForFree" className="cursor-pointer text-black text-sm">
                        Allow Tournament Registration
                      </Label>
                    </div>
                    <input
                      type="checkbox"
                      id="showTournamentsForFree"
                      checked={formData.showTournamentsForFree}
                      onChange={(e) => setFormData(prev => ({ ...prev, showTournamentsForFree: e.target.checked }))}
                      className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="showAddonsForFree" className="cursor-pointer text-black text-sm">
                        Allow Merchandise/Add-ons Purchase
                      </Label>
                    </div>
                    <input
                      type="checkbox"
                      id="showAddonsForFree"
                      checked={formData.showAddonsForFree}
                      onChange={(e) => setFormData(prev => ({ ...prev, showAddonsForFree: e.target.checked }))}
                      className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500 cursor-pointer"
                    />
                  </div>

                  {!formData.showTournamentsForFree && !formData.showAddonsForFree && (
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                      <p className="text-sm text-blue-800">
                        With both options disabled, free registrations will skip directly to confirmation after selecting free entry. Users will still be recorded in the system for attendance tracking.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Spectator Pass Configuration */}
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                <div className="flex items-center gap-3">
                  <ToggleLeft className="h-5 w-5 text-gray-600" />
                  <div>
                    <Label htmlFor="spectatorPassEnabled" className="font-medium cursor-pointer text-black">
                      Enable Paid Spectator Pass
                    </Label>
                    <p className="text-xs text-gray-500 mt-0.5">
                      When enabled, users can choose a paid spectator pass as a middle tier option.
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  id="spectatorPassEnabled"
                  checked={formData.spectatorPassEnabled}
                  onChange={(e) => setFormData(prev => ({ ...prev, spectatorPassEnabled: e.target.checked }))}
                  className="h-5 w-5 rounded border-gray-300 text-orange-500 focus:ring-orange-500 cursor-pointer"
                />
              </div>

              {formData.spectatorPassEnabled && (
                <div className="space-y-4 pl-4 border-l-2 border-orange-200">
                  <h4 className="font-medium text-gray-900">Spectator Pass Configuration</h4>
                  <div>
                    <Label htmlFor="spectatorPassName" className="flex items-center gap-2">
                      <Tag className="h-4 w-4" />
                      Spectator Pass Name
                    </Label>
                    <Input
                      id="spectatorPassName"
                      value={formData.spectatorPassName}
                      onChange={(e) => handleChange('spectatorPassName', e.target.value)}
                      placeholder="Spectator Pass"
                      className="mt-1"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      The name displayed for the spectator pass option
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="spectatorPassFee" className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Spectator Pass Fee (in cents)
                    </Label>
                    <div className="flex items-center gap-3 mt-1">
                      <Input
                        id="spectatorPassFee"
                        type="number"
                        min="0"
                        step="1"
                        value={formData.spectatorPassFee}
                        onChange={(e) => handleChange('spectatorPassFee', e.target.value)}
                        placeholder="1000"
                        className="flex-1"
                      />
                      <div className="bg-turquoise-100 border border-turquoise-300 rounded-md px-4 py-2">
                        <span className="text-turquoise-800 font-semibold">
                          ${formData.spectatorPassFee ? (parseInt(formData.spectatorPassFee, 10) / 100).toFixed(2) : '0.00'}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Enter the fee in cents (e.g., 1000 = $10.00, 1500 = $15.00)
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="spectatorPassDescription" className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Spectator Pass Description
                    </Label>
                    <textarea
                      id="spectatorPassDescription"
                      value={formData.spectatorPassDescription}
                      onChange={(e) => handleChange('spectatorPassDescription', e.target.value)}
                      placeholder="Paid spectator access with additional perks."
                      className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-black focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                      rows={2}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      A brief description of what's included with the spectator pass
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Label className="font-medium">Available Steps for Spectator Pass</Label>
                    <p className="text-xs text-gray-500">
                      Select which registration steps are available for users who choose the spectator pass
                    </p>

                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="showTournamentsForSpectator" className="cursor-pointer text-black text-sm">
                          Allow Tournament Registration
                        </Label>
                      </div>
                      <input
                        type="checkbox"
                        id="showTournamentsForSpectator"
                        checked={formData.showTournamentsForSpectator}
                        onChange={(e) => setFormData(prev => ({ ...prev, showTournamentsForSpectator: e.target.checked }))}
                        className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500 cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="showAddonsForSpectator" className="cursor-pointer text-black text-sm">
                          Allow Merchandise/Add-ons Purchase
                        </Label>
                      </div>
                      <input
                        type="checkbox"
                        id="showAddonsForSpectator"
                        checked={formData.showAddonsForSpectator}
                        onChange={(e) => setFormData(prev => ({ ...prev, showAddonsForSpectator: e.target.checked }))}
                        className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500 cursor-pointer"
                      />
                    </div>

                    {!formData.showTournamentsForSpectator && !formData.showAddonsForSpectator && (
                      <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                        <p className="text-sm text-blue-800">
                          With both options disabled, spectator pass registrations will proceed directly to checkout after selecting the spectator pass.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Stripe Sync for Spectator Pass */}
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isSpectatorPassSynced ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-yellow-500" />
                        )}
                        <div>
                          <p className="font-medium text-gray-900">Stripe Product Sync</p>
                          <p className="text-xs text-gray-500">
                            {isSpectatorPassSynced
                              ? `Synced: ${formData.spectatorPassStripeProductId?.slice(0, 20)}...`
                              : 'Not yet synced to Stripe'}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleSyncSpectatorPass}
                        disabled={syncingSpectatorPass}
                      >
                        {syncingSpectatorPass ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Syncing...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            {isSpectatorPassSynced ? 'Re-sync to Stripe' : 'Sync to Stripe'}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4 border-t pt-4">
              <h4 className="font-medium text-gray-900">Paid Entry Configuration</h4>
              <div>
                <Label htmlFor="eventRegistrationName" className="flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Entry Name
                </Label>
                <Input
                  id="eventRegistrationName"
                  value={formData.eventRegistrationName}
                  onChange={(e) => handleChange('eventRegistrationName', e.target.value)}
                  placeholder="Supporter Entry"
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  The name displayed for the paid entry option (e.g., "Supporter Entry", "VIP Pass", "Premium Entry")
                </p>
              </div>

              <div>
                <Label htmlFor="eventRegistrationFee" className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Entry Fee (in cents)
                </Label>
                <div className="flex items-center gap-3 mt-1">
                  <Input
                    id="eventRegistrationFee"
                    type="number"
                    min="0"
                    step="1"
                    value={formData.eventRegistrationFee}
                    onChange={(e) => handleChange('eventRegistrationFee', e.target.value)}
                    placeholder="2000"
                    className="flex-1"
                  />
                  <div className="bg-turquoise-100 border border-turquoise-300 rounded-md px-4 py-2">
                    <span className="text-turquoise-800 font-semibold">${feeInDollars}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Enter the fee in cents (e.g., 2000 = $20.00, 1500 = $15.00)
                </p>
              </div>

              <div>
                <Label htmlFor="eventRegistrationDescription" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Entry Description
                </Label>
                <textarea
                  id="eventRegistrationDescription"
                  value={formData.eventRegistrationDescription}
                  onChange={(e) => handleChange('eventRegistrationDescription', e.target.value)}
                  placeholder="Event registration with commemorative patch"
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-black focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  rows={2}
                />
                <p className="text-xs text-gray-500 mt-1">
                  A brief description of what's included with the paid entry
                </p>
              </div>

              {/* Stripe Sync for Supporter Entry */}
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isSupporterEntrySynced ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-yellow-500" />
                    )}
                    <div>
                      <p className="font-medium text-gray-900">Stripe Product Sync</p>
                      <p className="text-xs text-gray-500">
                        {isSupporterEntrySynced
                          ? `Synced: ${formData.supporterEntryStripeProductId?.slice(0, 20)}...`
                          : 'Not yet synced to Stripe'}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSyncSupporterEntry}
                    disabled={syncingSupporterEntry}
                  >
                    {syncingSupporterEntry ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        {isSupporterEntrySynced ? 'Re-sync to Stripe' : 'Sync to Stripe'}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <List className="h-5 w-5" />
              Entry Benefits
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <p className="text-sm text-blue-800">
                Configure the benefits shown for each entry tier. These appear as checkmarked items in the registration flow.
              </p>
            </div>

            <div className={`grid gap-6 ${formData.spectatorPassEnabled ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}>
              {/* Free Entry Benefits */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2 font-medium">
                  Free Entry Benefits
                </Label>
                <div className="space-y-2">
                  {formData.freeEntryBenefits.map((benefit, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-orange-500 flex-shrink-0" />
                      <Input
                        value={benefit}
                        onChange={(e) => {
                          const newBenefits = [...formData.freeEntryBenefits];
                          newBenefits[index] = e.target.value;
                          setFormData(prev => ({ ...prev, freeEntryBenefits: newBenefits }));
                        }}
                        className="flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newBenefits = formData.freeEntryBenefits.filter((_, i) => i !== index);
                          setFormData(prev => ({ ...prev, freeEntryBenefits: newBenefits }));
                        }}
                        className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFormData(prev => ({ ...prev, freeEntryBenefits: [...prev.freeEntryBenefits, ''] }))}
                  className="mt-2"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Benefit
                </Button>
              </div>

              {/* Spectator Pass Benefits */}
              {formData.spectatorPassEnabled && (
                <div className="space-y-3">
                  <Label className="flex items-center gap-2 font-medium">
                    Spectator Pass Benefits
                  </Label>
                  <div className="space-y-2">
                    {formData.spectatorPassBenefits.map((benefit, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-orange-500 flex-shrink-0" />
                        <Input
                          value={benefit}
                          onChange={(e) => {
                            const newBenefits = [...formData.spectatorPassBenefits];
                            newBenefits[index] = e.target.value;
                            setFormData(prev => ({ ...prev, spectatorPassBenefits: newBenefits }));
                          }}
                          className="flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const newBenefits = formData.spectatorPassBenefits.filter((_, i) => i !== index);
                            setFormData(prev => ({ ...prev, spectatorPassBenefits: newBenefits }));
                          }}
                          className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFormData(prev => ({ ...prev, spectatorPassBenefits: [...prev.spectatorPassBenefits, ''] }))}
                    className="mt-2"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Benefit
                  </Button>
                </div>
              )}

              {/* Paid Entry Benefits */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2 font-medium">
                  Paid Entry Benefits
                </Label>
                <div className="space-y-2">
                  {formData.paidEntryBenefits.map((benefit, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-orange-500 flex-shrink-0" />
                      <Input
                        value={benefit}
                        onChange={(e) => {
                          const newBenefits = [...formData.paidEntryBenefits];
                          newBenefits[index] = e.target.value;
                          setFormData(prev => ({ ...prev, paidEntryBenefits: newBenefits }));
                        }}
                        className="flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newBenefits = formData.paidEntryBenefits.filter((_, i) => i !== index);
                          setFormData(prev => ({ ...prev, paidEntryBenefits: newBenefits }));
                        }}
                        className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFormData(prev => ({ ...prev, paidEntryBenefits: [...prev.paidEntryBenefits, ''] }))}
                  className="mt-2"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Benefit
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Early Bird Pricing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <p className="text-sm text-green-800">
                Offer a discounted rate for early registrations. When configured, users who register before the end date will see the early bird price instead of the regular price.
              </p>
            </div>

            {isEarlyBirdActive && (
              <div className="bg-orange-50 border border-orange-300 rounded-md p-4 flex items-center gap-3">
                <Clock className="h-5 w-5 text-orange-600" />
                <p className="text-sm text-orange-800 font-medium">
                  Early bird pricing is currently active! Users will see ${earlyBirdFeeInDollars} instead of ${feeInDollars}.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="earlyBirdFee" className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Early Bird Fee (in cents)
                </Label>
                <div className="flex items-center gap-3 mt-1">
                  <Input
                    id="earlyBirdFee"
                    type="number"
                    min="0"
                    step="1"
                    value={formData.earlyBirdFee}
                    onChange={(e) => handleChange('earlyBirdFee', e.target.value)}
                    placeholder="1500"
                    className="flex-1"
                  />
                  {formData.earlyBirdFee && (
                    <div className="bg-green-100 border border-green-300 rounded-md px-4 py-2">
                      <span className="text-green-800 font-semibold">${earlyBirdFeeInDollars}</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  The discounted price for early registrations (e.g., 1500 = $15.00). Leave empty to disable early bird pricing.
                </p>
              </div>

              <div>
                <Label htmlFor="earlyBirdEndDate" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Early Bird End Date
                </Label>
                <Input
                  id="earlyBirdEndDate"
                  type="datetime-local"
                  value={formData.earlyBirdEndDate}
                  onChange={(e) => handleChange('earlyBirdEndDate', e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  The date and time when early bird pricing ends. After this date, users will see the regular price.
                </p>
              </div>
            </div>

            {formData.earlyBirdFee && !formData.earlyBirdEndDate && (
              <div className="bg-yellow-50 border border-yellow-300 rounded-md p-4">
                <p className="text-sm text-yellow-800">
                  Please set an end date for early bird pricing to take effect.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-turquoise-700/50 border-2 border-orange-500 rounded-lg p-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-lg font-semibold text-white">{formData.eventRegistrationName || 'Supporter Entry'}</h3>
                  <p className="text-2xl font-bold text-orange-400 mt-1">${feeInDollars}</p>
                </div>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-orange-500 text-white text-xs font-semibold">
                  Supporter
                </span>
              </div>
              <p className="text-sm text-orange-200">
                {formData.eventRegistrationDescription || 'Event registration with commemorative patch'}
              </p>
              <ul className="mt-4 space-y-2 text-sm text-orange-100">
                {formData.paidEntryBenefits.filter(b => b.trim()).map((benefit, index) => (
                  <li key={index} className="flex items-start">
                    <Check className="h-4 w-4 text-orange-400 mr-2 mt-0.5 flex-shrink-0" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-xs text-gray-500 mt-3 text-center">
              This is how the paid entry option will appear during registration
            </p>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end">
          <Button type="submit" disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </form>
    </div>
  );
};
