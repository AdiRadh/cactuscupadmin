import { supabase } from '@/lib/supabase';
import { isCurrentlyBetween } from './dateUtils';

export interface CreateStripeProductRequest {
  name: string;
  description?: string;
  price: number; // in cents
  resourceType: 'tournament' | 'addon' | 'activity' | 'special_event' | 'event_registration_tier';
  resourceId: string; // For event_registration_tier: 'supporter_entry' or 'spectator_pass'
  category?: 'apparel' | 'merchandise' | 'equipment' | 'food' | 'other'; // For addons only
  earlyBirdPrice?: number; // in cents
  earlyBirdStartDate?: string;
  earlyBirdEndDate?: string;
  // Optional existing product IDs for update operations (bulk sync)
  existingProductId?: string;
  existingEarlyBirdProductId?: string;
}

export interface StripeProductResponse {
  productId: string;
  priceId: string;
  earlyBirdProductId?: string;
  earlyBirdPriceId?: string;
}

export interface ActivePrice {
  price: number;
  priceId: string | null;
  isEarlyBird: boolean;
}

/**
 * Create a Stripe product and price for a tournament or add-on
 * Calls Supabase Edge Function to handle Stripe API securely
 */
export async function createStripeProduct(
  request: CreateStripeProductRequest
): Promise<StripeProductResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('create-stripe-product', {
      body: request,
    });

    if (error) {
      console.error('Error creating Stripe product:', error);
      throw new Error(error.message || 'Failed to create Stripe product');
    }

    if (!data || !data.productId || !data.priceId) {
      throw new Error('Invalid response from Stripe product creation');
    }

    return {
      productId: data.productId,
      priceId: data.priceId,
      earlyBirdProductId: data.earlyBirdProductId,
      earlyBirdPriceId: data.earlyBirdPriceId,
    };
  } catch (err) {
    console.error('Stripe product creation failed:', err);
    throw err instanceof Error ? err : new Error('Failed to create Stripe product');
  }
}

/**
 * Update tournament record with Stripe product and price IDs
 */
export async function updateTournamentStripeIds(
  tournamentId: string,
  productId: string,
  priceId: string
): Promise<void> {
  const { error } = await supabase
    .from('tournaments')
    .update({
      stripe_product_id: productId,
      stripe_price_id: priceId,
    })
    .eq('id', tournamentId);

  if (error) {
    console.error('Error updating tournament Stripe IDs:', error);
    throw new Error('Failed to update tournament with Stripe IDs');
  }
}

/**
 * Update add-on record with Stripe product and price IDs
 */
export async function updateAddonStripeIds(
  addonId: string,
  productId: string,
  priceId: string
): Promise<void> {
  const { error } = await supabase
    .from('addons')
    .update({
      stripe_product_id: productId,
      stripe_price_id: priceId,
    })
    .eq('id', addonId);

  if (error) {
    console.error('Error updating add-on Stripe IDs:', error);
    throw new Error('Failed to update add-on with Stripe IDs');
  }
}

/**
 * Create Stripe product for a tournament and update the database
 */
export async function syncTournamentToStripe(
  tournamentId: string,
  name: string,
  description: string | null,
  price: number
): Promise<StripeProductResponse> {
  const { productId, priceId } = await createStripeProduct({
    name,
    ...(description && { description }),
    price,
    resourceType: 'tournament',
    resourceId: tournamentId,
  });

  await updateTournamentStripeIds(tournamentId, productId, priceId);

  return { productId, priceId };
}

/**
 * Create Stripe product for an add-on and update the database
 */
export async function syncAddonToStripe(
  addonId: string,
  name: string,
  description: string | null,
  price: number
): Promise<StripeProductResponse> {
  const { productId, priceId } = await createStripeProduct({
    name,
    ...(description && { description }),
    price,
    resourceType: 'addon',
    resourceId: addonId,
  });

  await updateAddonStripeIds(addonId, productId, priceId);

  return { productId, priceId };
}

/**
 * Sync addon pricing to Stripe (create or update)
 * Updates existing products if they exist, creates new ones if not
 */
