import { supabase, getAdminClient } from '@/lib/api/supabase';
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

// ============ ORDER VERIFICATION FUNCTIONS ============

export interface OrderVerificationItem {
  orderId: string;
  orderNumber: string;
  stripeSessionId: string | null;
  stripePaymentIntentId: string | null;
  dbTotal: number; // in cents
  stripeTotal: number | null; // in cents
  status: 'match' | 'mismatch' | 'no_stripe_data' | 'pending' | 'error';
  dbItems: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  stripeItems: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }> | null;
  errorMessage?: string;
}

export interface StripeVerificationResult {
  userId: string;
  totalOrders: number;
  matchedOrders: number;
  mismatchedOrders: number;
  pendingOrders: number;
  noStripeDataOrders: number;
  errorOrders: number;
  orders: OrderVerificationItem[];
}

/**
 * Verify a user's order items against their Stripe transactions
 * Handles multiple orders and transactions per user
 */
export async function verifyOrdersWithStripe(userId: string): Promise<StripeVerificationResult> {
  try {
    const { data, error } = await supabase.functions.invoke('verify-stripe-orders', {
      body: { userId },
    });

    if (error) {
      console.error('Error verifying orders with Stripe:', error);
      throw new Error(error.message || 'Failed to verify orders with Stripe');
    }

    return data as StripeVerificationResult;
  } catch (err) {
    console.error('Order verification failed:', err);
    throw err instanceof Error ? err : new Error('Failed to verify orders with Stripe');
  }
}

export interface SyncOrderResult {
  success: boolean;
  orderId: string;
  orderNumber: string;
  itemsUpdated: number;
  itemsCreated: number;
  itemsDeleted: number;
  newTotal: number;
  error?: string;
}

/**
 * Sync order items from Stripe to Supabase
 * Uses Stripe as the source of truth to update database records
 */
export async function syncOrderFromStripe(orderId: string): Promise<SyncOrderResult> {
  try {
    const { data, error } = await supabase.functions.invoke('sync-order-from-stripe', {
      body: { orderId },
    });

    if (error) {
      console.error('Error syncing order from Stripe:', error);
      throw new Error(error.message || 'Failed to sync order from Stripe');
    }

    return data as SyncOrderResult;
  } catch (err) {
    console.error('Order sync failed:', err);
    throw err instanceof Error ? err : new Error('Failed to sync order from Stripe');
  }
}

export interface BulkVerificationSummary {
  totalUsers: number;
  totalOrders: number;
  matchedOrders: number;
  mismatchedOrders: number;
  pendingOrders: number;
  noStripeDataOrders: number;
  errorOrders: number;
  userResults: Array<{
    userId: string;
    userName: string;
    result: StripeVerificationResult;
  }>;
}

/**
 * Bulk verify all orders against Stripe
 * Returns aggregated results for all users with orders
 */
export async function bulkVerifyOrdersWithStripe(
  _onProgress?: (current: number, total: number, userName: string) => void
): Promise<BulkVerificationSummary> {
  try {
    const { data, error } = await supabase.functions.invoke('bulk-verify-stripe-orders', {
      body: {},
    });

    if (error) {
      console.error('Error bulk verifying orders with Stripe:', error);
      throw new Error(error.message || 'Failed to bulk verify orders with Stripe');
    }

    return data as BulkVerificationSummary;
  } catch (err) {
    console.error('Bulk order verification failed:', err);
    throw err instanceof Error ? err : new Error('Failed to bulk verify orders with Stripe');
  }
}

// ============ STRIPE CUSTOMER FUNCTIONS ============

export interface StripeCustomer {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  created: number;
  metadata: Record<string, string>;
  address: {
    city: string | null;
    country: string | null;
    line1: string | null;
    line2: string | null;
    postal_code: string | null;
    state: string | null;
  } | null;
  defaultPaymentMethod: string | null;
  balance: number;
  currency: string | null;
  delinquent: boolean;
  invoicePrefix: string | null;
  totalSpent: number;
  paymentCount: number;
}

