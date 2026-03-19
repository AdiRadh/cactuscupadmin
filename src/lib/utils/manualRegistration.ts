import { supabaseAdmin, supabase } from '@/lib/api/supabase';

export interface AddManualTournamentEntryParams {
  userId: string;
  tournamentId: string;
  amountPaid?: number; // in cents, default 0
  adminNotes?: string;
  createOrder?: boolean; // whether to create order record for audit trail
  eventYear?: number; // defaults to current year
}

export interface AddManualEventRegistrationParams {
  userId: string;
  registrationFee?: number; // in cents, default 0
  adminNotes?: string;
  createOrder?: boolean; // whether to create order record for audit trail
  eventYear?: number; // defaults to current year
}

export interface ManualEventRegistrationResult {
  success: boolean;
  eventRegistrationId?: string;
  orderId?: string;
  error?: string;
}

export interface ManualEntryResult {
  success: boolean;
  registrationId?: string;
  orderId?: string;
  eventRegistrationId?: string;
  eventRegistrationCreated?: boolean;
  error?: string;
}

/**
 * Add a manual tournament entry for a user (admin bypass of payment)
 * Creates tournament registration, event registration (if needed), and optionally an order for audit trail
 */
export async function addManualTournamentEntry(
  params: AddManualTournamentEntryParams
): Promise<ManualEntryResult> {
  const { userId, tournamentId, amountPaid = 0, adminNotes, createOrder = true, eventYear = new Date().getFullYear() } = params;
  const client = supabaseAdmin ?? supabase;

  try {
    // 1. Verify the tournament exists and has capacity
    const { data: tournament, error: tournamentError } = await client
      .from('tournaments')
      .select('id, name, max_participants, current_participants, status')
      .eq('id', tournamentId)
      .single();

    if (tournamentError || !tournament) {
      return { success: false, error: 'Tournament not found' };
    }

    if (tournament.status === 'full') {
      return { success: false, error: 'Tournament is full' };
    }

    if (tournament.max_participants && tournament.current_participants >= tournament.max_participants) {
      return { success: false, error: 'Tournament has reached maximum capacity' };
    }

    // 2. Check if user already has a registration for this tournament
    const { data: existingReg, error: existingError } = await client
      .from('tournament_registrations')
      .select('id')
      .eq('user_id', userId)
      .eq('tournament_id', tournamentId)
      .maybeSingle();

    if (existingError) {
      console.error('Error checking existing registration:', existingError);
    }

    if (existingReg) {
      return { success: false, error: 'User is already registered for this tournament' };
    }

    // 3. Create tournament registration
    const registrationData = {
      user_id: userId,
      tournament_id: tournamentId,
      amount_paid: amountPaid,
      payment_status: 'completed',
      registered_at: new Date().toISOString(),
      waiver_accepted: false,
      details_completed: false,
    };

    const { data: registration, error: regError } = await client
      .from('tournament_registrations')
      .insert(registrationData)
      .select('id')
      .single();

    if (regError || !registration) {
      console.error('Error creating registration:', regError);
      return { success: false, error: regError?.message || 'Failed to create registration' };
    }

    // 4. Tournament current_participants is handled by DB trigger on INSERT
    // (see migration 20251111000002_add_participant_counter_triggers.sql)

    // 5. Check if user has an event registration for this year, create one if not
    let eventRegistrationId: string | undefined;
    let eventRegistrationCreated = false;

    const { data: existingEventReg } = await client
      .from('event_registrations')
      .select('id')
      .eq('user_id', userId)
      .eq('event_year', eventYear)
      .maybeSingle();

    if (!existingEventReg) {
      // Create event registration for the user
      const eventRegData = {
        user_id: userId,
        event_year: eventYear,
        registration_fee: 0, // Manual entries are typically comped
        payment_status: 'completed',
        registered_at: new Date().toISOString(),
      };

      const { data: newEventReg, error: eventRegError } = await client
        .from('event_registrations')
        .insert(eventRegData)
        .select('id')
        .single();

      if (eventRegError) {
        console.error('Error creating event registration:', eventRegError);
        // Don't fail the whole operation, just log
      } else if (newEventReg) {
        eventRegistrationId = newEventReg.id;
        eventRegistrationCreated = true;
      }
    } else {
      eventRegistrationId = existingEventReg.id;
    }

    // 6. Optionally create order for audit trail
    let orderId: string | undefined;
    if (createOrder) {
      // Generate order number
      const orderNumber = `MANUAL-${Date.now()}`;

      const orderData = {
        user_id: userId,
        order_number: orderNumber,
        subtotal: amountPaid,
        tax: 0,
        total: amountPaid,
        payment_status: 'completed',
        order_status: 'completed',
        fulfillment_status: 'delivered',
        admin_notes: adminNotes || 'Manual entry by admin',
        paid_at: new Date().toISOString(),
      };

      const { data: order, error: orderError } = await client
        .from('orders')
        .insert(orderData)
        .select('id')
        .single();

      if (orderError) {
        console.error('Error creating order:', orderError);
        // Don't fail the whole operation, just log
      } else if (order) {
        orderId = order.id;

        // Create order item linking to the registration
        const orderItemData = {
          order_id: order.id,
          item_type: 'tournament',
          tournament_registration_id: registration.id,
          item_name: tournament.name,
          item_description: 'Manual entry by admin',
          unit_price: amountPaid,
          quantity: 1,
          subtotal: amountPaid,
          tax: 0,
          total: amountPaid,
          discount_amount: 0,
        };

        const { error: orderItemError } = await client
          .from('order_items')
          .insert(orderItemData);

        if (orderItemError) {
          console.error('Error creating order item:', orderItemError);
        }

        // Update the tournament registration with the order_id
        const { error: linkError } = await client
          .from('tournament_registrations')
          .update({ order_id: order.id })
          .eq('id', registration.id);

        if (linkError) {
          console.error('Error linking order to registration:', linkError);
        }
      }
    }

    return {
      success: true,
      registrationId: registration.id,
      orderId,
      eventRegistrationId,
      eventRegistrationCreated,
    };
  } catch (err) {
    console.error('Manual tournament entry failed:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Add a manual event registration for a user (admin bypass of payment)
 * Creates event registration without requiring a tournament registration
 */
export async function addManualEventRegistration(
  params: AddManualEventRegistrationParams
): Promise<ManualEventRegistrationResult> {
  const { userId, registrationFee = 0, adminNotes, createOrder = true, eventYear = new Date().getFullYear() } = params;
  const client = supabaseAdmin ?? supabase;

  try {
    // 1. Check if user already has an event registration for this year
    const { data: existingEventReg, error: existingError } = await client
      .from('event_registrations')
      .select('id')
      .eq('user_id', userId)
      .eq('event_year', eventYear)
      .maybeSingle();

    if (existingError) {
      console.error('Error checking existing event registration:', existingError);
    }

    if (existingEventReg) {
      return { success: false, error: 'User already has an event registration for this year' };
    }

    // 2. Create event registration
    const eventRegData = {
      user_id: userId,
      event_year: eventYear,
      registration_fee: registrationFee,
      payment_status: 'completed',
      registered_at: new Date().toISOString(),
    };

    const { data: eventRegistration, error: eventRegError } = await client
      .from('event_registrations')
      .insert(eventRegData)
      .select('id')
      .single();

    if (eventRegError || !eventRegistration) {
      console.error('Error creating event registration:', eventRegError);
      return { success: false, error: eventRegError?.message || 'Failed to create event registration' };
    }

    // 3. Optionally create order for audit trail
    let orderId: string | undefined;
    if (createOrder) {
      const orderNumber = `MANUAL-EVENT-${Date.now()}`;

      const orderData = {
        user_id: userId,
        order_number: orderNumber,
        subtotal: registrationFee,
        tax: 0,
        total: registrationFee,
        payment_status: 'completed',
        order_status: 'completed',
        fulfillment_status: 'delivered',
        admin_notes: adminNotes || 'Manual event registration by admin',
        paid_at: new Date().toISOString(),
      };

      const { data: order, error: orderError } = await client
        .from('orders')
        .insert(orderData)
        .select('id')
        .single();

      if (orderError) {
        console.error('Error creating order:', orderError);
        // Don't fail the whole operation, just log
      } else if (order) {
        orderId = order.id;

        // Create order item linking to the event registration
        const orderItemData = {
          order_id: order.id,
          item_type: 'event_registration',
          event_registration_id: eventRegistration.id,
          item_name: 'Event Registration',
          item_description: adminNotes || 'Manual event registration by admin',
          unit_price: registrationFee,
          quantity: 1,
          subtotal: registrationFee,
          tax: 0,
          total: registrationFee,
          discount_amount: 0,
        };

        const { error: orderItemError } = await client
          .from('order_items')
          .insert(orderItemData);

        if (orderItemError) {
          console.error('Error creating order item:', orderItemError);
        }
      }
    }

    return {
      success: true,
      eventRegistrationId: eventRegistration.id,
      orderId,
    };
  } catch (err) {
    console.error('Manual event registration failed:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

export interface UserSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  club: string | null;
}

/**
 * Search for users by name
 */
export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  const client = supabaseAdmin ?? supabase;

  if (!query || query.length < 2) {
    return [];
  }

  const { data, error } = await client
    .from('profiles')
    .select('id, first_name, last_name, club')
    .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
    .limit(20);

  if (error) {
    console.error('Error searching users:', error);
    return [];
  }

  return (data || []).map((profile) => ({
    id: profile.id,
    firstName: profile.first_name,
    lastName: profile.last_name,
    club: profile.club,
  }));
}

export interface AvailableTournament {
  id: string;
  name: string;
  weapon: string;
  division: string;
  maxParticipants: number;
  currentParticipants: number;
  status: string;
  date: string;
}

/**
 * Get tournaments available for registration
 */
export async function getAvailableTournaments(): Promise<AvailableTournament[]> {
  const client = supabaseAdmin ?? supabase;

  const { data, error } = await client
    .from('tournaments')
    .select('id, name, weapon, division, max_participants, current_participants, status, date')
    .in('status', ['open', 'draft']) // Include draft for admin
    .order('date', { ascending: true });

  if (error) {
    console.error('Error fetching tournaments:', error);
    return [];
  }

  return (data || []).map((t) => ({
    id: t.id,
    name: t.name,
    weapon: t.weapon,
    division: t.division,
    maxParticipants: t.max_participants,
    currentParticipants: t.current_participants,
    status: t.status,
    date: t.date,
  }));
}

// ============================================================================
// Manual Add-on Purchase
// ============================================================================

export interface AvailableAddon {
  id: string;
  name: string;
  category: string;
  price: number; // in cents
  hasInventory: boolean;
  stockQuantity: number | null;
  maxPerOrder: number | null;
  hasVariants: boolean;
  variants: { name: string; sku: string; priceModifier: number; stock: number | null }[] | null;
  isActive: boolean;
  imageUrl: string | null;
}

export interface AddManualAddonPurchaseParams {
  userId: string;
  addonId: string;
  quantity: number;
  variantName?: string | null;
  unitPrice: number; // in cents (addon price + variant modifier)
  adminNotes?: string;
  eventYear?: number;
  forceOutOfStock?: boolean; // allow override when out of stock
}

export interface ManualAddonResult {
  success: boolean;
  orderId?: string;
  orderItemId?: string;
  inventoryWarning?: string;
  error?: string;
}

/**
 * Get add-ons available for manual purchase
 * @param includeInactive - If true, also returns inactive add-ons (for admin use)
 */
export async function getAvailableAddons(includeInactive = false): Promise<AvailableAddon[]> {
  const client = supabaseAdmin ?? supabase;

  let query = client
    .from('addons')
    .select('id, name, category, price, has_inventory, stock_quantity, max_per_order, has_variants, variants, is_active, image_url');

  if (!includeInactive) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query.order('sort_order', { ascending: true });

  if (error) {
    console.error('Error fetching addons:', error);
    return [];
  }

  return (data || []).map((a) => ({
    id: a.id,
    name: a.name,
    category: a.category,
    price: a.price,
    hasInventory: a.has_inventory ?? false,
    stockQuantity: a.stock_quantity,
    maxPerOrder: a.max_per_order,
    hasVariants: a.has_variants ?? false,
    variants: a.variants as AvailableAddon['variants'],
    isActive: a.is_active ?? true,
    imageUrl: a.image_url,
  }));
}

/**
 * Add a manual add-on purchase for a user (admin bypass of payment)
 * Creates order + order_item and decrements inventory
 */
export async function addManualAddonPurchase(
  params: AddManualAddonPurchaseParams
): Promise<ManualAddonResult> {
  const {
    userId,
    addonId,
    quantity,
    variantName = null,
    unitPrice,
    adminNotes,
    eventYear = new Date().getFullYear(),
    forceOutOfStock = false,
  } = params;
  const client = supabaseAdmin ?? supabase;

  try {
    // 1. Verify the addon exists
    const { data: addon, error: addonError } = await client
      .from('addons')
      .select('id, name, has_inventory, stock_quantity, has_variants, variants')
      .eq('id', addonId)
      .single();

    if (addonError || !addon) {
      return { success: false, error: 'Add-on not found' };
    }

    // 2. Atomically check and decrement inventory via RPC (uses FOR UPDATE lock)
    let inventoryWarning: string | undefined;
    let stockDecremented = false;

    if (addon.has_inventory) {
      const { data: stockResult, error: stockError } = await client.rpc('admin_decrement_addon_stock', {
        p_addon_id: addonId,
        p_quantity: quantity,
        p_variant_name: variantName,
        p_force: forceOutOfStock,
      });

      const result = stockResult as { success: boolean; error?: string; available_stock?: number } | null;

      if (stockError || !result?.success) {
        const errorMsg = result?.error || stockError?.message || 'Stock check failed';
        return {
          success: false,
          inventoryWarning: errorMsg,
          error: errorMsg,
        };
      }

      stockDecremented = true;
    }

    // 3. Ensure user has an event registration
    const { data: existingEventReg } = await client
      .from('event_registrations')
      .select('id')
      .eq('user_id', userId)
      .eq('event_year', eventYear)
      .maybeSingle();

    if (!existingEventReg) {
      // Create event registration
      const { error: eventRegError } = await client
        .from('event_registrations')
        .insert({
          user_id: userId,
          event_year: eventYear,
          registration_fee: 0,
          payment_status: 'completed',
          registered_at: new Date().toISOString(),
        });

      if (eventRegError) {
        console.error('Error creating event registration:', eventRegError);
      }
    }

    // 4. Create order
    const total = unitPrice * quantity;
    const orderNumber = `MANUAL-ADDON-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    const { data: order, error: orderError } = await client
      .from('orders')
      .insert({
        user_id: userId,
        order_number: orderNumber,
        subtotal: total,
        tax: 0,
        total,
        payment_status: 'completed',
        order_status: 'completed',
        fulfillment_status: 'pending',
        admin_notes: adminNotes || 'Manual add-on added by admin',
        paid_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (orderError || !order) {
      console.error('Error creating order:', orderError);
      return { success: false, error: orderError?.message || 'Failed to create order' };
    }

    // 5. Create order item
    const { data: orderItem, error: orderItemError } = await client
      .from('order_items')
      .insert({
        order_id: order.id,
        item_type: 'addon',
        item_id: addonId,
        addon_id: addonId,
        item_name: addon.name,
        item_description: adminNotes || 'Manual add-on added by admin',
        variant_name: variantName,
        unit_price: unitPrice,
        quantity,
        subtotal: total,
        tax: 0,
        total,
        discount_amount: 0,
      })
      .select('id')
      .single();

    if (orderItemError || !orderItem) {
      // Roll back the orphaned order
      await client.from('orders').delete().eq('id', order.id);
      // Reverse the stock decrement if it was already applied
      if (stockDecremented) {
        await client.rpc('admin_increment_addon_stock', {
          p_addon_id: addonId,
          p_quantity: quantity,
          p_variant_name: variantName,
        });
      }
      console.error('Error creating order item:', orderItemError);
      return { success: false, error: orderItemError?.message || 'Failed to create order item' };
    }

    // 6. Inventory was already decremented atomically in step 2

    return {
      success: true,
      orderId: order.id,
      orderItemId: orderItem.id,
      inventoryWarning,
    };
  } catch (err) {
    console.error('Manual addon purchase failed:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
