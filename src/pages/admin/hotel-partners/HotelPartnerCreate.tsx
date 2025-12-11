import type { FC } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '@/hooks';
import { HotelPartnerForm, type HotelPartnerFormData } from '@/components/admin/forms/HotelPartnerForm';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Link } from 'react-router-dom';

/**
 * Create new hotel partner page
 */
export const HotelPartnerCreate: FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { createHotelPartner } = useAdmin();
  const navigate = useNavigate();

  const handleSubmit = async (data: HotelPartnerFormData) => {
    // Convert form data to database format (snake_case)
    const dbData = {
      name: data.name,
      description: data.description || null,
      address: data.address,
      city: data.city,
      state: data.state,
      zip_code: data.zipCode,
      phone: data.phone || null,
      booking_url: data.bookingUrl,
      booking_code: data.bookingCode || null,
      rate_description: data.rateDescription || null,
      distance_from_venue: data.distanceFromVenue || null,
      amenities: data.amenities ? data.amenities.split(',').map(a => a.trim()).filter(Boolean) : null, // Convert comma-separated string to array
      image_url: data.imageUrl || null,
      gallery_urls: data.galleryUrls,
      is_primary: data.isPrimary,
      is_active: data.isActive,
      display_order: data.displayOrder,
      background_image_url: null,
      distance_from_airport: null,
      getting_here_text: null,
      hotel_perks_text: null,
      parking_info: null,
      staying_here_text: null,
    };

    setIsLoading(true);
    try {
      await createHotelPartner(dbData);
      setIsLoading(false);
      navigate('/admin/hotel-partners');
    } catch (error) {
      setIsLoading(false);
      console.error('Error creating hotel partner:', error);
      alert('Failed to create hotel partner');
    }
  };

  const handleCancel = () => {
    navigate('/admin/hotel-partners');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/admin/hotel-partners">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-viking text-turquoise-900">Create Hotel Partner</h1>
          <p className="text-turquoise-700 mt-2">
            Add a new hotel partner to the event
          </p>
        </div>
      </div>

      {/* Form */}
      <HotelPartnerForm
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isLoading={isLoading}
        submitText="Create Hotel Partner"
      />
    </div>
  );
};