export interface ListCustomersResponse {
  customers: StripeCustomer[];
  hasMore: boolean;
  totalCount: number;
}

export interface ListCustomersParams {
  limit?: number;
  startingAfter?: string;
  email?: string;
}

/**
 * List all Stripe customers
 * Fetches customer data including payment history from Stripe
 */
export async function listStripeCustomers(
  params: ListCustomersParams = {}
): Promise<ListCustomersResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('list-stripe-customers', {
      body: params,
    });

    if (error) {
      console.error('Error listing Stripe customers:', error);
      throw new Error(error.message || 'Failed to list Stripe customers');
    }

    return data as ListCustomersResponse;
  } catch (err) {
    console.error('List Stripe customers failed:', err);
    throw err instanceof Error ? err : new Error('Failed to list Stripe customers');
  }
}

// ============ ADMIN REFUND FUNCTIONS ============

export interface RefundRequest {
  paymentIntentId?: string;
  orderId?: string;
  amount?: number; // Optional: partial refund amount in cents. If not provided, full refund
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
}

export interface RefundResult {
  success: boolean;
  refundId?: string;
  amount?: number;
  status?: string;
  error?: string;
}

/**
 * Process a refund for a payment (Admin only)
 * Requires the user to be authenticated as an admin
 * @param request - Refund request containing payment intent or order ID, optional amount for partial refund
 */
export async function processAdminRefund(request: RefundRequest): Promise<RefundResult> {
  try {
    const { data, error } = await supabase.functions.invoke('admin-refund-payment', {
      body: request,
    });

    if (error) {
      console.error('Error processing refund:', error);
      return {
        success: false,
        error: error.message || 'Failed to process refund',
      };
    }

    return data as RefundResult;
  } catch (err) {
    console.error('Refund processing failed:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to process refund',
    };
  }
}

// ============ REGISTRATION REMOVAL FUNCTIONS ============

export interface RemoveItemResult {
  success: boolean;
  error?: string;
  refundResult?: RefundResult;
}

/**
 * Remove a tournament registration and optionally refund
 * Updates tournament capacity when removing
 */
export async function removeTournamentRegistration(
  registrationId: string,
  tournamentId: string,
  refund: boolean = false,
  paymentIntentId?: string
): Promise<RemoveItemResult> {
  try {
    // Use admin client to bypass RLS for admin operations
    const adminClient = getAdminClient();

    // First, get the order_id associated with this tournament registration
    const { data: orderItem, error: orderItemError } = await adminClient
      .from('order_items')
      .select('order_id, total')
      .eq('tournament_registration_id', registrationId)
      .single();

    // Delete the tournament registration
    const { error: deleteError } = await adminClient
      .from('tournament_registrations')
      .delete()
      .eq('id', registrationId);

    if (deleteError) {
      throw new Error(`Failed to delete tournament registration: ${deleteError.message}`);
    }

    // Update tournament current_registrations count (decrement)
    const { error: updateError } = await adminClient.rpc('decrement_tournament_registrations', {
      tournament_id: tournamentId,
    });

    // If RPC doesn't exist, try direct update
    if (updateError) {
      const { data: tournament } = await adminClient
        .from('tournaments')
        .select('current_registrations')
        .eq('id', tournamentId)
        .single();

      if (tournament && tournament.current_registrations > 0) {
        await adminClient
          .from('tournaments')
          .update({ current_registrations: tournament.current_registrations - 1 })
          .eq('id', tournamentId);
      }
    }

    // Delete the order item if it exists
    if (orderItem && !orderItemError) {
      await adminClient
        .from('order_items')
        .delete()
        .eq('tournament_registration_id', registrationId);
    }

    // Process refund if requested
    let refundResult: RefundResult | undefined;
    if (refund && paymentIntentId) {
      refundResult = await processAdminRefund({
        paymentIntentId,
        amount: orderItem?.total || undefined,
        reason: 'requested_by_customer',
      });
    }

    return {
      success: true,
      refundResult,
    };
  } catch (err) {
    console.error('Remove tournament registration failed:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to remove tournament registration',
    };
  }
}

