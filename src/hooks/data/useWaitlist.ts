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

export interface UseWaitlistReturn {
  /**
   * Fetch waitlist entries, optionally filtered by tournament
   */
  getWaitlistEntries: (tournamentId?: string) => Promise<WaitlistEntry[]>;

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

      return (data || []).map((entry) => dbToWaitlistEntry(entry as WaitlistWithTournament));
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
        // Use supabase client (not supabaseAdmin) to include user's JWT token
        // The Edge Function needs the user token to verify admin role
        const { data, error } = await supabase.functions.invoke('create-waitlist-invoices', {
          body: request,
        });

        if (error) {
          console.error('Error sending invoices:', error);
          return {
            success: false,
            results: data?.results || [],
            totalSent: data?.totalSent || 0,
            totalFailed: data?.totalFailed || request.waitlistEntryIds.length,
          };
        }

        return data as SendInvoicesResponse;
      } catch (err) {
        console.error('Error sending invoices:', err);
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

  return {
    getWaitlistEntries,
    createWaitlistEntry,
    updateWaitlistEntry,
    deleteWaitlistEntry,
    getWaitlistCounts,
    getRegisteredUsers,
    promoteWaitlistUser,
    calculateInvoices,
    sendInvoices,
    getInvoiceForEntry,
  };
}
