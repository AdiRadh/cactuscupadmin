import { useCallback } from 'react';
import { supabaseAdmin, supabase } from '@/lib/api/supabase';
import type { WaitlistEntry, WaitlistStatus } from '@/types';

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
  created_at: string;
  updated_at: string;
}

interface WaitlistWithTournament extends DbWaitlistEntry {
  tournaments: {
    name: string;
  } | null;
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

  return {
    getWaitlistEntries,
    createWaitlistEntry,
    updateWaitlistEntry,
    deleteWaitlistEntry,
    getWaitlistCounts,
    getRegisteredUsers,
  };
}