/**
 * Remove an order item (addon/merchandise) and optionally refund
 * Updates addon inventory when removing
 */
export async function removeOrderItem(
  orderItemId: string,
  addonId: string | null,
  quantity: number,
  refund: boolean = false,
  orderId?: string
): Promise<RemoveItemResult> {
  try {
    // Use admin client to bypass RLS for admin operations
    const adminClient = getAdminClient();

    // Get order info for refund
    let paymentIntentId: string | undefined;
    let itemTotal: number | undefined;

    if (refund && orderId) {
      const { data: order } = await adminClient
        .from('orders')
        .select('stripe_payment_intent_id')
        .eq('id', orderId)
        .single();

      paymentIntentId = order?.stripe_payment_intent_id || undefined;
    }

    // Get the item total before deleting
    const { data: orderItem } = await adminClient
      .from('order_items')
      .select('total')
      .eq('id', orderItemId)
      .single();

    itemTotal = orderItem?.total || undefined;

    // Delete the order item
    const { error: deleteError } = await adminClient
      .from('order_items')
      .delete()
      .eq('id', orderItemId);

    if (deleteError) {
      throw new Error(`Failed to delete order item: ${deleteError.message}`);
    }

    // Update addon inventory (increment stock back)
    if (addonId) {
      const { data: addon } = await adminClient
        .from('addons')
        .select('has_inventory, stock_quantity')
        .eq('id', addonId)
        .single();

      if (addon?.has_inventory && addon.stock_quantity !== null) {
        await adminClient
          .from('addons')
          .update({ stock_quantity: addon.stock_quantity + quantity })
          .eq('id', addonId);
      }
    }

    // Process refund if requested
    let refundResult: RefundResult | undefined;
    if (refund && paymentIntentId && itemTotal) {
      refundResult = await processAdminRefund({
        paymentIntentId,
        amount: itemTotal,
        reason: 'requested_by_customer',
      });
    }

    return {
      success: true,
      refundResult,
    };
  } catch (err) {
    console.error('Remove order item failed:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to remove order item',
    };
  }
}

/**
 * Remove an event registration entry and optionally refund
 */
export async function removeEventRegistration(
  registrationId: string,
  refund: boolean = false
): Promise<RemoveItemResult> {
  try {
    // Use admin client to bypass RLS for admin operations
    const adminClient = getAdminClient();

    // Get the order item and order info for refund
    const { data: orderItem } = await adminClient
      .from('order_items')
      .select('order_id, total')
      .eq('event_registration_id', registrationId)
      .single();

    let paymentIntentId: string | undefined;
    if (refund && orderItem?.order_id) {
      const { data: order } = await adminClient
        .from('orders')
        .select('stripe_payment_intent_id')
        .eq('id', orderItem.order_id)
        .single();

      paymentIntentId = order?.stripe_payment_intent_id || undefined;
    }

    // Delete the order item first
    if (orderItem) {
      await adminClient
        .from('order_items')
        .delete()
        .eq('event_registration_id', registrationId);
    }

    // Delete the event registration
    const { error: deleteError } = await adminClient
      .from('event_registrations')
      .delete()
      .eq('id', registrationId);

    if (deleteError) {
      throw new Error(`Failed to delete event registration: ${deleteError.message}`);
    }

    // Process refund if requested
    let refundResult: RefundResult | undefined;
    if (refund && paymentIntentId && orderItem?.total) {
      refundResult = await processAdminRefund({
        paymentIntentId,
        amount: orderItem.total,
        reason: 'requested_by_customer',
      });
    }

    return {
      success: true,
      refundResult,
    };
  } catch (err) {
    console.error('Remove event registration failed:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to remove event registration',
    };
  }
}

// ========================================
// Stripe-Supabase Reconciliation Types
// ========================================

export interface ItemDiscrepancy {
  itemName: string;
  stripeQuantity: number;
  stripeTotal: number;
  supabaseQuantity: number;
  supabaseTotal: number;
  status: 'missing_in_supabase' | 'missing_in_stripe' | 'quantity_mismatch' | 'amount_mismatch';
}

