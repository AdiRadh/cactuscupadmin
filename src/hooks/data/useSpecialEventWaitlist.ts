import { useCallback } from 'react';
import { supabaseAdmin, supabase } from '@/lib/api/supabase';
import type {
  SpecialEventWaitlistEntry,
  SEInvoiceCalculation,
  SEWaitlistDuplicateEntry,
  SEVerificationResult,
  WaitlistStatus,
  SendInvoicesRequest,
  SendInvoicesResponse,
} from '@/types';

// ---------------------------------------------------------------------------
// Local DB shape interfaces
// ---------------------------------------------------------------------------

interface DbSEWaitlistEntry {
  id: string;
  user_id: string;
  special_event_id: string;
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

interface SEWaitlistWithEvent extends DbSEWaitlistEntry {
  special_events: {
    title: string;
  } | null;
}

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

function dbToSEWaitlistEntry(db: SEWaitlistWithEvent): SpecialEventWaitlistEntry {
  return {
    id: db.id,
    userId: db.user_id,
    specialEventId: db.special_event_id,
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
    specialEventTitle: db.special_events?.title,
  };
}

// ---------------------------------------------------------------------------
// Exported interfaces
// ---------------------------------------------------------------------------

export interface CreateSEWaitlistEntryData {
  specialEventId: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface SEPromotionResult {
  success: boolean;
  needsConfirmation?: boolean;
  warning?: string;
  capIncreased?: boolean;
  error?: string;
  currentRegistrations?: number;
  maxCapacity?: number;
  reservedRegistrations?: number;
  entryId?: string;
  userId?: string;
  specialEventId?: string;
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

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSpecialEventWaitlist() {
  const client = supabaseAdmin ?? supabase;

  // -------------------------------------------------------------------------
  // getEntries
  // -------------------------------------------------------------------------
  const getEntries = useCallback(
    async (specialEventId?: string): Promise<SpecialEventWaitlistEntry[]> => {
      let query = client
        .from('special_event_waitlist')
        .select(`
          *,
          special_events (
            title
          )
        `)
        .order('position', { ascending: true });

      if (specialEventId) {
        query = query.eq('special_event_id', specialEventId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching special event waitlist entries:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Get unique user_id + special_event_id pairs to check for existing registrations
      const userIds = [...new Set(data.map((e) => e.user_id))];
      const eventIds = [...new Set(data.map((e) => e.special_event_id))];

      // Fetch existing special event registrations for these user/event combinations
      const { data: registrations } = await client
        .from('special_event_registrations')
        .select('user_id, event_id')
        .in('user_id', userIds)
        .in('event_id', eventIds);

      // Create a Set of "userId-eventId" keys for quick lookup
      const registrationKeys = new Set(
        (registrations || []).map((r) => `${r.user_id}-${r.event_id}`)
      );

      // Map entries and include hasSpecialEventRegistration flag
      return data.map((entry) => {
        const baseEntry = dbToSEWaitlistEntry(entry as SEWaitlistWithEvent);
        const key = `${entry.user_id}-${entry.special_event_id}`;
        return {
          ...baseEntry,
          hasSpecialEventRegistration: registrationKeys.has(key),
        };
      });
    },
    [client]
  );

  // -------------------------------------------------------------------------
  // createEntry
  // -------------------------------------------------------------------------
  const createEntry = useCallback(
    async (data: CreateSEWaitlistEntryData): Promise<{ id: string; position: number }> => {
      const MAX_RETRIES = 3;

      const attemptInsert = async (): Promise<{ id: string; position: number }> => {
        const now = new Date().toISOString();
        const insertData = {
          special_event_id: data.specialEventId,
          user_id: data.userId,
          email: data.email,
          first_name: data.firstName,
          last_name: data.lastName,
          // Position is auto-assigned by DB trigger; insert placeholder
          position: 0,
          status: 'waiting',
          joined_at: now,
          created_at: now,
          updated_at: now,
        };

        const { data: newEntry, error: insertError } = await client
          .from('special_event_waitlist')
          .insert(insertData)
          .select('id, position')
          .single();

        if (insertError) {
          // Postgres unique constraint violation — caller will retry
          if (insertError.code === '23505') {
            throw Object.assign(new Error('Unique constraint violation'), { code: '23505' });
          }
          console.error('Error creating special event waitlist entry:', insertError);
          throw insertError;
        }

        return { id: newEntry.id, position: newEntry.position };
      };

      let lastError: unknown;
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          return await attemptInsert();
        } catch (error: unknown) {
          lastError = error;
          const isUniqueViolation =
            error &&
            typeof error === 'object' &&
            'code' in error &&
            (error as { code: string }).code === '23505';

          if (isUniqueViolation) {
            console.warn(
              `Special event waitlist position conflict detected (attempt ${attempt + 1}/${MAX_RETRIES}), retrying...`
            );
            continue;
          }
          throw error;
        }
      }

      throw lastError;
    },
    [client]
  );

  // -------------------------------------------------------------------------
  // updateEntry
  // -------------------------------------------------------------------------
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
        // Set promoted_at timestamp when status changes to promoted
        if (data.status === 'promoted') {
          updateData.promoted_at = new Date().toISOString();
        }
        // Set confirmed_at timestamp when status changes to confirmed
        if (data.status === 'confirmed') {
          updateData.confirmed_at = new Date().toISOString();
        }
      }

      const { error } = await client
        .from('special_event_waitlist')
        .update(updateData)
        .eq('id', id);

      if (error) {
        console.error('Error updating special event waitlist entry:', error);
        throw error;
      }
    },
    [client]
  );

