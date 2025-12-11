import { useState, useEffect } from 'react';
import { supabase } from '@/lib/api/supabase';

interface HotelBookingUrl {
  bookingUrl: string | null;
  isLoading: boolean;
}

/**
 * Hook to fetch the primary hotel's booking URL
 * Returns the booking URL of the primary active hotel partner
 */
export function useHotelBookingUrl(): HotelBookingUrl {
  const [state, setState] = useState<HotelBookingUrl>({
    bookingUrl: null,
    isLoading: true,
  });

  useEffect(() => {
    const fetchBookingUrl = async () => {
      try {
        // First try to get the primary hotel
        const { data: primaryHotel, error: primaryError } = await supabase
          .from('hotel_partners')
          .select('booking_url')
          .eq('is_primary', true)
          .eq('is_active', true)
          .maybeSingle();

        if (primaryError) {
          console.error('Error fetching primary hotel:', primaryError);
        }

        if (primaryHotel?.booking_url) {
          setState({ bookingUrl: primaryHotel.booking_url, isLoading: false });
          return;
        }

        // Fallback to any active hotel if no primary is set
        const { data, error } = await supabase
          .from('hotel_partners')
          .select('booking_url')
          .eq('is_active', true)
          .order('display_order', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error('Error fetching hotel booking URL:', error);
          setState({ bookingUrl: null, isLoading: false });
          return;
        }

        setState({
          bookingUrl: data?.booking_url || null,
          isLoading: false,
        });
      } catch (err) {
        console.error('Unexpected error fetching hotel booking URL:', err);
        setState({ bookingUrl: null, isLoading: false });
      }
    };

    fetchBookingUrl();
  }, []);

  return state;
}
