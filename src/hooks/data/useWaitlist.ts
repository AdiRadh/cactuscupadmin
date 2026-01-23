import { useCallback } from 'react';
import { supabaseAdmin, supabase } from '@/lib/api/supabase';
import { isEarlyBirdActive } from '@/lib/utils/stripe';
import type {
  WaitlistEntry,
  WaitlistStatus,
  WaitlistInvoice,
  InvoiceCalculation,
  SendInvoicesRequest,
  SendInvoicesResponse,
  WaitlistEntryWithTournament,
  UserWithPromotedEntries,
  CombinedInvoice,
} from '@/types';

interface DbWaitlistEntry {
  id: string;
  user_id: string;
  tournament_id: string;
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

interface DbWaitlistInvoice {
  id: string;
  waitlist_entry_id: string;
  user_id: string;
  tournament_id: string;
  stripe_invoice_id: string;
  stripe_customer_id: string;
  stripe_hosted_invoice_url: string | null;
  tournament_fee: number;
  event_registration_fee: number;
  total_amount: number;
  status: string;
  due_date: string;
  created_at: string;
  sent_at: string | null;
  paid_at: string | null;
  voided_at: string | null;
  expired_at: string | null;
  includes_event_registration: boolean;
}

interface WaitlistWithTournament extends DbWaitlistEntry {
  tournaments: {
    name: string;
  } | null;
}

/**
 * Convert database waitlist invoice to domain model
 */
function dbToWaitlistInvoice(db: DbWaitlistInvoice): WaitlistInvoice {
  return {
    id: db.id,
    waitlistEntryId: db.waitlist_entry_id,
    userId: db.user_id,
    tournamentId: db.tournament_id,
    stripeInvoiceId: db.stripe_invoice_id,
    stripeCustomerId: db.stripe_customer_id,
    stripeHostedInvoiceUrl: db.stripe_hosted_invoice_url,
    tournamentFee: db.tournament_fee,
    eventRegistrationFee: db.event_registration_fee,
    totalAmount: db.total_amount,
    status: db.status as WaitlistInvoice['status'],
    dueDate: db.due_date,
    createdAt: db.created_at,
    sentAt: db.sent_at,
    paidAt: db.paid_at,
    voidedAt: db.voided_at,
    expiredAt: db.expired_at,
    includesEventRegistration: db.includes_event_registration,
  };
}

/**
 * Convert database waitlist entry to domain model
 */
function dbToWaitlistEntry(db: WaitlistWithTournament): WaitlistEntry {
  return {
    id: db.id,
    userId: db.user_id,
    tournamentId: db.tournament_id,
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
    tournamentName: db.tournaments?.name,
  };
}

export interface CreateWaitlistEntryData {
  tournamentId: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface RegisteredUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
}

/**
 * Result of a waitlist promotion attempt
 */
export interface PromotionResult {
  success: boolean;
  needsConfirmation?: boolean;
  warning?: string;
  capIncreased?: boolean;
  error?: string;
  currentParticipants?: number;
  maxParticipants?: number;
  reservedParticipants?: number;
  entryId?: string;
  userId?: string;
  tournamentId?: string;
}

/**
 * Result of verifying waitlist users against tournament registrations
 */
export interface WaitlistDuplicateEntry {
  waitlistEntryId: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  tournamentId: string;
  tournamentName: string;
  waitlistStatus: WaitlistStatus;
  waitlistPosition: number;
  waitlistJoinedAt: string;
  registrationId: string;
  registrationPaymentStatus: string;
  registrationDate: string;
}

export interface WaitlistVerificationResult {
  duplicates: WaitlistDuplicateEntry[];
  totalWaitlistChecked: number;
  duplicateCount: number;
}

/**
 * Result of creating a tournament registration from a waitlist entry
 */
export interface CreateRegistrationResult {
  success: boolean;
  tournamentRegistrationId?: string;
  error?: string;
}

/**
 * Result of bulk status update
 */
export interface BulkUpdateResult {
  succeeded: string[];
  failed: { id: string; error: string }[];
}

export interface UseWaitlistReturn {
  /**
   * Fetch waitlist entries, optionally filtered by tournament
   */
  getWaitlistEntries: (tournamentId?: string) => Promise<WaitlistEntry[]>;