export interface UserReconciliation {
  email: string;
  stripeCustomerId: string | null;
  supabaseUserId: string | null;
  stripeName: string | null;
  supabaseName: string | null;
  stripeTotal: number;
  supabaseTotal: number;
  totalDifference: number;
  stripeItemCount: number;
  supabaseItemCount: number;
  discrepancies: ItemDiscrepancy[];
  hasIssues: boolean;
}

export interface ReconciliationSummary {
  totalStripeCustomers: number;
  totalSupabaseUsers: number;
  totalMatchedEmails: number;
  usersWithDiscrepancies: number;
  totalStripePurchases: number;
  totalSupabasePurchases: number;
  totalStripeAmount: number;
  totalSupabaseAmount: number;
  amountDifference: number;
  users: UserReconciliation[];
}

/**
 * Reconcile Stripe transactions with Supabase order records
 * Fetches all customers from Stripe with their line items,
 * compares against Supabase orders, and identifies discrepancies
 */
export async function reconcileStripeOrders(params?: {
  emailFilter?: string;
}): Promise<ReconciliationSummary> {
  try {
    const { data, error } = await supabase.functions.invoke('reconcile-stripe-orders', {
      body: params || {},
    });

    if (error) {
      console.error('Error reconciling Stripe orders:', error);
      throw new Error(error.message || 'Failed to reconcile Stripe orders');
    }

    if (!data) {
      throw new Error('No data returned from reconciliation');
    }

    return data as ReconciliationSummary;
  } catch (err) {
    console.error('Stripe reconciliation failed:', err);
    throw err instanceof Error ? err : new Error('Failed to reconcile Stripe orders');
  }
}

// ============ MISSING REGISTRATIONS FUNCTIONS ============

export interface MissingRegistration {
  orderId: string | null;
  orderNumber: string | null;
  userId: string | null;
  userName: string;
  userEmail: string | null;
  orderItemId: string | null;
  itemName: string;
  itemType: string;
  quantity: number;
  unitPrice: number;
  total: number;
  paymentStatus: string;
  stripeSessionId: string | null;
  stripePaymentIntentId: string | null;
  createdAt: string;
  source: 'supabase' | 'stripe_only';
}

export interface StripeTransaction {
  id: string;
  amount: number;
  description: string | null;
  lineItems: Array<{
    name: string;
    quantity: number;
    amount: number;
  }>;
}

export interface UserWithMissingRegistrations {
  userId: string;
  userName: string;
  userEmail: string | null;
  stripeCustomerId: string | null;
  missingRegistrations: MissingRegistration[];
  stripeTransactions: StripeTransaction[];
}

export interface MissingRegistrationsSummary {
  totalUsersAffected: number;
  totalMissingRegistrations: number;
  users: UserWithMissingRegistrations[];
}

/**
 * Find orders where payment was made but registrations are missing
 * Identifies order items that should have tournament/activity/event registrations
 * but don't have the corresponding registration record linked
 */
export async function findMissingRegistrations(): Promise<MissingRegistrationsSummary> {
  try {
    const { data, error } = await supabase.functions.invoke('find-missing-registrations', {
      body: {},
    });

    if (error) {
      console.error('Error finding missing registrations:', error);
      throw new Error(error.message || 'Failed to find missing registrations');
    }

    if (!data) {
      throw new Error('No data returned from missing registrations check');
    }

    return data as MissingRegistrationsSummary;
  } catch (err) {
    console.error('Find missing registrations failed:', err);
    throw err instanceof Error ? err : new Error('Failed to find missing registrations');
  }
}

// ============ STRIPE SYNC DIAGNOSIS FUNCTIONS ============

export interface LineItemDiagnosis {
  stripeName: string;
  stripeQuantity: number;
  stripeAmount: number;
  existsInOrderItems: boolean;
  existsInRegistrations: boolean;
  orderItemId: string | null;
  registrationId: string | null;
  registrationType: string | null;
}