export async function syncAddonPricing(
  addonId: string,
  name: string,
  description: string | null,
  price: number,
  existingProductId?: string | null,
  category?: 'apparel' | 'merchandise' | 'equipment' | 'food' | 'other' | null
): Promise<StripeProductResponse> {
  const request: CreateStripeProductRequest = {
    name,
    ...(description && { description }),
    price,
    resourceType: 'addon',
    resourceId: addonId,
  };

  // Include category for Stripe product metadata
  if (category) {
    request.category = category;
  }

  // Include existing product ID for update operations
  if (existingProductId) {
    request.existingProductId = existingProductId;
  }

  const response = await createStripeProduct(request);

  await updateAddonStripeIds(addonId, response.productId, response.priceId);

  return response;
}

/**
 * Check if early bird pricing is currently active
 * Uses UTC comparison for consistent behavior regardless of user's timezone
 */
export function isEarlyBirdActive(
  earlyBirdStart?: string | null,
  earlyBirdEnd?: string | null
): boolean {
  return isCurrentlyBetween(earlyBirdStart, earlyBirdEnd);
}

/**
 * Get the active price for an event (early bird or regular)
 */
export function getActivePrice(event: {
  registrationFee?: number;
  fee?: number;
  ticketPrice?: number;
  earlyBirdPrice?: number | null;
  earlyBirdTicketPrice?: number | null;
  earlyBirdStartDate?: string | null;
  earlyBirdEndDate?: string | null;
  stripePriceId?: string | null;
  stripeEarlyBirdPriceId?: string | null;
}): ActivePrice {
  const isEarlyBird = isEarlyBirdActive(
    event.earlyBirdStartDate,
    event.earlyBirdEndDate
  );

  // Determine base price field (tournaments use registrationFee, activities use fee, special events use ticketPrice)
  const basePrice = event.registrationFee ?? event.fee ?? event.ticketPrice ?? 0;
  const earlyPrice = event.earlyBirdPrice ?? event.earlyBirdTicketPrice;

  if (isEarlyBird && earlyPrice != null) {
    return {
      price: earlyPrice,
      priceId: event.stripeEarlyBirdPriceId || null,
      isEarlyBird: true,
    };
  }

  return {
    price: basePrice,
    priceId: event.stripePriceId || null,
    isEarlyBird: false,
  };
}

/**
 * Update tournament record with Stripe IDs (including early bird)
 */
export async function updateTournamentStripeIdsWithEarlyBird(
  tournamentId: string,
  productId: string,
  priceId: string,
  earlyBirdProductId?: string,
  earlyBirdPriceId?: string
): Promise<void> {
  const updateData: any = {
    stripe_product_id: productId,
    stripe_price_id: priceId,
  };

  if (earlyBirdProductId) {
    updateData.stripe_early_bird_product_id = earlyBirdProductId;
  }
  if (earlyBirdPriceId) {
    updateData.stripe_early_bird_price_id = earlyBirdPriceId;
  }

  const { error } = await supabase
    .from('tournaments')
    .update(updateData)
    .eq('id', tournamentId);

  if (error) {
    console.error('Error updating tournament Stripe IDs:', error);
    throw new Error('Failed to update tournament with Stripe IDs');
  }
}

/**
 * Update activity record with Stripe IDs (including early bird)
 */
export async function updateActivityStripeIds(
  activityId: string,
  productId: string,
  priceId: string,
  earlyBirdPriceId?: string
): Promise<void> {
  const updateData: any = {
    stripe_product_id: productId,
    stripe_price_id: priceId,
  };

  if (earlyBirdPriceId) {
    updateData.stripe_early_bird_price_id = earlyBirdPriceId;
  }

  const { error } = await supabase
    .from('activities')
    .update(updateData)
    .eq('id', activityId);

  if (error) {
    console.error('Error updating activity Stripe IDs:', error);
    throw new Error('Failed to update activity with Stripe IDs');
  }
}

/**
 * Update special event record with Stripe IDs (including early bird)
 */
export async function updateSpecialEventStripeIds(
  eventId: string,
  productId: string,
  priceId: string,
  earlyBirdPriceId?: string
): Promise<void> {
  const updateData: any = {
    stripe_product_id: productId,
    stripe_price_id: priceId,
  };

  if (earlyBirdPriceId) {
    updateData.stripe_early_bird_price_id = earlyBirdPriceId;
  }

  const { error} = await supabase
    .from('special_events')
    .update(updateData)
    .eq('id', eventId);

  if (error) {
    console.error('Error updating special event Stripe IDs:', error);
    throw new Error('Failed to update special event with Stripe IDs');
  }
}