  /**
   * Bulk update status for multiple waitlist entries
   * Processes entries one-by-one with progress callback
   * Uses promoteWaitlistUser for 'promoted' status, updateWaitlistEntry for others
   */
  bulkUpdateWaitlistStatus: (
    ids: string[],
    targetStatus: WaitlistStatus,
    onProgress?: (current: number, total: number) => void
  ) => Promise<BulkUpdateResult>;

  /**
   * Create a new waitlist entry (admin can add anyone, even non-registered users)
   */
  createWaitlistEntry: (data: CreateWaitlistEntryData) => Promise<{ id: string; position: number }>;

  /**
   * Update a waitlist entry (position, status)
   */
  updateWaitlistEntry: (
    id: string,
    data: { position?: number; status?: WaitlistStatus }
  ) => Promise<void>;

  /**
   * Delete a waitlist entry
   */
  deleteWaitlistEntry: (id: string) => Promise<void>;

  /**
   * Confirm a waitlist entry (sets status to 'confirmed' and confirmed_at timestamp)
   * Used for duplicates where user already has a tournament registration
   */
  confirmWaitlistEntry: (id: string) => Promise<void>;

  /**
   * Create a tournament registration from a confirmed waitlist entry
   * This requires admin confirmation before being called
   */
  createTournamentRegistrationFromWaitlist: (waitlistEntryId: string) => Promise<CreateRegistrationResult>;

  /**
   * Confirm multiple waitlist entries at once
   */
  confirmWaitlistEntries: (ids: string[]) => Promise<{ succeeded: string[]; failed: string[] }>;

  /**
   * Get waitlist count per tournament
   */
  getWaitlistCounts: () => Promise<{ tournamentId: string; tournamentName: string; count: number }[]>;

  /**
   * Get all registered users for the searchable dropdown
   */
  getRegisteredUsers: () => Promise<RegisteredUser[]>;

  /**
   * Promote a waitlist user with capacity checking
   * If tournament is at capacity and bypassCapacity is false, returns needsConfirmation: true
   * If bypassCapacity is true, will auto-increase max_participants
   */
  promoteWaitlistUser: (entryId: string, bypassCapacity?: boolean) => Promise<PromotionResult>;

  /**
   * Calculate invoice amounts for promoted waitlist entries
   */
  calculateInvoices: (entryIds: string[]) => Promise<InvoiceCalculation[]>;

  /**
   * Send invoices to promoted waitlist entries
   */
  sendInvoices: (request: SendInvoicesRequest) => Promise<SendInvoicesResponse>;

  /**
   * Get invoice for a waitlist entry
   */
  getInvoiceForEntry: (entryId: string) => Promise<WaitlistInvoice | null>;

  /**
   * Verify which waitlist users are already registered for their tournament
   * Returns a list of duplicates where a user is both on the waitlist AND registered
   */
  verifyWaitlistRegistrations: (tournamentId?: string) => Promise<WaitlistVerificationResult>;

  /**
   * Get all promoted, unbilled entries for a specific user
   */
  getPromotedEntriesByUser: (userId: string) => Promise<WaitlistEntryWithTournament[]>;

  /**
   * Get all users with promoted but unbilled entries
   */
  getUsersWithPromotedEntries: () => Promise<UserWithPromotedEntries[]>;

  /**
   * Create a combined invoice for multiple waitlist entries
   */
  createCombinedInvoice: (params: {
    userId: string;
    waitlistEntryIds: string[];
    dueDays?: number;
    notes?: string;
  }) => Promise<{ success: boolean; invoiceUrl?: string; error?: string }>;

