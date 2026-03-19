import { useCallback } from 'react';
import { supabaseAdmin, supabase } from '@/lib/api/supabase';
import type {
  AddonWaitlistEntry,
  AddonInvoiceCalculation,
  AddonWaitlistDuplicateEntry,
  AddonVerificationResult,
  WaitlistStatus,
  SendInvoicesRequest,
  SendInvoicesResponse,
} from '@/types';

// ============================================================================
// DB-layer interfaces (snake_case)
// ============================================================================

interface DbAddonWaitlistEntry {
  id: string;
  user_id: string;
  addon_id: string;
  variant_name: string | null;
  position: number;
  joined_at: string;
  email: string;
  first_name: string;
  last_name: string;
  status: string;
  promoted_at: string | null;
  invoice_sent_at: string | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface DbAddonWaitlistEntryWithAddon extends DbAddonWaitlistEntry {
  addons: {
    name: string;
    price: number;
    has_variants: boolean;
    variants: AddonVariant[] | null;
  } | null;
}

interface AddonVariant {
  name: string;
  priceModifier?: number;
  price_modifier?: number;
}

// ============================================================================
// Exported interfaces
// ============================================================================

export interface CreateAddonWaitlistEntryData {
  addonId: string;
  variantName?: string | null;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface AddonPromotionResult {
  success: boolean;
  error?: string;
  entryId?: string;
  userId?: string;
  addonId?: string;
  variantName?: string | null;
}

export interface BulkUpdateResult {
  succeeded: string[];
  failed: { id: string; error: string }[];
}

export interface RegisteredUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
}

// ============================================================================
// Mapper
// ============================================================================

function dbToAddonWaitlistEntry(db: DbAddonWaitlistEntryWithAddon): AddonWaitlistEntry {
  return {
    id: db.id,
    userId: db.user_id,
    addonId: db.addon_id,
    variantName: db.variant_name,
    position: db.position,
    joinedAt: db.joined_at,
    email: db.email,
    firstName: db.first_name,
    lastName: db.last_name,
    status: db.status as WaitlistStatus,
    promotedAt: db.promoted_at,
    invoiceSentAt: db.invoice_sent_at,
    confirmedAt: db.confirmed_at,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
    addonName: db.addons?.name,
  };
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for managing addon waitlist entries.
 * Uses admin client to bypass RLS for full access.
 */
export function useAddonWaitlist() {
  const client = supabaseAdmin ?? supabase;

  // --------------------------------------------------------------------------
  // getEntries
  // --------------------------------------------------------------------------

  const getEntries = useCallback(
    async (addonId?: string, variantName?: string): Promise<AddonWaitlistEntry[]> => {
      let query = client
        .from('addon_waitlist')
        .select(`
          *,
          addons:addon_id (
            name,
            price,
            has_variants,
            variants
          )
        `)
        .order('position', { ascending: true });

      if (addonId) {
        query = query.eq('addon_id', addonId);
      }

      // Only apply variant filter when variantName is explicitly passed (not undefined)
      if (variantName !== undefined) {
        if (variantName === null) {
          query = query.is('variant_name', null);
        } else {
          query = query.eq('variant_name', variantName);
        }
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching addon waitlist entries:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Collect unique user_ids and addon_ids to check for existing purchases
      const userIds = [...new Set(data.map((e) => e.user_id))];
      const addonIds = [...new Set(data.map((e) => e.addon_id))];

      // Fetch order_items joined through orders to find purchases
      const { data: orderItems } = await client
        .from('order_items')
        .select('addon_id, orders!inner(user_id)')
        .in('addon_id', addonIds);

      // Build a Set of "userId-addonId" keys for quick lookup
      const purchaseKeys = new Set<string>();
      (orderItems || []).forEach((item) => {
        const ordersData = item.orders as { user_id: string } | { user_id: string }[] | null;
        const order = Array.isArray(ordersData) ? ordersData[0] : ordersData;
        if (order && userIds.includes(order.user_id)) {
          purchaseKeys.add(`${order.user_id}-${item.addon_id}`);
        }
      });

      return data.map((entry) => {
        const base = dbToAddonWaitlistEntry(entry as DbAddonWaitlistEntryWithAddon);
        const key = `${entry.user_id}-${entry.addon_id}`;
        return {
          ...base,
          hasAddonPurchase: purchaseKeys.has(key),
        };
      });
    },
    [client]
  );

  // --------------------------------------------------------------------------
  // createEntry
  // --------------------------------------------------------------------------

  const createEntry = useCallback(
    async (data: CreateAddonWaitlistEntryData): Promise<{ id: string; position: number }> => {
      const attemptInsert = async (): Promise<{ id: string; position: number }> => {
        const now = new Date().toISOString();
        const insertData: Record<string, unknown> = {
          addon_id: data.addonId,
          user_id: data.userId,
          email: data.email,
          first_name: data.firstName,
          last_name: data.lastName,
          // Position is auto-assigned by a DB trigger; insert 0 as placeholder
          position: 0,
          status: 'waiting',
          joined_at: now,
          created_at: now,
          updated_at: now,
        };

        if (data.variantName !== undefined) {
          insertData.variant_name = data.variantName;
        }

        const { data: newEntry, error: insertError } = await client
          .from('addon_waitlist')
          .insert(insertData)
          .select('id, position')
          .single();

        if (insertError) {
          // Postgres unique constraint violation — retry with fresh position
          if (insertError.code === '23505') {
            throw Object.assign(new Error('Unique constraint violation'), { code: '23505' });
          }
          console.error('Error creating addon waitlist entry:', insertError);
          throw insertError;
        }

        return { id: newEntry.id, position: newEntry.position };
      };

      let lastError: unknown;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          return await attemptInsert();
        } catch (error: unknown) {
          lastError = error;
          if (
            error &&
            typeof error === 'object' &&
            'code' in error &&
            (error as { code: string }).code === '23505'
          ) {
            console.warn(`Addon waitlist position conflict, retrying (attempt ${attempt + 1}/3)...`);
            continue;
          }
          throw error;
        }
      }
      throw lastError;
    },
    [client]
  );

  // --------------------------------------------------------------------------
  // updateEntry
  // --------------------------------------------------------------------------

  const updateEntry = useCallback(
    async (
      id: string,
      data: { position?: number; status?: WaitlistStatus }
    ): Promise<void> => {
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (data.position !== undefined) {
        updateData.position = data.position;
      }

      if (data.status !== undefined) {
        updateData.status = data.status;
        if (data.status === 'promoted') {
          updateData.promoted_at = new Date().toISOString();
        }
        if (data.status === 'confirmed') {
          updateData.confirmed_at = new Date().toISOString();
        }
      }

      const { error } = await client
        .from('addon_waitlist')
        .update(updateData)
        .eq('id', id);

      if (error) {
        console.error('Error updating addon waitlist entry:', error);
        throw error;
      }
    },
    [client]
  );

  // --------------------------------------------------------------------------
  // deleteEntry
  // --------------------------------------------------------------------------

  const deleteEntry = useCallback(
    async (id: string): Promise<void> => {
      const { error } = await client
        .from('addon_waitlist')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting addon waitlist entry:', error);
        throw error;
      }
    },
    [client]
  );

