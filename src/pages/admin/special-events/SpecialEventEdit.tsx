import type { FC } from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAdmin } from '@/hooks';
import { SpecialEventForm, type SpecialEventFormData } from '@/components/admin/forms/SpecialEventForm';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { hasStripeProduct, syncSpecialEventPricing } from '@/lib/utils/stripe';
import { datetimeLocalToUTC } from '@/lib/utils/dateUtils';
import { uploadSpecialEventImage, deleteSpecialEventImage, getSpecialEventImagePathFromUrl } from '@/lib/utils/imageUpload';
import type { SpecialEvent } from '@/types';

/**
 * Edit existing special event page
 */
export const SpecialEventEdit: FC = () => {
  const { id } = useParams<{ id: string }>();
  const [specialEvent, setSpecialEvent] = useState<SpecialEvent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const { getSpecialEvent, updateSpecialEvent } = useAdmin();
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;
    getSpecialEvent(id)
      .then(setSpecialEvent)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [id, getSpecialEvent]);

  const handleImageUpload = useCallback(async (file: File): Promise<{ url: string } | { error: string }> => {
    if (!id) return { error: 'Event ID not available' };
    const result = await uploadSpecialEventImage(file, id, 'header');
    if ('error' in result) {
      return { error: result.error };
    }
    return { url: result.url };
  }, [id]);

  const handleImageDelete = useCallback(async (url: string): Promise<void> => {
    const path = getSpecialEventImagePathFromUrl(url);
    if (path) {
      await deleteSpecialEventImage(path);
    }
  }, []);

  const handleSubmit = async (formData: SpecialEventFormData) => {
    if (!id) return;

    // Convert form data to database format
    const dbData = {
      title: formData.title,
      slug: formData.slug,
      subtitle: formData.subtitle || null,
      hero_image_url: formData.heroImageUrl || null,
      hero_subtitle: formData.heroSubtitle || null,
      nav_display_name: formData.navDisplayName,
      description: formData.description,
      event_date: formData.date,
      start_time: formData.startTime || null,
      end_time: formData.endTime || null,
      location: formData.location,
      venue: formData.venue,
      location_details: {
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zipCode: formData.zipCode,
      },
      directions_text: formData.directionsText || null,
      parking_info: formData.parkingInfo || null,
      itinerary: formData.itineraryJson ? JSON.parse(formData.itineraryJson) : null,
      dress_code: formData.dressCode || null,
      dress_code_details: formData.dressCodeDetails || null,
      ticket_price: formData.ticketPrice ? Math.round(formData.ticketPrice * 100) : null, // Convert dollars to cents
      early_bird_ticket_price: formData.earlyBirdTicketPrice ? Math.round(formData.earlyBirdTicketPrice * 100) : null,
      early_bird_start_date: datetimeLocalToUTC(formData.earlyBirdStartDate),
      early_bird_end_date: datetimeLocalToUTC(formData.earlyBirdEndDate),
      event_registrant_price: formData.eventRegistrantPrice !== null ? Math.round(formData.eventRegistrantPrice * 100) : null,
      allow_non_registrants: formData.allowNonRegistrants,
      allow_standalone_purchase: formData.allowStandalonePurchase,
      register_button_text: formData.registerButtonText || null,
      register_button_url: formData.registerButtonUrl || null,
      max_capacity: formData.maxCapacity,
      registration_opens_at: datetimeLocalToUTC(formData.registrationOpensAt),
      registration_closes_at: datetimeLocalToUTC(formData.registrationClosesAt),
      is_active: formData.isActive,
      status: formData.status,
      visible: formData.visible,
    };

    setIsUpdating(true);
    try {
      // Update special event in database
      await updateSpecialEvent(id, dbData);

      // Check if Stripe product exists and sync if it does
      if (specialEvent && hasStripeProduct(specialEvent) && formData.ticketPrice) {
        try {
          await syncSpecialEventPricing(
            id,
            formData.title,
            formData.description,
            Math.round(formData.ticketPrice * 100),
            formData.earlyBirdTicketPrice ? Math.round(formData.earlyBirdTicketPrice * 100) : null,
            datetimeLocalToUTC(formData.earlyBirdStartDate),
            datetimeLocalToUTC(formData.earlyBirdEndDate)
          );
          console.log('Stripe product synced successfully');
        } catch (syncError) {
          console.error('Failed to sync Stripe product:', syncError);
          alert('Special event updated, but failed to sync pricing with Stripe. Please try manual sync.');
        }
      } else if (formData.ticketPrice && formData.ticketPrice > 0) {
        // Show notification that no Stripe product exists
        alert('Special event updated successfully. Note: No Stripe product exists for this event yet. Create one from the special events list to enable payments.');
      }

      setIsUpdating(false);
      navigate('/admin/special-events');
    } catch (error) {
      setIsUpdating(false);
      console.error('Error updating special event:', error);
      alert('Failed to update special event');
    }
  };

  const handleCancel = () => {
    navigate('/admin/special-events');
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/admin/special-events">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-viking text-turquoise-900">Edit Special Event</h1>
          </div>
        </div>
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-turquoise-600">
              Loading special event data...
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!specialEvent) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/admin/special-events">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-viking text-turquoise-900">Edit Special Event</h1>
          </div>
        </div>
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-turquoise-600">
              Special event not found
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

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
          <h1 className="text-3xl font-viking text-turquoise-900">Edit Special Event</h1>
          <p className="text-turquoise-700 mt-2">{specialEvent.title}</p>
        </div>
      </div>

      {/* Form */}
      <SpecialEventForm
        initialData={specialEvent}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isLoading={isUpdating}
        submitText="Update Special Event"
        onImageUpload={handleImageUpload}
        onImageDelete={handleImageDelete}
      />
    </div>
  );
};
