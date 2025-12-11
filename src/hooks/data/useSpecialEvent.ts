import { useState, useEffect } from 'react';
import { supabase } from '@/lib/api/supabase';
import type { SpecialEvent, DbSpecialEvent } from '@/types';
import { dbToSpecialEvent } from '@/types';

export interface UseSpecialEventReturn {
  specialEvents: SpecialEvent[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to fetch all active special events
 * Fetches events where is_active = true AND status = 'published' AND visible = true
 * Uses React state for data management with automatic RLS policy enforcement
 *
 * @example
 * ```tsx
 * const { specialEvents, isLoading, error } = useSpecialEvent();
 *
 * if (isLoading) return <Spinner />;
 * if (error) return <ErrorMessage error={error} />;
 * if (specialEvents.length === 0) return <NoEventMessage />;
 * return <SpecialEventsList events={specialEvents} />;
 * ```
 */
export function useSpecialEvent(): UseSpecialEventReturn {
  const [specialEvents, setSpecialEvents] = useState<SpecialEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchSpecialEvents(): Promise<void> {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch all active special events
        // RLS policies ensure only public data is returned
        const { data, error: fetchError } = await supabase
          .from('special_events')
          .select('*')
          .eq('is_active', true)
          .eq('status', 'published')
          .eq('visible', true)
          .order('event_date', { ascending: true });

        if (fetchError) {
          throw fetchError;
        }

        if (mounted) {
          const events = data ? data.map((d) => dbToSpecialEvent(d as DbSpecialEvent)) : [];
          setSpecialEvents(events);
        }
      } catch (err) {
        console.error('Failed to fetch special events:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load special events');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void fetchSpecialEvents();

    return () => {
      mounted = false;
    };
  }, []);

  return {
    specialEvents,
    isLoading,
    error,
  };
}