/**
 * Check if Stripe product exists for a resource
 */
export function hasStripeProduct(resource: {
  stripeProductId?: string | null;
  stripePriceId?: string | null;
}): boolean {
  return !!(resource.stripeProductId && resource.stripePriceId);
}

/**
 * Sync tournament pricing to Stripe (create or update)
 */
export async function syncTournamentPricing(
  tournamentId: string,
  name: string,
  description: string | null,
  regularPrice: number,
  earlyBirdPrice?: number | null,
  earlyBirdStartDate?: string | null,
  earlyBirdEndDate?: string | null,
  existingProductId?: string | null,
  existingEarlyBirdProductId?: string | null
): Promise<StripeProductResponse> {
  const request: CreateStripeProductRequest = {
    name,
    ...(description && { description }),
    price: regularPrice,
    resourceType: 'tournament',
    resourceId: tournamentId,
  };

  // Include early bird pricing if provided (creates separate product)
  if (earlyBirdPrice && earlyBirdStartDate && earlyBirdEndDate) {
    request.earlyBirdPrice = earlyBirdPrice;
    request.earlyBirdStartDate = earlyBirdStartDate;
    request.earlyBirdEndDate = earlyBirdEndDate;
  }

  // Include existing product IDs for update operations
  if (existingProductId) {
    request.existingProductId = existingProductId;
  }
  if (existingEarlyBirdProductId) {
    request.existingEarlyBirdProductId = existingEarlyBirdProductId;
  }

  const response = await createStripeProduct(request);

  await updateTournamentStripeIdsWithEarlyBird(
    tournamentId,
    response.productId,
    response.priceId,
    response.earlyBirdProductId,
    response.earlyBirdPriceId
  );

  return response;
}

/**
 * Sync activity pricing to Stripe (create or update)
 */
export async function syncActivityPricing(
  activityId: string,
  title: string,
  description: string,
  regularPrice: number,
  earlyBirdPrice?: number | null,
  earlyBirdStartDate?: string | null,
  earlyBirdEndDate?: string | null
): Promise<StripeProductResponse> {
  const request: CreateStripeProductRequest = {
    name: title,
    description,
    price: regularPrice,
    resourceType: 'activity',
    resourceId: activityId,
  };

  // Include early bird pricing if provided
  if (earlyBirdPrice && earlyBirdStartDate && earlyBirdEndDate) {
    request.earlyBirdPrice = earlyBirdPrice;
    request.earlyBirdStartDate = earlyBirdStartDate;
    request.earlyBirdEndDate = earlyBirdEndDate;
  }

  const response = await createStripeProduct(request);

  await updateActivityStripeIds(
    activityId,
    response.productId,
    response.priceId,
    response.earlyBirdPriceId
  );

  return response;
}

/**
 * Sync special event pricing to Stripe (create or update)
 */
export async function syncSpecialEventPricing(
  eventId: string,
  title: string,
  description: string,
  ticketPrice: number,
  earlyBirdPrice?: number | null,
  earlyBirdStartDate?: string | null,
  earlyBirdEndDate?: string | null
): Promise<StripeProductResponse> {
  const request: CreateStripeProductRequest = {
    name: title,
    description,
    price: ticketPrice,
    resourceType: 'special_event',
    resourceId: eventId,
  };

  // Include early bird pricing if provided
  if (earlyBirdPrice && earlyBirdStartDate && earlyBirdEndDate) {
    request.earlyBirdPrice = earlyBirdPrice;
    request.earlyBirdStartDate = earlyBirdStartDate;
    request.earlyBirdEndDate = earlyBirdEndDate;
  }

  const response = await createStripeProduct(request);

  await updateSpecialEventStripeIds(
    eventId,
    response.productId,
    response.priceId,
    response.earlyBirdPriceId
  );

  return response;
}

/**
 * Helper to upsert a site_setting value
 */
async function upsertSiteSetting(key: string, value: string): Promise<void> {
  // First check if the setting exists
  const { data: existing } = await supabase
    .from('site_settings')
    .select('id')
    .eq('setting_key', key)
    .single();

  if (existing) {
    const { error } = await supabase
      .from('site_settings')
      .update({ setting_value: value })
      .eq('setting_key', key);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('site_settings')
      .insert({ setting_key: key, setting_value: value, setting_type: 'text' });
    if (error) throw error;
  }
}

