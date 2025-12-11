import type { FC } from 'react';
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '@/hooks';
import { SpecialEventForm, type SpecialEventFormData } from '@/components/admin/forms/SpecialEventForm';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Link } from 'react-router-dom';
import { datetimeLocalToUTC } from '@/lib/utils/dateUtils';
import { uploadSpecialEventImage, deleteSpecialEventImage, getSpecialEventImagePathFromUrl } from '@/lib/utils/imageUpload';

/**
 * Create new special event page
 */
export const SpecialEventCreate: FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { createSpecialEvent } = useAdmin();
  const navigate = useNavigate();

  // Generate a temporary ID for image uploads (will be used as folder name)
  const tempEventId = useMemo(() => crypto.randomUUID(), []);

  const handleImageUpload = async (file: File): Promise<{ url: string } | { error: string }> => {
    const result = await uploadSpecialEventImage(file, tempEventId, 'header');
    if ('error' in result) {
      return { error: result.error };
    }
    return { url: result.url };
  };

  const handleImageDelete = async (url: string): Promise<void> => {
    const path = getSpecialEventImagePathFromUrl(url);
    if (path) {
      await deleteSpecialEventImage(path);
    }
  };

  const handleSubmit = async (data: SpecialEventFormData) => {
    // Convert form data to database format
    const dbData = {
      title: data.title,
      slug: data.slug,
      subtitle: data.subtitle || null,
      hero_image_url: data.heroImageUrl || null,
      hero_subtitle: data.heroSubtitle || null,
      nav_display_name: data.navDisplayName,
      description: data.description,
      event_date: data.date,
      start_time: data.startTime || null,
      end_time: data.endTime || null,
      location: data.location,
      venue: data.venue,
      location_details: {
        address: data.address,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
      },
      directions_text: data.directionsText || null,
      parking_info: data.parkingInfo || null,
      itinerary: data.itineraryJson ? JSON.parse(data.itineraryJson) : null,
      dress_code: data.dressCode || null,
      dress_code_details: data.dressCodeDetails || null,
      ticket_price: data.ticketPrice ? Math.round(data.ticketPrice * 100) : null, // Convert dollars to cents
      event_registrant_price: data.eventRegistrantPrice !== null ? Math.round(data.eventRegistrantPrice * 100) : null,
      early_bird_ticket_price: data.earlyBirdTicketPrice ? Math.round(data.earlyBirdTicketPrice * 100) : null,
      early_bird_start_date: datetimeLocalToUTC(data.earlyBirdStartDate),
      early_bird_end_date: datetimeLocalToUTC(data.earlyBirdEndDate),
      stripe_early_bird_price_id: null,
      allow_non_registrants: data.allowNonRegistrants,
      allow_standalone_purchase: data.allowStandalonePurchase,
      register_button_text: data.registerButtonText || null,
      register_button_url: data.registerButtonUrl || null,
      max_capacity: data.maxCapacity,
      current_registrations: 0,
      registration_opens_at: datetimeLocalToUTC(data.registrationOpensAt),
      registration_closes_at: datetimeLocalToUTC(data.registrationClosesAt),
      gallery_images: null,
      is_active: data.isActive,
      status: data.status,
      visible: data.visible,
      // Additional optional fields from database schema
      header_image_url: null,
      registration_end_date: null,
      registration_start_date: null,
      is_published: null,
      registration_open: null,
      allow_plus_ones: null,
      plus_one_price: null,
      dinner_options: null,
      content_sections: null,
      event_type: null,
      created_by: null,
      stripe_price_id: null,
      stripe_product_id: null,
    };

    setIsLoading(true);
    try {
      await createSpecialEvent(dbData);
      setIsLoading(false);
      navigate('/admin/special-events');
    } catch (error) {
      setIsLoading(false);
      console.error('Error creating special event:', error);
      alert('Failed to create special event');
    }
  };

  const handleCancel = () => {
    navigate('/admin/special-events');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/admin/special-events">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-viking text-turquoise-900">Create Special Event</h1>
          <p className="text-turquoise-700 mt-2">
            Add a new special event to the schedule
          </p>
        </div>
      </div>

      {/* Form */}
      <SpecialEventForm
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isLoading={isLoading}
        submitText="Create Special Event"
        onImageUpload={handleImageUpload}
        onImageDelete={handleImageDelete}
      />
    </div>
  );
};
