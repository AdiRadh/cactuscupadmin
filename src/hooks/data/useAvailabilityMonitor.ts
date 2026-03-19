import { useState, useEffect, useCallback, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { OrderItemType } from '@/types';

/**
 * Availability information for tournaments
 */
interface TournamentAvailability {
  id: string;
  currentParticipants: number;
  reservedParticipants: number;
  waitlistHeldSpots: number;
  maxParticipants: number;
  effectiveAvailable: number;
  isAvailable: boolean;
}

/**
 * Availability information for addons
 */
interface AddonAvailability {
  id: string;
  stockQuantity: number | null;
  reservedQuantity: number;
  hasInventory: boolean;
  effectiveAvailable: number | null;
  isAvailable: boolean;
}

/**
 * Availability cache structure
 */
interface AvailabilityCache {
  tournaments: Map<string, TournamentAvailability>;
  addons: Map<string, AddonAvailability>;
  lastUpdated: string;
}

/**
 * Capacity info including reservations
 */
export interface CapacityInfo {
  current: number;
  reserved: number;
  max: number;
  effectiveAvailable: number;
}

/**
 * Stock info including reservations
 */
export interface StockInfo {
  stock: number | null;
  reserved: number;
  effectiveAvailable: number | null;
}

/**
 * Return type for the useAvailabilityMonitor hook
 */
export interface UseAvailabilityMonitorResult {
  isAvailable: (itemId: string, itemType: OrderItemType) => boolean;
  currentCapacity: (tournamentId: string) => CapacityInfo | null;
  currentStock: (addonId: string) => StockInfo | null;
  subscribe: (itemId: string, itemType: OrderItemType) => void;
  unsubscribe: (itemId: string, itemType: OrderItemType) => void;
}

const ADDON_POLL_INTERVAL = 30000; // 30 seconds

/**
 * Hook for monitoring real-time availability of tournaments and addons
 * 
 * Features:
 * - Real-time Supabase subscriptions for tournament capacity
 * - Polling for addon inventory
 * - Availability cache for quick lookups
 * - Subscribe/unsubscribe functionality for specific items
 * 
 * @returns Availability monitoring functions
 */
export function useAvailabilityMonitor(): UseAvailabilityMonitorResult {
  const [cache, setCache] = useState<AvailabilityCache>({
    tournaments: new Map(),
    addons: new Map(),
    lastUpdated: new Date().toISOString(),
  });

  const subscriptionsRef = useRef<Map<string, RealtimeChannel>>(new Map());
  const subscribedItemsRef = useRef<Set<string>>(new Set());
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  /**
   * Fetch tournament availability from database
   */
  const fetchTournamentAvailability = useCallback(async (tournamentId: string) => {
    // Using select('*') for backwards compatibility during migration rollout.
    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single();

    if (error || !data) {
      console.error('Error fetching tournament availability:', error);
      return null;
    }

    const reservedParticipants = data.reserved_participants || 0;
    const waitlistHeldSpots = data.waitlist_held_spots || 0;
    const effectiveUsed = data.current_participants + reservedParticipants + waitlistHeldSpots;
    const effectiveAvailable = data.max_participants - effectiveUsed;

    const availability: TournamentAvailability = {
      id: data.id,
      currentParticipants: data.current_participants,
      reservedParticipants,
      waitlistHeldSpots,
      maxParticipants: data.max_participants,
      effectiveAvailable,
      isAvailable: data.status === 'open' && effectiveUsed < data.max_participants,
    };

    return availability;
  }, []);

  /**
   * Fetch addon availability from database
   */
  const fetchAddonAvailability = useCallback(async (addonId: string) => {
    const { data, error } = await supabase
      .from('addons')
      .select('id, stock_quantity, reserved_quantity, has_inventory, is_active')
      .eq('id', addonId)
      .single();

    if (error || !data) {
      console.error('Error fetching addon availability:', error);
      return null;
    }

    const reservedQuantity = data.reserved_quantity || 0;
    const effectiveAvailable = data.has_inventory && data.stock_quantity !== null
      ? data.stock_quantity - reservedQuantity
      : null;

    const availability: AddonAvailability = {
      id: data.id,
      stockQuantity: data.stock_quantity,
      reservedQuantity,
      hasInventory: data.has_inventory,
      effectiveAvailable,
      isAvailable: data.is_active && (!data.has_inventory || (effectiveAvailable !== null && effectiveAvailable > 0)),
    };

    return availability;
  }, []);

  /**
   * Update tournament in cache
   */
  const updateTournamentCache = useCallback((availability: TournamentAvailability) => {
    setCache((prev) => {
      const newTournaments = new Map(prev.tournaments);
      newTournaments.set(availability.id, availability);
      return {
        ...prev,
        tournaments: newTournaments,
        lastUpdated: new Date().toISOString(),
      };
    });
  }, []);

  /**
   * Update addon in cache
   */
  const updateAddonCache = useCallback((availability: AddonAvailability) => {
    setCache((prev) => {
      const newAddons = new Map(prev.addons);
      newAddons.set(availability.id, availability);
      return {
        ...prev,
        addons: newAddons,
        lastUpdated: new Date().toISOString(),
      };
    });
  }, []);

  /**
   * Handle reconnection for a tournament subscription
   */
  const reconnectTournament = useCallback((tournamentId: string, delayMs: number) => {
    // Clear any existing reconnect timeout
    const existingTimeout = reconnectTimeoutsRef.current.get(`tournament:${tournamentId}`);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Schedule reconnection
    const timeout = setTimeout(() => {
      const key = `tournament:${tournamentId}`;
      const existingSubscription = subscriptionsRef.current.get(key);
      
      if (existingSubscription && subscribedItemsRef.current.has(key)) {
        console.log(`Attempting to reconnect to tournament ${tournamentId}`);
        
        // Remove old subscription
        supabase.removeChannel(existingSubscription);
        subscriptionsRef.current.delete(key);
        
        // Create new subscription
        subscribeTournamentInternal(tournamentId);
      }
      
      reconnectTimeoutsRef.current.delete(`tournament:${tournamentId}`);
    }, delayMs);

    reconnectTimeoutsRef.current.set(`tournament:${tournamentId}`, timeout);
  }, []);

  /**
   * Internal function to set up tournament subscription
   */
  const subscribeTournamentInternal = useCallback(async (tournamentId: string) => {
    // Fetch initial data
    try {
      const availability = await fetchTournamentAvailability(tournamentId);
      if (availability) {
        updateTournamentCache(availability);
      }
    } catch (error) {
      console.error(`Error fetching initial tournament data for ${tournamentId}:`, error);
      // Continue with subscription setup even if initial fetch fails
    }

    // Set up real-time subscription with error handling and reconnection
    const subscription = supabase
      .channel(`tournament:${tournamentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournaments',
          filter: `id=eq.${tournamentId}`,
        },
        async (_payload) => {
          try {
            // Refetch to get updated data
            const updated = await fetchTournamentAvailability(tournamentId);
            if (updated) {
              updateTournamentCache(updated);
            }
          } catch (error) {
            console.error(`Error updating tournament ${tournamentId} from real-time event:`, error);
            // Continue operation - the subscription will retry on next event
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Successfully subscribed to tournament ${tournamentId}`);
          // Clear any pending reconnect attempts on successful subscription
          const existingTimeout = reconnectTimeoutsRef.current.get(`tournament:${tournamentId}`);
          if (existingTimeout) {
            clearTimeout(existingTimeout);
            reconnectTimeoutsRef.current.delete(`tournament:${tournamentId}`);
          }
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`Channel error for tournament ${tournamentId}:`, err);
          // Attempt to reconnect after a delay
          reconnectTournament(tournamentId, 5000); // Retry after 5 seconds
        } else if (status === 'TIMED_OUT') {
          console.error(`Subscription timed out for tournament ${tournamentId}`);
          // Attempt to reconnect with shorter delay
          reconnectTournament(tournamentId, 3000); // Retry after 3 seconds
        } else if (status === 'CLOSED') {
          console.log(`Subscription closed for tournament ${tournamentId}`);
        }
      });

    subscriptionsRef.current.set(`tournament:${tournamentId}`, subscription);
  }, [fetchTournamentAvailability, updateTournamentCache, reconnectTournament]);

  /**
   * Subscribe to tournament real-time updates
   */
  const subscribeTournament = useCallback(async (tournamentId: string) => {
    await subscribeTournamentInternal(tournamentId);
  }, [subscribeTournamentInternal]);

  /**
   * Unsubscribe from tournament real-time updates
   */
  const unsubscribeTournament = useCallback((tournamentId: string) => {
    const key = `tournament:${tournamentId}`;
    const subscription = subscriptionsRef.current.get(key);
    if (subscription) {
      supabase.removeChannel(subscription);
      subscriptionsRef.current.delete(key);
    }
  }, []);

  /**
   * Poll addon inventory
   */
  const pollAddonInventory = useCallback(async () => {
    const addonIds = Array.from(subscribedItemsRef.current)
      .filter((id) => id.startsWith('addon:'))
      .map((id) => id.replace('addon:', ''));

    if (addonIds.length === 0) return;

    for (const addonId of addonIds) {
      const availability = await fetchAddonAvailability(addonId);
      if (availability) {
        updateAddonCache(availability);
      }
    }
  }, [fetchAddonAvailability, updateAddonCache]);

  /**
   * Subscribe to addon updates (via polling)
   */
  const subscribeAddon = useCallback(async (addonId: string) => {
    // Fetch initial data
    const availability = await fetchAddonAvailability(addonId);
    if (availability) {
      updateAddonCache(availability);
    }

    // Start polling if not already started
    if (!pollIntervalRef.current) {
      pollIntervalRef.current = setInterval(pollAddonInventory, ADDON_POLL_INTERVAL);
    }
  }, [fetchAddonAvailability, updateAddonCache, pollAddonInventory]);

  /**
   * Unsubscribe from addon updates
   */
  const unsubscribeAddon = useCallback((addonId: string) => {
    // Check if there are any other addons being monitored
    const addonIds = Array.from(subscribedItemsRef.current)
      .filter((id) => id.startsWith('addon:') && id !== `addon:${addonId}`);

    // Stop polling if no more addons
    if (addonIds.length === 0 && pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  /**
   * Subscribe to item availability updates
   */
  const subscribe = useCallback((itemId: string, itemType: OrderItemType) => {
    const key = `${itemType}:${itemId}`;
    
    // Don't subscribe if already subscribed
    if (subscribedItemsRef.current.has(key)) {
      return;
    }

    subscribedItemsRef.current.add(key);

    if (itemType === 'tournament') {
      subscribeTournament(itemId);
    } else if (itemType === 'addon') {
      subscribeAddon(itemId);
    }
  }, [subscribeTournament, subscribeAddon]);

  /**
   * Unsubscribe from item availability updates
   */
  const unsubscribe = useCallback((itemId: string, itemType: OrderItemType) => {
    const key = `${itemType}:${itemId}`;
    
    if (!subscribedItemsRef.current.has(key)) {
      return;
    }

    subscribedItemsRef.current.delete(key);

    if (itemType === 'tournament') {
      unsubscribeTournament(itemId);
    } else if (itemType === 'addon') {
      unsubscribeAddon(itemId);
    }
  }, [unsubscribeTournament, unsubscribeAddon]);

  /**
   * Check if an item is available
   */
  const isAvailable = useCallback((itemId: string, itemType: OrderItemType): boolean => {
    if (itemType === 'tournament') {
      const tournament = cache.tournaments.get(itemId);
      return tournament?.isAvailable ?? true; // Default to available if not in cache
    } else if (itemType === 'addon') {
      const addon = cache.addons.get(itemId);
      return addon?.isAvailable ?? true; // Default to available if not in cache
    }
    return true; // Other item types are always available
  }, [cache]);

  /**
   * Get current capacity for a tournament (including reservations)
   */
  const currentCapacity = useCallback((tournamentId: string): CapacityInfo | null => {
    const tournament = cache.tournaments.get(tournamentId);
    if (!tournament) return null;

    return {
      current: tournament.currentParticipants,
      reserved: tournament.reservedParticipants,
      max: tournament.maxParticipants,
      effectiveAvailable: tournament.effectiveAvailable,
    };
  }, [cache]);

  /**
   * Get current stock for an addon (including reservations)
   */
  const currentStock = useCallback((addonId: string): StockInfo | null => {
    const addon = cache.addons.get(addonId);
    if (!addon) return null;

    return {
      stock: addon.stockQuantity,
      reserved: addon.reservedQuantity,
      effectiveAvailable: addon.effectiveAvailable,
    };
  }, [cache]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      // Unsubscribe from all real-time subscriptions
      subscriptionsRef.current.forEach((subscription) => {
        supabase.removeChannel(subscription);
      });
      subscriptionsRef.current.clear();

      // Clear all reconnection timeouts
      reconnectTimeoutsRef.current.forEach((timeout) => {
        clearTimeout(timeout);
      });
      reconnectTimeoutsRef.current.clear();

      // Clear polling interval
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  return {
    isAvailable,
    currentCapacity,
    currentStock,
    subscribe,
    unsubscribe,
  };
}