/**
 * Update site_settings with Stripe IDs for event registration tier (supporter_entry or spectator_pass)
 */
export async function updateEventRegistrationTierStripeIds(
  tierId: 'supporter_entry' | 'spectator_pass',
  productId: string,
  priceId: string,
  earlyBirdProductId?: string,
  earlyBirdPriceId?: string
): Promise<void> {
  const prefix = tierId === 'supporter_entry' ? 'supporter_entry' : 'spectator_pass';

  await upsertSiteSetting(`${prefix}_stripe_product_id`, productId);
  await upsertSiteSetting(`${prefix}_stripe_price_id`, priceId);

  if (earlyBirdProductId) {
    await upsertSiteSetting(`${prefix}_stripe_early_bird_product_id`, earlyBirdProductId);
  }
  if (earlyBirdPriceId) {
    await upsertSiteSetting(`${prefix}_stripe_early_bird_price_id`, earlyBirdPriceId);
  }
}

/**
 * Sync event registration tier (supporter_entry or spectator_pass) to Stripe
 * Updates existing products if they exist, creates new ones if not
 */
export async function syncEventRegistrationTierToStripe(
  tierId: 'supporter_entry' | 'spectator_pass',
  name: string,
  description: string,
  price: number,
  earlyBirdPrice?: number | null,
  existingProductId?: string | null,
  existingEarlyBirdProductId?: string | null
): Promise<StripeProductResponse> {
  const request: CreateStripeProductRequest = {
    name,
    description,
    price,
    resourceType: 'event_registration_tier',
    resourceId: tierId,
  };

  // Include early bird pricing if provided (creates separate product)
  if (earlyBirdPrice && earlyBirdPrice > 0) {
    request.earlyBirdPrice = earlyBirdPrice;
  }

  // Include existing product IDs for update operations
  if (existingProductId) {
    request.existingProductId = existingProductId;
  }
  if (existingEarlyBirdProductId) {
    request.existingEarlyBirdProductId = existingEarlyBirdProductId;
  }

  const response = await createStripeProduct(request);

  await updateEventRegistrationTierStripeIds(
    tierId,
    response.productId,
    response.priceId,
    response.earlyBirdProductId,
    response.earlyBirdPriceId
  );

  return response;
}

// ============ BULK SYNC FUNCTIONS ============

export interface Tournament {
  id: string;
  name: string;
  description: string | null;
  registration_fee: number;
  early_bird_price: number | null;
  early_bird_start_date: string | null;
  early_bird_end_date: string | null;
  stripe_product_id: string | null;
  stripe_early_bird_product_id: string | null;
}

export interface BulkSyncResult {
  success: boolean;
  id: string;
  name: string;
  error?: string;
  productId?: string;
  priceId?: string;
}

/**
 * Bulk sync all tournaments to Stripe
 * Updates existing products if they exist, creates new ones if not
 * @param onProgress - Optional callback for progress updates
 */
