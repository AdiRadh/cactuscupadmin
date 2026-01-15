import type { FC } from 'react';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Input, Label, Textarea, Button } from '@/components/ui';
import type { HotelPartner } from '@/types';
import { ImageUpload } from './ImageUpload';
import { ImageGallery } from './ImageGallery';
import { uploadHotelPartnerImage, deleteHotelPartnerImage, getFilePathFromPublicUrl, HOTEL_PARTNERS_BUCKET } from '@/lib/utils/imageUpload';

export interface HotelPartnerFormData {
  name: string;
  description: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  bookingUrl: string;
  bookingCode: string;
  rateDescription: string;
  distanceFromVenue: string;
  amenities: string; // comma-separated (converted to/from array)
  imageUrl: string | null;
  galleryUrls: string[];
  isPrimary: boolean;
  isActive: boolean;
  displayOrder: number;
}

interface HotelPartnerFormProps {
  initialData?: HotelPartner;
  onSubmit: (data: HotelPartnerFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
  submitText?: string;
}

/**
 * Reusable hotel partner form component
 * Used for both creating and editing hotel partners
 */
export const HotelPartnerForm: FC<HotelPartnerFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
  submitText = 'Save Hotel Partner',
}) => {
  const [formData, setFormData] = useState<HotelPartnerFormData>({
    name: initialData?.name || '',
    description: initialData?.description || '',
    address: initialData?.address || '',
    city: initialData?.city || '',
    state: initialData?.state || '',
    zipCode: initialData?.zipCode || '',
    phone: initialData?.phone || '',
    bookingUrl: initialData?.bookingUrl || '',
    bookingCode: initialData?.bookingCode || '',
    rateDescription: initialData?.rateDescription || '',
    distanceFromVenue: initialData?.distanceFromVenue || '',
    amenities: initialData?.amenities ? initialData.amenities.join(', ') : '', // Convert array to comma-separated string
    imageUrl: initialData?.imageUrl || null,
    galleryUrls: initialData?.galleryUrls || [],
    isPrimary: initialData?.isPrimary || false,
    isActive: initialData?.isActive ?? true,
    displayOrder: initialData?.displayOrder || 0,
  });

  const [errors, setErrors] = useState<Partial<Record<keyof HotelPartnerFormData, string>>>({});

  const handleChange = (
    field: keyof HotelPartnerFormData,
    value: string | number | boolean
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof HotelPartnerFormData, string>> = {};

    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.address.trim()) newErrors.address = 'Address is required';
    if (!formData.city.trim()) newErrors.city = 'City is required';
    if (!formData.state.trim()) newErrors.state = 'State is required';
    if (!formData.zipCode.trim()) newErrors.zipCode = 'Zip code is required';
    if (!formData.bookingUrl.trim()) newErrors.bookingUrl = 'Booking URL is required';
    if (formData.displayOrder < 0) newErrors.displayOrder = 'Display order cannot be negative';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">
              Hotel Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g., Marriott Phoenix Downtown"
              className={errors.name ? 'border-red-500' : ''}
            />
            {errors.name && (
              <p className="text-sm text-red-600 mt-1">{errors.name}</p>
            )}
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Brief description of the hotel..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Location */}
      <Card>
        <CardHeader>
          <CardTitle>Location</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="address">
              Address <span className="text-red-500">*</span>
            </Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => handleChange('address', e.target.value)}
              placeholder="e.g., 123 Main Street"
              className={errors.address ? 'border-red-500' : ''}
            />
            {errors.address && (
              <p className="text-sm text-red-600 mt-1">{errors.address}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label htmlFor="city">
                City <span className="text-red-500">*</span>
              </Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => handleChange('city', e.target.value)}
                placeholder="e.g., Phoenix"
                className={errors.city ? 'border-red-500' : ''}
              />
              {errors.city && (
                <p className="text-sm text-red-600 mt-1">{errors.city}</p>
              )}
            </div>

            <div>
              <Label htmlFor="state">
                State <span className="text-red-500">*</span>
              </Label>
              <Input
                id="state"
                value={formData.state}
                onChange={(e) => handleChange('state', e.target.value)}
                placeholder="e.g., AZ"
                className={errors.state ? 'border-red-500' : ''}
              />
              {errors.state && (
                <p className="text-sm text-red-600 mt-1">{errors.state}</p>
              )}
            </div>

            <div>
              <Label htmlFor="zipCode">
                Zip Code <span className="text-red-500">*</span>
              </Label>
              <Input
                id="zipCode"
                value={formData.zipCode}
                onChange={(e) => handleChange('zipCode', e.target.value)}
                placeholder="e.g., 85004"
                className={errors.zipCode ? 'border-red-500' : ''}
              />
              {errors.zipCode && (
                <p className="text-sm text-red-600 mt-1">{errors.zipCode}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="e.g., (555) 123-4567"
              />
            </div>

            <div>
              <Label htmlFor="distanceFromVenue">Distance from Venue</Label>
              <Input
                id="distanceFromVenue"
                value={formData.distanceFromVenue}
                onChange={(e) => handleChange('distanceFromVenue', e.target.value)}
                placeholder="e.g., 0.5 miles"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Booking Information */}
      <Card>
        <CardHeader>
          <CardTitle>Booking Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="bookingUrl">
              Booking URL <span className="text-red-500">*</span>
            </Label>
            <Input
              id="bookingUrl"
              value={formData.bookingUrl}
              onChange={(e) => handleChange('bookingUrl', e.target.value)}
              placeholder="https://..."
              className={errors.bookingUrl ? 'border-red-500' : ''}
            />
            {errors.bookingUrl && (
              <p className="text-sm text-red-600 mt-1">{errors.bookingUrl}</p>
            )}
          </div>

          <div>
            <Label htmlFor="bookingCode">Booking Code</Label>
            <Input
              id="bookingCode"
              value={formData.bookingCode}
              onChange={(e) => handleChange('bookingCode', e.target.value)}
              placeholder="e.g., CACTUSCUP2024"
            />
          </div>

          <div>
            <Label htmlFor="rateDescription">Rate Description</Label>
            <Textarea
              id="rateDescription"
              value={formData.rateDescription}
              onChange={(e) => handleChange('rateDescription', e.target.value)}
              placeholder="e.g., Special event rate includes breakfast..."
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Amenities */}
      <Card>
        <CardHeader>
          <CardTitle>Amenities</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="amenities">Amenities (comma-separated)</Label>
            <Textarea
              id="amenities"
              value={formData.amenities}
              onChange={(e) => handleChange('amenities', e.target.value)}
              placeholder="e.g., Free WiFi, Pool, Fitness Center, Breakfast"
              rows={3}
            />
            <p className="text-sm text-turquoise-600 mt-1">
              Separate amenities with commas
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Display Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Display Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label htmlFor="displayOrder">Display Order</Label>
              <Input
                id="displayOrder"
                type="number"
                min="0"
                value={formData.displayOrder}
                onChange={(e) => handleChange('displayOrder', parseInt(e.target.value) || 0)}
                className={errors.displayOrder ? 'border-red-500' : ''}
              />
              {errors.displayOrder && (
                <p className="text-sm text-red-600 mt-1">{errors.displayOrder}</p>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isPrimary"
                checked={formData.isPrimary}
                onChange={(e) => handleChange('isPrimary', e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="isPrimary">Primary Hotel</Label>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => handleChange('isActive', e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="isActive">Active</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Images */}
      <Card>
        <CardHeader>
          <CardTitle>Images</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <ImageUpload
            label="Main Image"
            value={formData.imageUrl}
            onChange={(url) => handleChange('imageUrl', url || '')}
            onUpload={async (file) => {
              // Use hotel name slug or 'new' for new hotels
              const hotelId = initialData?.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'temp-' + Date.now();
              return uploadHotelPartnerImage(file, hotelId, 'header');
            }}
            onDelete={async (url) => {
              const path = getFilePathFromPublicUrl(url, HOTEL_PARTNERS_BUCKET);
              if (path) {
                await deleteHotelPartnerImage(path);
              }
            }}
            helperText="Recommended size: 1200x400px. This image will be displayed as the main hotel image."
          />

          <ImageGallery
            label="Image Gallery"
            value={formData.galleryUrls}
            onChange={(urls) => setFormData(prev => ({ ...prev, galleryUrls: urls }))}
            onUpload={async (file) => {
              const hotelId = initialData?.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'temp-' + Date.now();
              return uploadHotelPartnerImage(file, hotelId, 'gallery');
            }}
            onDelete={async (url) => {
              const path = getFilePathFromPublicUrl(url, HOTEL_PARTNERS_BUCKET);
              if (path) {
                await deleteHotelPartnerImage(path);
              }
            }}
            helperText="Upload additional images to showcase the hotel. Maximum 10 images."
            maxImages={10}
          />
        </CardContent>
      </Card>

      {/* Form Actions */}
      <div className="flex items-center justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Saving...' : submitText}
        </Button>
      </div>
    </form>
  );
};