export interface SessionDiagnosis {
  stripeSessionId: string;
  stripePaymentIntentId: string | null;
  stripeAmount: number;
  stripeStatus: string;
  stripeCreated: string;
  existsInOrders: boolean;
  orderId: string | null;
  orderNumber: string | null;
  orderTotal: number | null;
  orderPaymentStatus: string | null;
  lineItems: LineItemDiagnosis[];
  issues: string[];
}

export interface CustomerDiagnosis {
  stripeCustomerId: string;
  stripeEmail: string | null;
  stripeName: string | null;
  supabaseUserId: string | null;
  supabaseUserName: string | null;
  sessions: SessionDiagnosis[];
  totalIssues: number;
}

export interface DiagnosisResult {
  searchQuery: string | null;
  customersScanned: number;
  customersWithIssues: number;
  totalSessionsWithIssues: number;
  totalMissingOrders: number;
  totalMissingLineItems: number;
  totalMissingRegistrations: number;
  customers: CustomerDiagnosis[];
}

export interface DiagnoseStripeSyncParams {
  nameFilter?: string;
  emailFilter?: string;
}

/**
 * Diagnose Stripe sync issues for a specific customer or all customers
 * Scans Stripe checkout sessions and compares against Supabase orders and registrations
 * Use nameFilter or emailFilter to search for a specific customer
 */
export async function diagnoseStripeSync(params?: DiagnoseStripeSyncParams): Promise<DiagnosisResult> {
  try {
    const { data, error } = await supabase.functions.invoke('diagnose-stripe-sync', {
      body: params || {},
    });

    if (error) {
      console.error('Error diagnosing Stripe sync:', error);
      throw new Error(error.message || 'Failed to diagnose Stripe sync');
    }

    if (!data) {
      throw new Error('No data returned from Stripe sync diagnosis');
    }

    return data as DiagnosisResult;
  } catch (err) {
    console.error('Stripe sync diagnosis failed:', err);
    throw err instanceof Error ? err : new Error('Failed to diagnose Stripe sync');
  }
}

// ============ REGISTRATION SYNC VERIFICATION FUNCTIONS ============

export interface SyncIssue {
  issueType: 'missing_registration' | 'orphaned_registration' | 'missing_addon_link';
  itemType: string;
  itemName: string;
  orderId: string | null;
  orderNumber: string | null;
  orderItemId: string | null;
  registrationId: string | null;
  userId: string;
  userName: string;
  total: number;
  createdAt: string;
  details: string;
}

export interface UserSyncResult {
  userId: string;
  userName: string;
  userEmail: string | null;
  // Counts
  orderItemsCount: number;
  tournamentRegistrationsCount: number;
  activityRegistrationsCount: number;
  eventRegistrationsCount: number;
  specialEventRegistrationsCount: number;
  addonPurchasesCount: number;
  totalRegistrationsCount: number;
  // Issues
  issues: SyncIssue[];
  hasIssues: boolean;
}

export interface SyncVerificationSummary {
  totalUsersChecked: number;
  totalUsersWithIssues: number;
  totalOrderItems: number;
  totalTournamentRegistrations: number;
  totalActivityRegistrations: number;
  totalEventRegistrations: number;
  totalSpecialEventRegistrations: number;
  totalAddonPurchases: number;
  totalRegistrations: number;
  totalMissingRegistrations: number;
  totalOrphanedRegistrations: number;
  totalMissingAddonLinks: number;
  users: UserSyncResult[];
}

/**
 * Verify that all paid order items have corresponding registrations/purchases
 * and that all registrations have corresponding order items.
 * This checks the sync between orders/order_items tables and registration/purchase tables.
 */
export async function verifyRegistrationSync(): Promise<SyncVerificationSummary> {
  try {
    const { data, error } = await supabase.functions.invoke('verify-registration-sync', {
      body: {},
    });

    if (error) {
      console.error('Error verifying registration sync:', error);
      throw new Error(error.message || 'Failed to verify registration sync');
    }

    if (!data) {
      throw new Error('No data returned from registration sync verification');
    }

    return data as SyncVerificationSummary;
  } catch (err) {
    console.error('Registration sync verification failed:', err);
    throw err instanceof Error ? err : new Error('Failed to verify registration sync');
  }
}