  // -------------------------------------------------------------------------
  // deleteEntry
  // -------------------------------------------------------------------------
  const deleteEntry = useCallback(
    async (id: string): Promise<void> => {
      const { error } = await client
        .from('special_event_waitlist')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting special event waitlist entry:', error);
        throw error;
      }
    },
    [client]
  );

  // -------------------------------------------------------------------------
  // confirmEntry
  // -------------------------------------------------------------------------
  const confirmEntry = useCallback(
    async (id: string): Promise<void> => {
      const now = new Date().toISOString();
      const { error } = await client
        .from('special_event_waitlist')
        .update({
          status: 'confirmed',
          confirmed_at: now,
          updated_at: now,
        })
        .eq('id', id);

      if (error) {
        console.error('Error confirming special event waitlist entry:', error);
        throw error;
      }
    },
    [client]
  );

  // -------------------------------------------------------------------------
  // confirmEntries
  // -------------------------------------------------------------------------
  const confirmEntries = useCallback(
    async (ids: string[]): Promise<{ succeeded: string[]; failed: string[] }> => {
      const succeeded: string[] = [];
      const failed: string[] = [];

      for (const id of ids) {
        try {
          await confirmEntry(id);
          succeeded.push(id);
        } catch (err) {
          console.error(`Error confirming special event waitlist entry ${id}:`, err);
          failed.push(id);
        }
      }

      return { succeeded, failed };
    },
    [confirmEntry]
  );

  // -------------------------------------------------------------------------
  // promoteUser
  // -------------------------------------------------------------------------
  const promoteUser = useCallback(
    async (entryId: string, bypassCapacity: boolean = false): Promise<SEPromotionResult> => {
      try {
        const { data, error } = await client.rpc('promote_special_event_waitlist_user', {
          p_waitlist_entry_id: entryId,
          p_bypass_capacity: bypassCapacity,
        });

        if (error) {
          console.error('Error promoting special event waitlist user:', error);
          return { success: false, error: error.message };
        }

        // The RPC returns a JSON object with the result
        return data as SEPromotionResult;
      } catch (err) {
        console.error('Error promoting special event waitlist user:', err);
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error occurred',
        };
      }
    },
    [client]
  );

  // -------------------------------------------------------------------------
  // bulkUpdateStatus
  // -------------------------------------------------------------------------
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
            // Use promotion flow for promoted status (handles capacity checks)
            const result = await promoteUser(id, true);
            if (result.success) {
              succeeded.push(id);
            } else {
              failed.push({ id, error: result.error || 'Promotion failed' });
            }
          } else {
            // Use regular update for other statuses
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

  // -------------------------------------------------------------------------
  // calculateInvoices
  // -------------------------------------------------------------------------
  const calculateInvoices = useCallback(
    async (entryIds: string[]): Promise<SEInvoiceCalculation[]> => {
      const calculations: SEInvoiceCalculation[] = [];

      for (const entryId of entryIds) {
        try {
          // Fetch entry with special event info (including ticket price)
          const { data: entry, error: entryError } = await client
            .from('special_event_waitlist')
            .select(`
              id,
              user_id,
              email,
              first_name,
              last_name,
              special_event_id,
              status,
              special_events (
                id,
                title,
                ticket_price
              )
            `)
            .eq('id', entryId)
            .single();

          if (entryError || !entry) {
            console.error(`Error fetching special event waitlist entry ${entryId}:`, entryError);
            continue;
          }

          // Only calculate for promoted entries
          if (entry.status !== 'promoted') {
            continue;
          }

          const eventsData = entry.special_events as
            | { id: string; title: string; ticket_price: number }[]
            | { id: string; title: string; ticket_price: number }
            | null;
          const specialEvent = Array.isArray(eventsData) ? eventsData[0] : eventsData;

          if (!specialEvent) {
            continue;
          }

          const ticketPrice = specialEvent.ticket_price ?? 0;

          calculations.push({
            waitlistEntryId: entry.id,
            userId: entry.user_id,
            email: entry.email,
            firstName: entry.first_name,
            lastName: entry.last_name,
            specialEventId: specialEvent.id,
            specialEventTitle: specialEvent.title,
            ticketPrice,
            totalAmount: ticketPrice,
          });
        } catch (err) {
          console.error(`Error calculating invoice for special event entry ${entryId}:`, err);
        }
      }

      return calculations;
    },
    [client]
  );

  // -------------------------------------------------------------------------
  // sendInvoices
  // -------------------------------------------------------------------------
  const sendInvoices = useCallback(
    async (request: SendInvoicesRequest): Promise<SendInvoicesResponse> => {
      try {
        // Log current auth state before making the call
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData?.session;

        console.log('[SE_SEND_INVOICES] Initiating invoice send:', {
          entryCount: request.waitlistEntryIds.length,
          hasSession: !!session,
          userId: session?.user?.id,
          userEmail: session?.user?.email,
          tokenExpiresAt: session?.expires_at
            ? new Date(session.expires_at * 1000).toISOString()
            : null,
          tokenExpired: session?.expires_at
            ? session.expires_at * 1000 < Date.now()
            : null,
        });

        if (!session) {
          console.error('[SE_SEND_INVOICES] No active session - user may have been logged out');
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
          console.warn('[SE_SEND_INVOICES] Token expiring soon, attempting refresh...');
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {
            console.error('[SE_SEND_INVOICES] Token refresh failed:', refreshError);
          } else {
            console.log(
              '[SE_SEND_INVOICES] Token refreshed successfully, new expiry:',
              refreshData.session?.expires_at
                ? new Date(refreshData.session.expires_at * 1000).toISOString()
                : 'unknown'
            );
          }
        }

        // Use supabase client (not supabaseAdmin) to include user's JWT token
        // The Edge Function needs the user token to verify admin role
        console.log('[SE_SEND_INVOICES] Calling Edge Function create-waitlist-invoices...');
        const { data, error } = await supabase.functions.invoke('create-waitlist-invoices', {
          body: { ...request, type: 'special_event' },
        });

        if (error) {
          console.error('[SE_SEND_INVOICES] Edge Function error:', {
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

        console.log('[SE_SEND_INVOICES] Edge Function response:', {
          success: data?.success,
          totalSent: data?.totalSent,
          totalFailed: data?.totalFailed,
          errorMessage: data?.error,
        });

        return data as SendInvoicesResponse;
      } catch (err) {
        console.error('[SE_SEND_INVOICES] Unexpected error:', err);
        return {
          success: false,
          results: [],
          totalSent: 0,
          totalFailed: request.waitlistEntryIds.length,
        };
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client]
  );

  // -------------------------------------------------------------------------
  // verifyRegistrations
  // -------------------------------------------------------------------------
  const verifyRegistrations = useCallback(
    async (specialEventId?: string): Promise<SEVerificationResult> => {
      try {
        // Fetch waitlist entries (excluding cancelled/expired as they're not active)
        let waitlistQuery = client
          .from('special_event_waitlist')
          .select(`
            id,
            user_id,
            special_event_id,
            position,
            joined_at,
            email,
            first_name,
            last_name,
            status,
            special_events (
              title
            )
          `)
          .not('status', 'in', '(cancelled,expired)');

        if (specialEventId) {
          waitlistQuery = waitlistQuery.eq('special_event_id', specialEventId);
        }

        const { data: waitlistData, error: waitlistError } = await waitlistQuery;

        if (waitlistError) {
          console.error(
            'Error fetching special event waitlist entries for verification:',
            waitlistError
          );
          throw waitlistError;
        }

        if (!waitlistData || waitlistData.length === 0) {
          return {
            duplicates: [],
            totalWaitlistChecked: 0,
            duplicateCount: 0,
          };
        }

        // Get unique user_id + special_event_id combinations to check
        const userIds = [...new Set(waitlistData.map((e) => e.user_id))];
        const eventIds = [...new Set(waitlistData.map((e) => e.special_event_id))];

        // Fetch all special event registrations for these users
        const { data: registrations, error: regError } = await client
          .from('special_event_registrations')
          .select('id, user_id, event_id, created_at')
          .in('user_id', userIds)
          .in('event_id', eventIds);

        if (regError) {
          console.error(
            'Error fetching special event registrations for verification:',
            regError
          );
          throw regError;
        }

        // Create a map for quick lookup: `userId-eventId` -> registration
        const registrationMap = new Map<
          string,
          { id: string; registeredAt: string }
        >();
        (registrations || []).forEach((reg) => {
          const key = `${reg.user_id}-${reg.event_id}`;
          registrationMap.set(key, {
            id: reg.id,
            registeredAt: reg.created_at || '',
          });
        });

        // Find duplicates - users who are on waitlist AND have a registration
        const duplicates: SEWaitlistDuplicateEntry[] = [];

        for (const entry of waitlistData) {
          const key = `${entry.user_id}-${entry.special_event_id}`;
          const registration = registrationMap.get(key);

          if (registration) {
            const eventsData = entry.special_events as
              | { title: string }
              | { title: string }[]
              | null;
            const specialEvent = Array.isArray(eventsData) ? eventsData[0] : eventsData;

            duplicates.push({
              waitlistEntryId: entry.id,
              userId: entry.user_id,
              email: entry.email,
              firstName: entry.first_name,
              lastName: entry.last_name,
              specialEventId: entry.special_event_id,
              specialEventTitle: specialEvent?.title || 'Unknown Event',
              waitlistStatus: entry.status as WaitlistStatus,
              waitlistPosition: entry.position,
              waitlistJoinedAt: entry.joined_at,
              registrationId: registration.id,
              registrationDate: registration.registeredAt,
            });
          }
        }

        return {
          duplicates,
          totalWaitlistChecked: waitlistData.length,
          duplicateCount: duplicates.length,
        };
      } catch (err) {
        console.error('Error verifying special event waitlist registrations:', err);
        throw err;
      }
    },
    [client]
  );

  // -------------------------------------------------------------------------
  // getRegisteredUsers
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // Return
  // -------------------------------------------------------------------------
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
    verifyRegistrations,
    getRegisteredUsers,
  };
}