  /**
   * Get combined invoices with optional filters
   */
  getCombinedInvoices: (filters?: { status?: string; userId?: string }) => Promise<CombinedInvoice[]>;
}

/**
 * Hook for managing tournament waitlist entries
 * Uses admin client to bypass RLS for full access
 */
export function useWaitlist(): UseWaitlistReturn {
  const client = supabaseAdmin ?? supabase;

  const getWaitlistEntries = useCallback(
    async (tournamentId?: string): Promise<WaitlistEntry[]> => {
      let query = client
        .from('tournament_waitlist')
        .select(`
          *,
          tournaments:tournament_id (
            name
          )
        `)
        .order('position', { ascending: true });

      if (tournamentId) {
        query = query.eq('tournament_id', tournamentId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching waitlist entries:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Get unique user_id + tournament_id pairs to check for existing registrations
      const userIds = [...new Set(data.map((e) => e.user_id))];
      const tournamentIds = [...new Set(data.map((e) => e.tournament_id))];

      // Fetch existing tournament registrations for these user/tournament combinations
      const { data: registrations } = await client
        .from('tournament_registrations')
        .select('user_id, tournament_id')
        .in('user_id', userIds)
        .in('tournament_id', tournamentIds);

      // Create a Set of "userId-tournamentId" keys for quick lookup
      const registrationKeys = new Set(
        (registrations || []).map((r) => `${r.user_id}-${r.tournament_id}`)
      );

      // Map entries and include hasTournamentRegistration flag
      return data.map((entry) => {
        const baseEntry = dbToWaitlistEntry(entry as WaitlistWithTournament);
        const key = `${entry.user_id}-${entry.tournament_id}`;
        return {
          ...baseEntry,
          hasTournamentRegistration: registrationKeys.has(key),
        };
      });
    },
    [client]
  );

  const createWaitlistEntry = useCallback(
    async (data: CreateWaitlistEntryData): Promise<{ id: string; position: number }> => {
      // Get the next position for this tournament
      const { data: existingEntries, error: countError } = await client
        .from('tournament_waitlist')
        .select('position')
        .eq('tournament_id', data.tournamentId)
        .eq('status', 'waiting')
        .order('position', { ascending: false })
        .limit(1);

      if (countError) {
        console.error('Error getting waitlist position:', countError);
        throw countError;
      }

      const lastEntry = existingEntries?.[0];
      const nextPosition = lastEntry ? lastEntry.position + 1 : 1;

      // Create the waitlist entry
      const now = new Date().toISOString();
      const insertData = {
        tournament_id: data.tournamentId,
        user_id: data.userId,
        email: data.email,
        first_name: data.firstName,
        last_name: data.lastName,
        position: nextPosition,
        status: 'waiting',
        joined_at: now,
        created_at: now,
        updated_at: now,
      };

      const { data: newEntry, error: insertError } = await client
        .from('tournament_waitlist')
        .insert(insertData)
        .select('id, position')
        .single();

      if (insertError) {
        console.error('Error creating waitlist entry:', insertError);
        throw insertError;
      }

      return { id: newEntry.id, position: newEntry.position };
    },
    [client]
  );

  const updateWaitlistEntry = useCallback(
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
        .from('tournament_waitlist')
        .update(updateData)
        .eq('id', id);

      if (error) {
        console.error('Error updating waitlist entry:', error);
        throw error;
      }
    },
    [client]
  );

  const deleteWaitlistEntry = useCallback(
    async (id: string): Promise<void> => {
      const { error } = await client
        .from('tournament_waitlist')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting waitlist entry:', error);
        throw error;
      }
    },
    [client]
  );

  const confirmWaitlistEntry = useCallback(
    async (id: string): Promise<void> => {
      const now = new Date().toISOString();
      const { error } = await client
        .from('tournament_waitlist')
        .update({
          status: 'confirmed',
          confirmed_at: now,
          updated_at: now,
        })
        .eq('id', id);

      if (error) {
        console.error('Error confirming waitlist entry:', error);
        throw error;
      }
    },
    [client]
  );

  const confirmWaitlistEntries = useCallback(
    async (ids: string[]): Promise<{ succeeded: string[]; failed: string[] }> => {
      const succeeded: string[] = [];
      const failed: string[] = [];

      for (const id of ids) {
        try {
          await confirmWaitlistEntry(id);
          succeeded.push(id);
        } catch (err) {
          console.error(`Error confirming waitlist entry ${id}:`, err);
          failed.push(id);
        }
      }

      return { succeeded, failed };
    },
    [confirmWaitlistEntry]
  );

  const getWaitlistCounts = useCallback(async (): Promise<
    { tournamentId: string; tournamentName: string; count: number }[]
  > => {
    // Get all tournaments with their waitlist counts
    const { data: tournaments, error: tournamentsError } = await client
      .from('tournaments')
      .select('id, name')
      .order('name');

    if (tournamentsError) {
      console.error('Error fetching tournaments:', tournamentsError);
      throw tournamentsError;
    }

    // Get waitlist counts grouped by tournament
    const { data: waitlistData, error: waitlistError } = await client
      .from('tournament_waitlist')
      .select('tournament_id')
      .eq('status', 'waiting');

    if (waitlistError) {
      console.error('Error fetching waitlist counts:', waitlistError);
      throw waitlistError;
    }

    // Count entries per tournament
    const countMap = new Map<string, number>();
    (waitlistData || []).forEach((entry) => {
      const current = countMap.get(entry.tournament_id) || 0;
      countMap.set(entry.tournament_id, current + 1);
    });

    // Only return tournaments that have waitlist entries
    return (tournaments || [])
      .filter((t) => countMap.has(t.id))
      .map((t) => ({
        tournamentId: t.id,
        tournamentName: t.name,
        count: countMap.get(t.id) || 0,
      }));
  }, [client]);

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

  const promoteWaitlistUser = useCallback(
    async (entryId: string, bypassCapacity: boolean = false): Promise<PromotionResult> => {
      try {
        const { data, error } = await client.rpc('promote_waitlist_user', {
          p_waitlist_entry_id: entryId,
          p_bypass_capacity: bypassCapacity,
        });

        if (error) {
          console.error('Error promoting waitlist user:', error);
          return { success: false, error: error.message };
        }

        // The RPC returns a JSON object with the result
        return data as PromotionResult;
      } catch (err) {
        console.error('Error promoting waitlist user:', err);
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error occurred',
        };
      }
    },
    [client]
  );

