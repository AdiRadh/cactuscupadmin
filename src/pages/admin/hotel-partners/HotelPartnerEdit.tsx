import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAdmin } from '@/hooks';
import { HotelPartnerForm, type HotelPartnerFormData } from '@/components/admin/forms/HotelPartnerForm';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import type { HotelPartner } from '@/types';

/**
 * Edit existing hotel partner page
 */
export const HotelPartnerEdit: FC = () => {
  const { id } = useParams<{ id: string }>();
  const [hotelPartner, setHotelPartner] = useState<HotelPartner | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const { getHotelPartner, updateHotelPartner } = useAdmin();
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;
    getHotelPartner(id)
      .then(setHotelPartner)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [id, getHotelPartner]);

  const handleSubmit = async (formData: HotelPartnerFormData) => {
    if (!id) return;

    // Convert form data to database format (snake_case)
    const dbData = {
      name: formData.name,
      description: formData.description || null,
      address: formData.address,
      city: formData.city,
      state: formData.state,
      zip_code: formData.zipCode,
      phone: formData.phone || null,
      booking_url: formData.bookingUrl,
      booking_code: formData.bookingCode || null,
      rate_description: formData.rateDescription || null,
      distance_from_venue: formData.distanceFromVenue || null,
      amenities: formData.amenities ? formData.amenities.split(',').map(a => a.trim()).filter(Boolean) : null, // Convert comma-separated string to array
      image_url: formData.imageUrl || null,
      gallery_urls: formData.galleryUrls,
      is_primary: formData.isPrimary,
      is_active: formData.isActive,
      display_order: formData.displayOrder,
    };

    setIsUpdating(true);
    try {
      await updateHotelPartner(id, dbData);
      setIsUpdating(false);
      navigate('/admin/hotel-partners');
    } catch (error) {
      setIsUpdating(false);
      console.error('Error updating hotel partner:', error);
      alert('Failed to update hotel partner');
    }
  };

  const handleCancel = () => {
    navigate('/admin/hotel-partners');
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/admin/hotel-partners">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-viking text-turquoise-900">Edit Hotel Partner</h1>
          </div>
        </div>
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-turquoise-600">
              Loading hotel partner data...
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!hotelPartner) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/admin/hotel-partners">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-viking text-turquoise-900">Edit Hotel Partner</h1>
          </div>
        </div>
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-turquoise-600">
              Hotel partner not found
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
        <Link to="/admin/hotel-partners">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-viking text-turquoise-900">Edit Hotel Partner</h1>
          <p className="text-turquoise-700 mt-2">{hotelPartner.name}</p>
        </div>
      </div>

      {/* Form */}
      <HotelPartnerForm
        initialData={hotelPartner}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isLoading={isUpdating}
        submitText="Update Hotel Partner"
      />
    </div>
  );
};