export async function bulkSyncTournamentsToStripe(
  onProgress?: (current: number, total: number, result: BulkSyncResult) => void
): Promise<BulkSyncResult[]> {
  // Fetch all tournaments including existing Stripe product IDs
  const { data: tournaments, error } = await supabase
    .from('tournaments')
    .select('id, name, description, registration_fee, early_bird_price, early_bird_start_date, early_bird_end_date, stripe_product_id, stripe_early_bird_product_id')
    .order('name');

  if (error) {
    throw new Error(`Failed to fetch tournaments: ${error.message}`);
  }

  if (!tournaments || tournaments.length === 0) {
    return [];
  }

  const results: BulkSyncResult[] = [];

  for (let i = 0; i < tournaments.length; i++) {
    const tournament = tournaments[i]!;
    let result: BulkSyncResult;

    try {
      // Pass existing product IDs to update instead of create
      const response = await syncTournamentPricing(
        tournament.id,
        tournament.name,
        tournament.description,
        tournament.registration_fee,
        tournament.early_bird_price,
        tournament.early_bird_start_date,
        tournament.early_bird_end_date,
        tournament.stripe_product_id,
        tournament.stripe_early_bird_product_id
      );

      result = {
        success: true,
        id: tournament.id,
        name: tournament.name,
        productId: response.productId,
        priceId: response.priceId,
      };
    } catch (err) {
      result = {
        success: false,
        id: tournament.id,
        name: tournament.name,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }

    results.push(result);

    if (onProgress) {
      onProgress(i + 1, tournaments.length, result);
    }
  }

  return results;
}

/**
 * Sync all event registration tiers (supporter entry and spectator pass) to Stripe
 * Updates existing products if they exist, creates new ones if not
 */
export async function bulkSyncEventRegistrationTiersToStripe(
  settings: {
    supporterEntryName: string;
    supporterEntryDescription: string;
    supporterEntryFee: number;
    supporterEarlyBirdFee: number | null;
    supporterEntryStripeProductId: string | null;
    supporterEntryStripeEarlyBirdProductId: string | null;
    spectatorPassEnabled: boolean;
    spectatorPassName: string;
    spectatorPassDescription: string;
    spectatorPassFee: number;
    spectatorPassStripeProductId: string | null;
  },
  onProgress?: (current: number, total: number, tierName: string, success: boolean) => void
): Promise<{ supporterEntry?: BulkSyncResult; spectatorPass?: BulkSyncResult }> {
  const results: { supporterEntry?: BulkSyncResult; spectatorPass?: BulkSyncResult } = {};
  const total = settings.spectatorPassEnabled ? 2 : 1;
  let current = 0;

  // Sync supporter entry (pass existing product IDs for update)
  try {
    const response = await syncEventRegistrationTierToStripe(
      'supporter_entry',
      settings.supporterEntryName,
      settings.supporterEntryDescription,
      settings.supporterEntryFee,
      settings.supporterEarlyBirdFee,
      settings.supporterEntryStripeProductId,
      settings.supporterEntryStripeEarlyBirdProductId
    );

    results.supporterEntry = {
      success: true,
      id: 'supporter_entry',
      name: settings.supporterEntryName,
      productId: response.productId,
      priceId: response.priceId,
    };
  } catch (err) {
    results.supporterEntry = {
      success: false,
      id: 'supporter_entry',
      name: settings.supporterEntryName,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }

  current++;
  if (onProgress) {
    onProgress(current, total, settings.supporterEntryName, results.supporterEntry?.success ?? false);
  }

  // Sync spectator pass if enabled (pass existing product ID for update)
  if (settings.spectatorPassEnabled) {
    try {
      const response = await syncEventRegistrationTierToStripe(
        'spectator_pass',
        settings.spectatorPassName,
        settings.spectatorPassDescription,
        settings.spectatorPassFee,
        null, // No early bird for spectator pass
        settings.spectatorPassStripeProductId
      );

      results.spectatorPass = {
        success: true,
        id: 'spectator_pass',
        name: settings.spectatorPassName,
        productId: response.productId,
        priceId: response.priceId,
      };
    } catch (err) {
      results.spectatorPass = {
        success: false,
        id: 'spectator_pass',
        name: settings.spectatorPassName,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }

    current++;
    if (onProgress) {
      onProgress(current, total, settings.spectatorPassName, results.spectatorPass?.success ?? false);
    }
  }

  return results;
}

export interface DbAddonForSync {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: 'apparel' | 'merchandise' | 'equipment' | 'food' | 'other';
  stripe_product_id: string | null;
}

/**
 * Bulk sync all add-ons to Stripe
 * Updates existing products if they exist, creates new ones if not
 * @param onProgress - Optional callback for progress updates
 */
export async function bulkSyncAddonsToStripe(
  onProgress?: (current: number, total: number, result: BulkSyncResult) => void
): Promise<BulkSyncResult[]> {
  // Fetch all add-ons including existing Stripe product IDs and category
  const { data: addons, error } = await supabase
    .from('addons')
    .select('id, name, description, price, category, stripe_product_id')
    .order('name');

  if (error) {
    throw new Error(`Failed to fetch add-ons: ${error.message}`);
  }

  if (!addons || addons.length === 0) {
    return [];
  }

  const results: BulkSyncResult[] = [];

  for (let i = 0; i < addons.length; i++) {
    const addon = addons[i]! as DbAddonForSync;
    let result: BulkSyncResult;

    try {
      // Pass existing product ID and category for Stripe sync
      const response = await syncAddonPricing(
        addon.id,
        addon.name,
        addon.description,
        addon.price,
        addon.stripe_product_id,
        addon.category
      );

      result = {
        success: true,
        id: addon.id,
        name: addon.name,
        productId: response.productId,
        priceId: response.priceId,
      };
    } catch (err) {
      result = {
        success: false,
        id: addon.id,
        name: addon.name,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }

    results.push(result);

    if (onProgress) {
      onProgress(i + 1, addons.length, result);
    }
  }

  return results;
}

// ============ TAX RATE FUNCTIONS ============

export interface TaxRateConfig {
  percentage: number;
  displayName: string;
  description: string;
  jurisdiction: string;
  inclusive: boolean;
  stripeTaxRateId: string | null;
}

export interface TaxRateSyncResult {
  success: boolean;
  taxRateId?: string;
  percentage?: number;
  displayName?: string;
  environment?: string;
  error?: string;
}

/**
 * Fetch current tax rate configuration from site_settings
 */
export async function getTaxRateConfig(): Promise<TaxRateConfig> {
  const { data: settings, error } = await supabase
    .from('site_settings')
    .select('setting_key, setting_value')
    .in('setting_key', [
      'event_tax_rate_percentage',
      'event_tax_rate_display_name',
      'event_tax_rate_description',
      'event_tax_rate_jurisdiction',
      'event_tax_rate_inclusive',
      'event_tax_stripe_rate_id',
    ]);

  if (error) {
    throw new Error(`Failed to fetch tax settings: ${error.message}`);
  }

  const settingsMap: Record<string, string> = {};
  for (const row of settings || []) {
    settingsMap[row.setting_key] = row.setting_value;
  }

  return {
    percentage: parseFloat(settingsMap['event_tax_rate_percentage'] || '8.3'),
    displayName: settingsMap['event_tax_rate_display_name'] || 'Sales Tax',
    description: settingsMap['event_tax_rate_description'] || 'Arizona Sales Tax',
    jurisdiction: settingsMap['event_tax_rate_jurisdiction'] || 'US - AZ',
    inclusive: settingsMap['event_tax_rate_inclusive'] === 'true',
    stripeTaxRateId: settingsMap['event_tax_stripe_rate_id'] || null,
  };
}

/**
 * Sync tax rate configuration to Stripe
 * Creates or updates the Stripe tax rate and stores the ID in site_settings
 */
export async function syncTaxRateToStripe(): Promise<TaxRateSyncResult> {
  try {
    const { data, error } = await supabase.functions.invoke('create-tax-rate', {
      body: {},
    });

    if (error) {
      console.error('Error syncing tax rate to Stripe:', error);
      return {
        success: false,
        error: error.message || 'Failed to sync tax rate',
      };
    }

    return {
      success: true,
      taxRateId: data.taxRateId,
      percentage: data.percentage,
      displayName: data.displayName,
      environment: data.environment,
    };
  } catch (err) {
    console.error('Tax rate sync failed:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to sync tax rate',
    };
  }
}

/**
 * Update tax rate configuration in site_settings
 */
export async function updateTaxRateConfig(config: Partial<TaxRateConfig>): Promise<void> {
  const updates: { key: string; value: string }[] = [];

  if (config.percentage !== undefined) {
    updates.push({ key: 'event_tax_rate_percentage', value: config.percentage.toString() });
  }
  if (config.displayName !== undefined) {
    updates.push({ key: 'event_tax_rate_display_name', value: config.displayName });
  }
  if (config.description !== undefined) {
    updates.push({ key: 'event_tax_rate_description', value: config.description });
  }
  if (config.jurisdiction !== undefined) {
    updates.push({ key: 'event_tax_rate_jurisdiction', value: config.jurisdiction });
  }
  if (config.inclusive !== undefined) {
    updates.push({ key: 'event_tax_rate_inclusive', value: config.inclusive.toString() });
  }

  for (const { key, value } of updates) {
    const { error } = await supabase
      .from('site_settings')
      .update({ setting_value: value, updated_at: new Date().toISOString() })
      .eq('setting_key', key);

    if (error) {
      throw new Error(`Failed to update ${key}: ${error.message}`);
    }
  }
}