  const bulkUpdateWaitlistStatus = useCallback(
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
            const result = await promoteWaitlistUser(id, true);
            if (result.success) {
              succeeded.push(id);
            } else {
              failed.push({ id, error: result.error || 'Promotion failed' });
            }
          } else {
            // Use regular update for other statuses
            await updateWaitlistEntry(id, { status: targetStatus });
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
    [promoteWaitlistUser, updateWaitlistEntry]
  );

  const calculateInvoices = useCallback(
    async (entryIds: string[]): Promise<InvoiceCalculation[]> => {
      const calculations: InvoiceCalculation[] = [];

      // Get site settings for event registration fee (including early bird)
      const { data: settings } = await client
        .from('site_settings')
        .select('setting_key, setting_value')
        .in('setting_key', [
          'supporter_entry_fee',
          'event_registration_fee',
          'event_registration_early_bird_fee',
          'event_registration_early_bird_end_date',
        ]);

      const settingsMap: Record<string, string> = {};
      for (const row of settings || []) {
        settingsMap[row.setting_key] = row.setting_value;
      }

      const regularEventRegFee = parseInt(
        settingsMap['supporter_entry_fee'] || settingsMap['event_registration_fee'] || '5000',
        10
      );

      // Check if event registration early bird is active
      const earlyBirdEventRegFeeStr = settingsMap['event_registration_early_bird_fee'];
      const earlyBirdEventRegEndDate = settingsMap['event_registration_early_bird_end_date'];
      const earlyBirdEventRegFee = earlyBirdEventRegFeeStr ? parseInt(earlyBirdEventRegFeeStr, 10) : null;

      const isEventRegEarlyBirdActive = (() => {
        if (!earlyBirdEventRegFee || !earlyBirdEventRegEndDate) return false;
        const now = new Date();
        const endDate = new Date(earlyBirdEventRegEndDate);
        return now < endDate;
      })();

      const eventRegFee = isEventRegEarlyBirdActive && earlyBirdEventRegFee
        ? earlyBirdEventRegFee
        : regularEventRegFee;

      for (const entryId of entryIds) {
        try {
          // Fetch entry with tournament info (including early bird pricing)
          const { data: entry, error: entryError } = await client
            .from('tournament_waitlist')
            .select(`
              id,
              user_id,
              email,
              first_name,
              last_name,
              tournament_id,
              status,
              tournaments:tournament_id (
                id,
                name,
                registration_fee,
                early_bird_price,
                early_bird_start_date,
                early_bird_end_date
              )
            `)
            .eq('id', entryId)
            .single();

          if (entryError || !entry) {
            console.error(`Error fetching entry ${entryId}:`, entryError);
            continue;
          }

          // Only calculate for promoted entries
          if (entry.status !== 'promoted') {
            continue;
          }

          const tournamentsData = entry.tournaments as {
            id: string;
            name: string;
            registration_fee: number;
            early_bird_price: number | null;
            early_bird_start_date: string | null;
            early_bird_end_date: string | null;
          }[] | {
            id: string;
            name: string;
            registration_fee: number;
            early_bird_price: number | null;
            early_bird_start_date: string | null;
            early_bird_end_date: string | null;
          } | null;
          const tournament = Array.isArray(tournamentsData) ? tournamentsData[0] : tournamentsData;
          if (!tournament) {
            continue;
          }

          // Determine tournament fee (use early bird if active)
          const earlyBirdActive = isEarlyBirdActive(
            tournament.early_bird_start_date,
            tournament.early_bird_end_date
          );
          const tournamentFee = (earlyBirdActive && tournament.early_bird_price != null)
            ? tournament.early_bird_price
            : tournament.registration_fee;

          // Check if user has event registration
          const { data: eventReg } = await client
            .from('event_registrations')
            .select('id')
            .eq('user_id', entry.user_id)
            .eq('event_year', 2026)
            .eq('payment_status', 'completed')
            .maybeSingle();

          const needsEventReg = !eventReg;
          const eventFee = needsEventReg ? eventRegFee : 0;

          calculations.push({
            waitlistEntryId: entry.id,
            userId: entry.user_id,
            email: entry.email,
            firstName: entry.first_name,
            lastName: entry.last_name,
            tournamentId: tournament.id,
            tournamentName: tournament.name,
            tournamentFee: tournamentFee,
            needsEventRegistration: needsEventReg,
            eventRegistrationFee: eventFee,
            totalAmount: tournamentFee + eventFee,
          });
        } catch (err) {
          console.error(`Error calculating invoice for ${entryId}:`, err);
        }
      }

      return calculations;
    },
    [client]
  );