  // --------------------------------------------------------------------------
  // confirmEntry
  // --------------------------------------------------------------------------

  const confirmEntry = useCallback(
    async (id: string): Promise<void> => {
      const now = new Date().toISOString();
      const { error } = await client
        .from('addon_waitlist')
        .update({
          status: 'confirmed',
          confirmed_at: now,
          updated_at: now,
        })
        .eq('id', id);

      if (error) {
        console.error('Error confirming addon waitlist entry:', error);
        throw error;
      }
    },
    [client]
  );

  // --------------------------------------------------------------------------
  // confirmEntries
  // --------------------------------------------------------------------------

  const confirmEntries = useCallback(
    async (ids: string[]): Promise<{ succeeded: string[]; failed: string[] }> => {
      const succeeded: string[] = [];
      const failed: string[] = [];

      for (const id of ids) {
        try {
          await confirmEntry(id);
          succeeded.push(id);
        } catch (err) {
          console.error(`Error confirming addon waitlist entry ${id}:`, err);
          failed.push(id);
        }
      }

      return { succeeded, failed };
    },
    [confirmEntry]
  );

  // --------------------------------------------------------------------------
  // promoteUser
  // --------------------------------------------------------------------------

  const promoteUser = useCallback(
    async (entryId: string): Promise<AddonPromotionResult> => {
      try {
        const { data, error } = await client.rpc('promote_addon_waitlist_user', {
          p_waitlist_entry_id: entryId,
        });

        if (error) {
          console.error('Error promoting addon waitlist user:', error);
          return { success: false, error: error.message };
        }

        // The RPC returns JSON: { success, error? }
        return data as AddonPromotionResult;
      } catch (err) {
        console.error('Error promoting addon waitlist user:', err);
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error occurred',
        };
      }
    },
    [client]
  );

  // --------------------------------------------------------------------------
  // bulkUpdateStatus
  // --------------------------------------------------------------------------

  const bulkUpdateStatus = useCallback(
    async (
      ids: string[],
      targetStatus: WaitlistStatus,
      onProgress?: (current: number, total: number) => void
    ): Promise<BulkUpdateResult> => {
      const succeeded: string[] = [];
      const failed: { id: string; error: string }[] = [];

      let index = 0;
      for (const id of ids) {
        index++;
        onProgress?.(index, ids.length);

        try {
          if (targetStatus === 'promoted') {
            const result = await promoteUser(id);
            if (result.success) {
              succeeded.push(id);
            } else {
              failed.push({ id, error: result.error || 'Promotion failed' });
            }
          } else {
            await updateEntry(id, { status: targetStatus });
            succeeded.push(id);
          }
        } catch (err) {
          failed.push({
            id,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }

      return { succeeded, failed };
    },
    [promoteUser, updateEntry]
  );

  // --------------------------------------------------------------------------
  // calculateInvoices
  // --------------------------------------------------------------------------

  const calculateInvoices = useCallback(
    async (entryIds: string[]): Promise<AddonInvoiceCalculation[]> => {
      const calculations: AddonInvoiceCalculation[] = [];

      for (const entryId of entryIds) {
        try {
          const { data: entry, error: entryError } = await client
            .from('addon_waitlist')
            .select(`
              id,
              user_id,
              email,
              first_name,
              last_name,
              addon_id,
              variant_name,
              status,
              addons:addon_id (
                name,
                price,
                has_variants,
                variants
              )
            `)
            .eq('id', entryId)
            .single();

          if (entryError || !entry) {
            console.error(`Error fetching addon waitlist entry ${entryId}:`, entryError);
            continue;
          }

          // Only calculate for promoted entries
          if (entry.status !== 'promoted') {
            continue;
          }

          const addonsData = entry.addons as {
            name: string;
            price: number;
            has_variants: boolean;
            variants: AddonVariant[] | null;
          } | {
            name: string;
            price: number;
            has_variants: boolean;
            variants: AddonVariant[] | null;
          }[] | null;

          const addon = Array.isArray(addonsData) ? addonsData[0] : addonsData;
          if (!addon) {
            continue;
          }

          let addonPrice = addon.price;

          // If entry has a variant_name, look up the variant price modifier
          if (entry.variant_name && addon.variants) {
            const variant = addon.variants.find(
              (v) => v.name === entry.variant_name
            );
            if (variant) {
              const modifier = variant.priceModifier ?? variant.price_modifier ?? 0;
              addonPrice = addonPrice + modifier;
            }
          }

          calculations.push({
            waitlistEntryId: entry.id,
            userId: entry.user_id,
            email: entry.email,
            firstName: entry.first_name,
            lastName: entry.last_name,
            addonId: entry.addon_id,
            addonName: addon.name,
            variantName: entry.variant_name,
            addonPrice,
            totalAmount: addonPrice,
          });
        } catch (err) {
          console.error(`Error calculating invoice for addon waitlist entry ${entryId}:`, err);
        }
      }

      return calculations;
    },
    [client]
  );

  // --------------------------------------------------------------------------
  // sendInvoices
  // --------------------------------------------------------------------------

  const sendInvoices = useCallback(
    async (request: SendInvoicesRequest): Promise<SendInvoicesResponse> => {
      try {
        // Log current auth state before making the call
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData?.session;

        console.log('[ADDON_SEND_INVOICES] Initiating invoice send:', {
          entryCount: request.waitlistEntryIds.length,
          hasSession: !!session,
          userId: session?.user?.id,
          userEmail: session?.user?.email,
          tokenExpiresAt: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
          tokenExpired: session?.expires_at ? (session.expires_at * 1000) < Date.now() : null,
        });

        if (!session) {
          console.error('[ADDON_SEND_INVOICES] No active session - user may have been logged out');
          return {
            success: false,
            results: [],
            totalSent: 0,
            totalFailed: request.waitlistEntryIds.length,
            error: 'No active session. Please log in again.',
          } as SendInvoicesResponse;
        }

        // Check if token is about to expire (within 5 minutes)
        const fiveMinutesFromNow = Date.now() + 5 * 60 * 1000;
        if (session.expires_at && session.expires_at * 1000 < fiveMinutesFromNow) {
          console.warn('[ADDON_SEND_INVOICES] Token expiring soon, attempting refresh...');
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {
            console.error('[ADDON_SEND_INVOICES] Token refresh failed:', refreshError);
          } else {
            console.log(
              '[ADDON_SEND_INVOICES] Token refreshed successfully, new expiry:',
              refreshData.session?.expires_at
                ? new Date(refreshData.session.expires_at * 1000).toISOString()
                : 'unknown'
            );
          }
        }

        // Use supabase client (not supabaseAdmin) to include user's JWT token
        // The Edge Function needs the user token to verify admin role
        console.log('[ADDON_SEND_INVOICES] Calling Edge Function create-waitlist-invoices...');
        const { data, error } = await supabase.functions.invoke('create-waitlist-invoices', {
          body: { ...request, type: 'addon' },
        });

        if (error) {
          console.error('[ADDON_SEND_INVOICES] Edge Function error:', {
            message: error.message,
            name: error.name,
            context: error.context,
            details: error,
          });
          return {
            success: false,
            results: data?.results || [],
            totalSent: data?.totalSent || 0,
            totalFailed: data?.totalFailed || request.waitlistEntryIds.length,
          };
        }

        console.log('[ADDON_SEND_INVOICES] Edge Function response:', {
          success: data?.success,
          totalSent: data?.totalSent,
          totalFailed: data?.totalFailed,
          errorMessage: data?.error,
        });

        return data as SendInvoicesResponse;
      } catch (err) {
        console.error('[ADDON_SEND_INVOICES] Unexpected error:', err);
        return {
          success: false,
          results: [],
          totalSent: 0,
          totalFailed: request.waitlistEntryIds.length,
        };
      }
    },
    [client]
  );

  // --------------------------------------------------------------------------
  // verifyPurchases
  // --------------------------------------------------------------------------

  const verifyPurchases = useCallback(
    async (addonId?: string): Promise<AddonVerificationResult> => {
      try {
        // Fetch non-cancelled/non-expired addon waitlist entries
        let waitlistQuery = client
          .from('addon_waitlist')
          .select(`
            id,
            user_id,
            addon_id,
            variant_name,
            position,
            joined_at,
            email,
            first_name,
            last_name,
            status,
            addons:addon_id (
              name
            )
          `)
          .not('status', 'in', '(cancelled,expired)');

        if (addonId) {
          waitlistQuery = waitlistQuery.eq('addon_id', addonId);
        }

        const { data: waitlistData, error: waitlistError } = await waitlistQuery;

        if (waitlistError) {
          console.error('Error fetching addon waitlist entries for verification:', waitlistError);
          throw waitlistError;
        }

        if (!waitlistData || waitlistData.length === 0) {
          return {
            duplicates: [],
            totalWaitlistChecked: 0,
            duplicateCount: 0,
          };
        }

        // Collect unique addon_ids to query order_items
        const addonIds = [...new Set(waitlistData.map((e) => e.addon_id))];

        // Fetch order_items joined through orders to get user_id
        const { data: orderItems, error: orderItemsError } = await client
          .from('order_items')
          .select('addon_id, orders!inner(user_id, created_at)')
          .in('addon_id', addonIds);

        if (orderItemsError) {
          console.error('Error fetching order items for verification:', orderItemsError);
          throw orderItemsError;
        }

        // Build map: "userId-addonId" -> order info
        const purchaseMap = new Map<
          string,
          { orderItemId: string; orderDate: string }
        >();

        (orderItems || []).forEach((item) => {
          const ordersData = item.orders as
            | { user_id: string; created_at: string }
            | { user_id: string; created_at: string }[]
            | null;
          const order = Array.isArray(ordersData) ? ordersData[0] : ordersData;
          if (!order) return;
          const key = `${order.user_id}-${item.addon_id}`;
          if (!purchaseMap.has(key)) {
            purchaseMap.set(key, {
              orderItemId: `${order.user_id}-${item.addon_id}`,
              orderDate: order.created_at || '',
            });
          }
        });

        // Find duplicates — users who are on the waitlist AND have a purchase
        const duplicates: AddonWaitlistDuplicateEntry[] = [];

        for (const entry of waitlistData) {
          const key = `${entry.user_id}-${entry.addon_id}`;
          const purchase = purchaseMap.get(key);

          if (purchase) {
            const addonsData = entry.addons as { name: string } | { name: string }[] | null;
            const addon = Array.isArray(addonsData) ? addonsData[0] : addonsData;

            duplicates.push({
              waitlistEntryId: entry.id,
              userId: entry.user_id,
              email: entry.email,
              firstName: entry.first_name,
              lastName: entry.last_name,
              addonId: entry.addon_id,
              addonName: addon?.name || 'Unknown Addon',
              variantName: entry.variant_name,
              waitlistStatus: entry.status as WaitlistStatus,
              waitlistPosition: entry.position,
              waitlistJoinedAt: entry.joined_at,
              orderItemId: purchase.orderItemId,
              orderDate: purchase.orderDate,
            });
          }
        }

        return {
          duplicates,
          totalWaitlistChecked: waitlistData.length,
          duplicateCount: duplicates.length,
        };
      } catch (err) {
        console.error('Error verifying addon purchases:', err);
        throw err;
      }
    },
    [client]
  );

  // --------------------------------------------------------------------------
  // getRegisteredUsers
  // --------------------------------------------------------------------------

  const getRegisteredUsers = useCallback(async (): Promise<RegisteredUser[]> => {
    // Fetch all profiles
    const { data: profiles, error: profilesError } = await client
      .from('profiles')
      .select('id, first_name, last_name')
      .order('last_name', { ascending: true });

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      throw profilesError;
    }

    // Fetch user emails from auth.users using admin API
    const emailsMap = new Map<string, string>();
    if (supabaseAdmin) {
      try {
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers({
          perPage: 10000,
        });
        if (authError) {
          console.error('Error fetching auth users:', authError);
        } else if (authData?.users) {
          authData.users.forEach((user) => {
            if (user.email) {
              emailsMap.set(user.id, user.email);
            }
          });
        }
      } catch (err) {
        console.error('Error fetching user emails:', err);
      }
    }

    // Map profiles with emails
    return (profiles || [])
      .map((profile) => {
        const email = emailsMap.get(profile.id) || '';
        const firstName = profile.first_name || '';
        const lastName = profile.last_name || '';
        const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Unknown User';

        return {
          id: profile.id,
          email,
          firstName,
          lastName,
          fullName,
        };
      })
      .filter((user) => user.email); // Only return users with emails
  }, [client]);

  // --------------------------------------------------------------------------
  // Return
  // --------------------------------------------------------------------------

  return {
    getEntries,
    createEntry,
    updateEntry,
    deleteEntry,
    confirmEntry,
    confirmEntries,
    promoteUser,
    bulkUpdateStatus,
    calculateInvoices,
    sendInvoices,
    verifyPurchases,
    getRegisteredUsers,
  };
}