  const sendInvoices = useCallback(
    async (request: SendInvoicesRequest): Promise<SendInvoicesResponse> => {
      try {
        // Log current auth state before making the call
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData?.session;

        console.log('[SEND_INVOICES] Initiating invoice send:', {
          entryCount: request.waitlistEntryIds.length,
          hasSession: !!session,
          userId: session?.user?.id,
          userEmail: session?.user?.email,
          tokenExpiresAt: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
          tokenExpired: session?.expires_at ? (session.expires_at * 1000) < Date.now() : null,
        });

        if (!session) {
          console.error('[SEND_INVOICES] No active session - user may have been logged out');
          return {
            success: false,
            results: [],
            totalSent: 0,
            totalFailed: request.waitlistEntryIds.length,
            error: 'No active session. Please log in again.',
          } as SendInvoicesResponse;
        }

        // Check if token is about to expire (within 5 minutes)
        const fiveMinutesFromNow = Date.now() + (5 * 60 * 1000);
        if (session.expires_at && (session.expires_at * 1000) < fiveMinutesFromNow) {
          console.warn('[SEND_INVOICES] Token expiring soon, attempting refresh...');
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {
            console.error('[SEND_INVOICES] Token refresh failed:', refreshError);
          } else {
            console.log('[SEND_INVOICES] Token refreshed successfully, new expiry:',
              refreshData.session?.expires_at ? new Date(refreshData.session.expires_at * 1000).toISOString() : 'unknown');
          }
        }

        // Use supabase client (not supabaseAdmin) to include user's JWT token
        // The Edge Function needs the user token to verify admin role
        console.log('[SEND_INVOICES] Calling Edge Function create-waitlist-invoices...');
        const { data, error } = await supabase.functions.invoke('create-waitlist-invoices', {
          body: request,
        });

        if (error) {
          console.error('[SEND_INVOICES] Edge Function error:', {
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

        console.log('[SEND_INVOICES] Edge Function response:', {
          success: data?.success,
          totalSent: data?.totalSent,
          totalFailed: data?.totalFailed,
          errorMessage: data?.error,
        });

        return data as SendInvoicesResponse;
      } catch (err) {
        console.error('[SEND_INVOICES] Unexpected error:', err);
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

  const getInvoiceForEntry = useCallback(
    async (entryId: string): Promise<WaitlistInvoice | null> => {
      const { data, error } = await client
        .from('waitlist_invoices')
        .select('*')
        .eq('waitlist_entry_id', entryId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching invoice:', error);
        return null;
      }

      if (!data) {
        return null;
      }

      return dbToWaitlistInvoice(data as DbWaitlistInvoice);
    },
    [client]
  );

  const verifyWaitlistRegistrations = useCallback(
    async (tournamentId?: string): Promise<WaitlistVerificationResult> => {
      try {
        // Fetch waitlist entries (excluding cancelled/expired as they're not active)
        let waitlistQuery = client
          .from('tournament_waitlist')
          .select(`
            id,
            user_id,
            tournament_id,
            position,
            joined_at,
            email,
            first_name,
            last_name,
            status,
            tournaments:tournament_id (
              name
            )
          `)
          .not('status', 'in', '(cancelled,expired)');

        if (tournamentId) {
          waitlistQuery = waitlistQuery.eq('tournament_id', tournamentId);
        }

        const { data: waitlistData, error: waitlistError } = await waitlistQuery;

        if (waitlistError) {
          console.error('Error fetching waitlist entries for verification:', waitlistError);
          throw waitlistError;
        }

        if (!waitlistData || waitlistData.length === 0) {
          return {
            duplicates: [],
            totalWaitlistChecked: 0,
            duplicateCount: 0,
          };
        }

        // Get unique user_id + tournament_id combinations to check
        const userTournamentPairs = waitlistData.map((entry) => ({
          userId: entry.user_id,
          tournamentId: entry.tournament_id,
        }));

        // Fetch all tournament registrations for these users
        const userIds = [...new Set(userTournamentPairs.map((p) => p.userId))];
        const tournamentIds = [...new Set(userTournamentPairs.map((p) => p.tournamentId))];

        const { data: registrations, error: regError } = await client
          .from('tournament_registrations')
          .select('id, user_id, tournament_id, payment_status, registered_at')
          .in('user_id', userIds)
          .in('tournament_id', tournamentIds);

        if (regError) {
          console.error('Error fetching tournament registrations for verification:', regError);
          throw regError;
        }

        // Create a map for quick lookup: `userId-tournamentId` -> registration
        const registrationMap = new Map<
          string,
          { id: string; paymentStatus: string; registeredAt: string }
        >();
        (registrations || []).forEach((reg) => {
          const key = `${reg.user_id}-${reg.tournament_id}`;
          registrationMap.set(key, {
            id: reg.id,
            paymentStatus: reg.payment_status || 'unknown',
            registeredAt: reg.registered_at || '',
          });
        });

        // Find duplicates - users who are on waitlist AND have a registration
        const duplicates: WaitlistDuplicateEntry[] = [];

        for (const entry of waitlistData) {
          const key = `${entry.user_id}-${entry.tournament_id}`;
          const registration = registrationMap.get(key);

          if (registration) {
            const tournamentsData = entry.tournaments as { name: string } | { name: string }[] | null;
            const tournament = Array.isArray(tournamentsData) ? tournamentsData[0] : tournamentsData;

            duplicates.push({
              waitlistEntryId: entry.id,
              userId: entry.user_id,
              email: entry.email,
              firstName: entry.first_name,
              lastName: entry.last_name,
              tournamentId: entry.tournament_id,
              tournamentName: tournament?.name || 'Unknown Tournament',
              waitlistStatus: entry.status as WaitlistStatus,
              waitlistPosition: entry.position,
              waitlistJoinedAt: entry.joined_at,
              registrationId: registration.id,
              registrationPaymentStatus: registration.paymentStatus,
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
        console.error('Error verifying waitlist registrations:', err);
        throw err;
      }
    },
    [client]
  );

  /**
   * Get all promoted, unbilled entries for a specific user
   */
  const getPromotedEntriesByUser = useCallback(async (userId: string): Promise<WaitlistEntryWithTournament[]> => {
    try {
      const { data, error } = await client
        .from('tournament_waitlist')
        .select(`
          *,
          tournaments (
            id,
            name,
            registration_fee,
            date
          )
        `)
        .eq('user_id', userId)
        .eq('status', 'promoted')
        .is('combined_invoice_id', null)
        .order('joined_at', { ascending: true });

      if (error || !data) return [];

      return data.map((entry: any) => ({
        ...dbToWaitlistEntry(entry as WaitlistWithTournament),
        tournament: {
          id: entry.tournaments.id,
          name: entry.tournaments.name,
          registrationFee: entry.tournaments.registration_fee,
          date: entry.tournaments.date,
        },
      }));
    } catch {
      return [];
    }
  }, [client]);

  /**
   * Get all users with promoted but unbilled entries
   */
  const getUsersWithPromotedEntries = useCallback(async (): Promise<UserWithPromotedEntries[]> => {
    try {
      // Get all promoted entries that don't have a combined invoice
      const { data, error } = await client
        .from('tournament_waitlist')
        .select(`
          *,
          tournaments (
            id,
            name,
            registration_fee,
            date
          )
        `)
        .eq('status', 'promoted')
        .is('combined_invoice_id', null)
        .order('user_id')
        .order('joined_at', { ascending: true });

      if (error || !data) return [];

      // Group entries by user
      const userMap = new Map<string, UserWithPromotedEntries>();

      for (const entry of data) {
        const userId = entry.user_id;
        const tournament = entry.tournaments as any;

        if (!userMap.has(userId)) {
          userMap.set(userId, {
            userId,
            email: entry.email,
            firstName: entry.first_name,
            lastName: entry.last_name,
            promotedEntries: [],
            totalAmount: 0,
          });
        }

        const user = userMap.get(userId)!;
        const entryWithTournament: WaitlistEntryWithTournament = {
          ...dbToWaitlistEntry(entry as WaitlistWithTournament),
          tournament: {
            id: tournament.id,
            name: tournament.name,
            registrationFee: tournament.registration_fee,
            date: tournament.date,
          },
        };

        user.promotedEntries.push(entryWithTournament);
        user.totalAmount += tournament.registration_fee || 0;
      }

      return Array.from(userMap.values());
    } catch {
      return [];
    }
  }, [client]);

  /**
   * Create a combined invoice for multiple waitlist entries
   */
  const createCombinedInvoice = useCallback(async (params: {
    userId: string;
    waitlistEntryIds: string[];
    dueDays?: number;
    notes?: string;
  }): Promise<{ success: boolean; invoiceUrl?: string; error?: string }> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return { success: false, error: 'Not authenticated' };
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-waitlist-invoices`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            mode: 'combined',
            userId: params.userId,
            waitlistEntryIds: params.waitlistEntryIds,
            dueDays: params.dueDays || 7,
            notes: params.notes,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        return { success: false, error: result.error || 'Failed to create invoice' };
      }

      return {
        success: true,
        invoiceUrl: result.stripeHostedInvoiceUrl,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      return { success: false, error: message };
    }
  }, []);

  /**
   * Create a tournament registration from a confirmed waitlist entry
   * This should only be called after admin confirmation
   */
  const createTournamentRegistrationFromWaitlist = useCallback(
    async (waitlistEntryId: string): Promise<CreateRegistrationResult> => {
      try {
        // Fetch the waitlist entry with tournament info
        const { data: entry, error: entryError } = await client
          .from('tournament_waitlist')
          .select(`
            id,
            user_id,
            tournament_id,
            status,
            tournaments:tournament_id (
              id,
              name,
              registration_fee
            )
          `)
          .eq('id', waitlistEntryId)
          .single();

        if (entryError || !entry) {
          console.error('Error fetching waitlist entry:', entryError);
          return { success: false, error: 'Waitlist entry not found' };
        }

        // Check that the entry is in confirmed status
        if (entry.status !== 'confirmed') {
          return {
            success: false,
            error: `Cannot create registration: entry is in "${entry.status}" status, must be "confirmed"`,
          };
        }

        // Check if a tournament registration already exists
        const { data: existingReg } = await client
          .from('tournament_registrations')
          .select('id')
          .eq('user_id', entry.user_id)
          .eq('tournament_id', entry.tournament_id)
          .maybeSingle();

        if (existingReg) {
          return {
            success: false,
            error: 'A tournament registration already exists for this user and tournament',
          };
        }

        // Get user profile for experience_level and club
        const { data: profile } = await client
          .from('profiles')
          .select('experience_level, club')
          .eq('id', entry.user_id)
          .single();

        // Get tournament fee
        const tournamentsData = entry.tournaments as {
          id: string;
          name: string;
          registration_fee: number;
        }[] | {
          id: string;
          name: string;
          registration_fee: number;
        } | null;
        const tournament = Array.isArray(tournamentsData) ? tournamentsData[0] : tournamentsData;
        const amountPaid = tournament?.registration_fee || 0;

        // Create the tournament registration
        const { data: newReg, error: regError } = await client
          .from('tournament_registrations')
          .insert({
            user_id: entry.user_id,
            tournament_id: entry.tournament_id,
            payment_status: 'completed',
            amount_paid: amountPaid,
            experience_level: profile?.experience_level || 'intermediate',
            club: profile?.club || null,
            waiver_accepted: false,
            details_completed: false,
            registered_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (regError) {
          console.error('Error creating tournament registration:', regError);
          return { success: false, error: regError.message };
        }

        return {
          success: true,
          tournamentRegistrationId: newReg.id,
        };
      } catch (err) {
        console.error('Error creating tournament registration from waitlist:', err);
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error occurred',
        };
      }
    },
    [client]
  );

  /**
   * Get combined invoices with optional filters
   */
  const getCombinedInvoices = useCallback(async (filters?: { status?: string; userId?: string }): Promise<CombinedInvoice[]> => {
    try {
      let query = client
        .from('combined_waitlist_invoices')
        .select(`
          *,
          combined_invoice_items (
            *,
            tournaments (
              id,
              name,
              date
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.userId) {
        query = query.eq('user_id', filters.userId);
      }

      const { data, error } = await query;

      if (error || !data) return [];

      return data.map((invoice: any) => ({
        id: invoice.id,
        userId: invoice.user_id,
        stripeInvoiceId: invoice.stripe_invoice_id,
        stripeCustomerId: invoice.stripe_customer_id,
        stripeHostedInvoiceUrl: invoice.stripe_hosted_invoice_url,
        totalAmount: invoice.total_amount,
        status: invoice.status,
        dueDate: invoice.due_date,
        sentAt: invoice.sent_at,
        paidAt: invoice.paid_at,
        includesEventRegistration: invoice.includes_event_registration,
        eventRegistrationFee: invoice.event_registration_fee,
        notes: invoice.notes,
        createdBy: invoice.created_by,
        createdAt: invoice.created_at,
        updatedAt: invoice.updated_at,
        items: invoice.combined_invoice_items?.map((item: any) => ({
          id: item.id,
          combinedInvoiceId: item.combined_invoice_id,
          waitlistEntryId: item.waitlist_entry_id,
          tournamentId: item.tournament_id,
          tournamentFee: item.tournament_fee,
          description: item.description,
          createdAt: item.created_at,
          tournament: item.tournaments ? {
            id: item.tournaments.id,
            name: item.tournaments.name,
            date: item.tournaments.date,
          } : undefined,
        })),
      }));
    } catch {
      return [];
    }
  }, [client]);

  return {
    getWaitlistEntries,
    createWaitlistEntry,
    updateWaitlistEntry,
    deleteWaitlistEntry,
    confirmWaitlistEntry,
    confirmWaitlistEntries,
    bulkUpdateWaitlistStatus,
    getWaitlistCounts,
    getRegisteredUsers,
    promoteWaitlistUser,
    calculateInvoices,
    sendInvoices,
    getInvoiceForEntry,
    verifyWaitlistRegistrations,
    getPromotedEntriesByUser,
    getUsersWithPromotedEntries,
    createCombinedInvoice,
    getCombinedInvoices,
    createTournamentRegistrationFromWaitlist,
  };
}
